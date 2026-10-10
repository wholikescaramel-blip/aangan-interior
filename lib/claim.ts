import { sql } from "./db";

export type ClaimResult =
  | { ok: true; claimedAt: Date }
  | { ok: false; reason: "already_taken"; by: string; at: Date | null }
  | { ok: false; reason: "not_found" };

/** First tap wins: a single conditional UPDATE, so two simultaneous taps can't both succeed. */
export async function claimLead(callId: string, user: { id: number; name: string }): Promise<ClaimResult> {
  const won = (await sql()`
    UPDATE handoffs SET claimed_by = ${user.name}, claimed_by_tg_id = ${user.id}, claimed_at = now()
    WHERE call_id = ${callId} AND claimed_by IS NULL
    RETURNING claimed_at`) as { claimed_at: string }[];
  if (won[0]) return { ok: true, claimedAt: new Date(won[0].claimed_at) };
  const row = ((await sql()`SELECT claimed_by, claimed_at FROM handoffs WHERE call_id = ${callId}`) as any[])[0];
  if (!row) return { ok: false, reason: "not_found" };
  return { ok: false, reason: "already_taken", by: row.claimed_by, at: row.claimed_at ? new Date(row.claimed_at) : null };
}
