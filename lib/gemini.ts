import { GoogleGenAI, type Content, type Schema } from "@google/genai";

let client: GoogleGenAI | null = null;

export function gemini(): GoogleGenAI {
  if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not set");
  client ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return client;
}

// gemini-2.5-flash is no longer offered to new API users, so the default moved to 3.8-flash.
export const geminiModel = () => process.env.GEMINI_MODEL || "gemini-3.8-flash";

/**
 * Models to try in order. On the free tier each model has its own small daily request quota,
 * so when one is exhausted the next is used (GEMINI_FALLBACK_MODELS, comma-separated).
 */
export function modelPool(primary = geminiModel(), fallbacks = process.env.GEMINI_FALLBACK_MODELS): string[] {
  const list = [primary, ...(fallbacks ?? "").split(",")].map((m) => m.trim()).filter(Boolean);
  return [...new Set(list)];
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface GenResult {
  text: string;
  usage: TokenUsage;
  model: string;
}

export class QuotaExhaustedError extends Error {}

/** Models whose daily quota ran out during this process. */
const exhausted = new Set<string>();

export async function generate(opts: {
  system: string;
  contents: Content[] | string;
  json?: { schema: Schema };
  temperature?: number;
  /** Ordered pool; defaults to modelPool(). */
  models?: string[];
}): Promise<GenResult> {
  const all = opts.models?.length ? opts.models : modelPool();
  for (;;) {
    const pool = all.filter((m) => !exhausted.has(m));
    if (!pool.length) throw new QuotaExhaustedError(`Daily quota exhausted for all models: ${all.join(", ")}`);
    // Prefer models not cooling down from a per-minute limit; if all are cooling, wait for the first.
    const now = Date.now();
    const ready = pool.filter((m) => (coolUntil.get(m) ?? 0) <= now);
    if (!ready.length) {
      const wait = Math.min(...pool.map((m) => coolUntil.get(m)!)) - now;
      await sleep(Math.max(wait, 1000));
      continue;
    }
    const model = ready[0];
    try {
      const res = await withRetry(() => gemini().models.generateContent(request(model, opts)));
      return {
        text: res.text ?? "",
        model,
        usage: {
          inputTokens: res.usageMetadata?.promptTokenCount ?? 0,
          outputTokens:
            (res.usageMetadata?.candidatesTokenCount ?? 0) + (res.usageMetadata?.thoughtsTokenCount ?? 0),
        },
      };
    } catch (err) {
      if (err instanceof QuotaExhaustedError) exhausted.add(model);
      else if (err instanceof RateLimitedError) coolUntil.set(model, Date.now() + err.retryMs);
      else throw err;
    }
  }
}

/** Models cooling down after a per-minute rate limit, until this epoch ms. */
const coolUntil = new Map<string, number>();

export class RateLimitedError extends Error {
  constructor(message: string, readonly retryMs: number) {
    super(message);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function request(model: string, opts: Parameters<typeof generate>[0]) {
  const json = opts.json ? { responseMimeType: "application/json", responseSchema: opts.json.schema } : {};
  // Gemma models on the Gemini API don't accept a system instruction: send it as the first user turn.
  if (model.startsWith("gemma")) {
    const contents: Content[] =
      typeof opts.contents === "string" ? [{ role: "user", parts: [{ text: opts.contents }] }] : opts.contents;
    const first = contents[0];
    const merged: Content[] =
      first?.role === "user"
        ? [{ role: "user", parts: [{ text: `${opts.system}\n\n---\n\n` }, ...(first.parts ?? [])] }, ...contents.slice(1)]
        : [{ role: "user", parts: [{ text: opts.system }] }, ...contents];
    return { model, contents: merged, config: { temperature: opts.temperature, ...json } };
  }
  return {
    model,
    contents: opts.contents,
    config: { systemInstruction: opts.system, temperature: opts.temperature, ...json },
  };
}

/** Retries transient API errors (429/5xx) with backoff. Not for invalid-JSON retries. */
async function withRetry<T>(fn: () => Promise<T>, attempts = 4): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const msg = String((err as Error)?.message ?? err);
      if (!/429|500|502|503|504|UNAVAILABLE|RESOURCE_EXHAUSTED|overloaded|INTERNAL/i.test(msg)) throw err;
      // Daily quota exhausted: retrying this model can't succeed today.
      if (/PerDay/i.test(msg)) throw new QuotaExhaustedError(msg);
      // Per-minute quota: hand back to the caller so it can use another model meanwhile.
      if (/RESOURCE_EXHAUSTED|429/.test(msg)) {
        const secs = Number(msg.match(/retry in ([\d.]+)s/i)?.[1] ?? msg.match(/"retryDelay":"(\d+)s"/)?.[1] ?? 30);
        throw new RateLimitedError(msg, Math.ceil(secs * 1000) + 500);
      }
      await sleep(2000 * 2 ** i);
    }
  }
  throw lastErr;
}
