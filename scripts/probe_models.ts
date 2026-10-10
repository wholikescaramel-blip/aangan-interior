/** Sends one tiny request to each candidate model to see which ones this key can use right now. */
import { gemini } from "../lib/gemini";

async function main() {
  const all: string[] = [];
  for await (const m of await gemini().models.list()) all.push((m.name ?? "").replace("models/", ""));
  console.log("gemma models:", all.filter((n) => /gemma/.test(n)).join(", ") || "(none)");
  const cands = process.argv.slice(2).length
    ? process.argv.slice(2)
    : ["gemini-3.7-flash", "gemini-3.6-flash", "gemini-3.5-flash", "gemini-3.5-flash-lite", "gemini-3.1-flash-lite",
       "gemini-2.5-flash-lite", "gemini-flash-latest", "gemini-flash-lite-latest", ...all.filter((n) => /gemma/.test(n)).slice(0, 3)];
  for (const m of cands) {
    try {
      const r = await gemini().models.generateContent({ model: m, contents: "Say OK" });
      console.log("OK   ", m, (r.text ?? "").trim().slice(0, 10));
    } catch (e) {
      const s = String((e as Error).message ?? e);
      console.log("FAIL ", m, s.match(/limit: \d+/)?.[0] ?? "", s.slice(0, 100));
    }
  }
}
main();
