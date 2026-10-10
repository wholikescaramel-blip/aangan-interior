/**
 * Database behaviour against the real Neon database (skipped without DATABASE_URL).
 * Each test uses unique ids and deletes its rows afterwards.
 */
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { sql } from "../../lib/db";
import { storeEnquiry } from "../../lib/pipeline";
import { claimLead } from "../../lib/claim";
import type { Enquiry } from "../../lib/enquiry";

const hasDb = !!process.env.DATABASE_URL;
const created: string[] = [];

const enquiry = (externalId: string): Enquiry => ({
  channel: "phone", externalId, callerNumberE164: "+919800000000",
  startedAt: new Date("2026-10-10T05:00:00Z"), answeredAt: new Date("2026-10-10T05:00:02Z"), endedAt: new Date("2026-10-10T05:03:00Z"),
  durationSeconds: 178, transcript: "Agent: Namaste\nCaller: test", recordingUrl: null, structured: null, providerCostInr: null,
  isComplete: true, raw: { test: true },
});

describe.skipIf(!hasDb)("database", () => {
  afterAll(async () => {
    if (created.length) await sql()`DELETE FROM calls WHERE id = ANY(${created})`;
  });

  it("idempotent on the provider call id: a retried webhook stores one row", async () => {
    const ext = "test-" + randomUUID();
    const first = await storeEnquiry(enquiry(ext));
    const second = await storeEnquiry(enquiry(ext));
    expect(first).toBeTruthy();
    expect(second).toBeNull();
    created.push(first!);
    const rows = (await sql()`SELECT response_time_seconds, after_hours FROM calls WHERE external_id = ${ext}`) as any[];
    expect(rows).toHaveLength(1);
    expect(Number(rows[0].response_time_seconds)).toBe(2);
    expect(rows[0].after_hours).toBe(false); // Saturday 10:30 IST
  });

  it("claim race: two simultaneous taps, exactly one wins", async () => {
    const id = await storeEnquiry(enquiry("test-" + randomUUID()));
    created.push(id!);
    await sql()`INSERT INTO handoffs (call_id, telegram_chat_id, posted_at) VALUES (${id}, 'test', now())`;
    const results = await Promise.all([
      claimLead(id!, { id: 1, name: "Asha" }),
      claimLead(id!, { id: 2, name: "Rahul" }),
      claimLead(id!, { id: 3, name: "Meera" }),
    ]);
    const winners = results.filter((r) => r.ok);
    expect(winners).toHaveLength(1);
    const row = ((await sql()`SELECT claimed_by FROM handoffs WHERE call_id = ${id}`) as any[])[0];
    for (const r of results.filter((r) => !r.ok)) expect(r).toMatchObject({ reason: "already_taken", by: row.claimed_by });
  });
});
