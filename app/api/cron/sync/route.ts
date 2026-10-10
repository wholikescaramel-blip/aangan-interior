import { sql, logError } from "@/lib/db";
import { HubSpot } from "@/lib/hubspot";
import { processCall } from "@/lib/pipeline";
import { safeEqual } from "@/lib/vaani";

export const maxDuration = 300;

/**
 * Hourly job (called by GitHub Actions; Vercel Hobby cron is limited to daily):
 *  1. cache HubSpot deal stages / amounts / won flags in Neon for the dashboard funnel;
 *  2. re-run calls whose pipeline failed or never started (e.g. after() was cut short).
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  if (!secret || !safeEqual(auth, `Bearer ${secret}`)) return new Response("unauthorized", { status: 401 });

  const out = { dealsSynced: 0, callsRetried: 0, errors: 0 };

  if (process.env.HUBSPOT_TOKEN) {
    try {
      const rows = (await sql()`SELECT DISTINCT deal_id FROM hubspot_sync WHERE deal_id IS NOT NULL`) as { deal_id: string }[];
      const deals = await new HubSpot().readDeals(rows.map((r) => r.deal_id));
      for (const d of deals) {
        await sql()`
          UPDATE hubspot_sync SET deal_stage = ${d.stage}, deal_amount = ${d.amount}, deal_is_won = ${d.isWon},
                                  deal_is_closed = ${d.isClosed}, stage_synced_at = now()
          WHERE deal_id = ${d.id}`;
        out.dealsSynced++;
      }
    } catch (err) {
      out.errors++;
      await logError("cron", `HubSpot stage sync failed: ${String((err as Error).message ?? err)}`);
    }
  }

  const stuck = (await sql()`
    SELECT id FROM calls
    WHERE (processing_status = 'failed' OR (processing_status IN ('received', 'processing') AND received_at < now() - interval '5 minutes'))
      AND received_at > now() - interval '3 days'
    ORDER BY received_at LIMIT 2`) as { id: string }[];
  for (const c of stuck) {
    await processCall(c.id);
    out.callsRetried++;
  }
  return Response.json({ ok: true, ...out });
}
