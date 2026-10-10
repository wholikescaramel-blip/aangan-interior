import { notFound } from "next/navigation";
import { sql } from "@/lib/db";
import { dealUrl } from "@/lib/hubspot";
import { formatIST } from "@/lib/telegram";

export default async function CallPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const rows = (await sql()`
    SELECT c.*, q.status, q.reasons, q.collected, q.missing_info, q.summary, q.suggested_next_step, q.not_a_lead_tag, q.error AS q_error,
           h.deal_id, ho.claimed_by, ho.claimed_at, ho.posted_at
    FROM calls c
    LEFT JOIN qualifications q ON q.call_id = c.id
    LEFT JOIN hubspot_sync h ON h.call_id = c.id
    LEFT JOIN handoffs ho ON ho.call_id = c.id
    WHERE c.id = ${id}`) as any[];
  const c = rows[0];
  if (!c) notFound();
  const errors = (await sql()`SELECT stage, message, created_at FROM errors WHERE call_id = ${id} ORDER BY created_at`) as any[];
  const when = c.started_at ?? c.received_at;
  const deal = dealUrl(c.deal_id);

  return (
    <main>
      <p><a href="/dashboard">← Dashboard</a></p>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>{c.collected?.name ?? "Unknown caller"} · {c.status ?? "not yet qualified"}</h1>
      <p style={{ color: "#666", marginTop: 0 }}>
        {formatIST(new Date(when))}{c.after_hours ? " · after hours" : ""} · {c.caller_number_e164 ?? "number withheld"} ·{" "}
        {c.duration_seconds ? `${Math.round(c.duration_seconds / 60 * 10) / 10} min` : "duration n/a"} · pipeline: {c.processing_status}
      </p>
      <p>
        {deal && <><a href={deal}>HubSpot deal</a> · </>}
        {c.recording_url && <><a href={c.recording_url}>Recording</a> · </>}
        {c.claimed_by ? `Taken by ${c.claimed_by} at ${formatIST(new Date(c.claimed_at))}` : c.posted_at ? "Posted, not yet claimed" : "Not posted to Telegram"}
      </p>
      {c.summary && <section><h2 style={{ fontSize: 16 }}>Summary</h2><p style={{ whiteSpace: "pre-wrap" }}>{c.summary}</p>
        <p><b>Next step:</b> {c.suggested_next_step}</p></section>}
      {c.reasons && <section><h2 style={{ fontSize: 16 }}>Reasons</h2><ul>{c.reasons.map((r: string, i: number) => <li key={i}>{r}</li>)}</ul></section>}
      {c.missing_info?.length > 0 && <p><b>Missing:</b> {c.missing_info.join(", ")}</p>}
      {c.collected && (
        <section>
          <h2 style={{ fontSize: 16 }}>Collected</h2>
          <table style={{ borderCollapse: "collapse" }}><tbody>
            {Object.entries(c.collected).map(([k, v]) => (
              <tr key={k}><td style={{ padding: "2px 12px 2px 0", color: "#666" }}>{k}</td><td>{v === null ? "—" : String(v)}</td></tr>
            ))}
          </tbody></table>
        </section>
      )}
      {errors.length > 0 && (
        <section><h2 style={{ fontSize: 16, color: "#a33" }}>Errors</h2>
          <ul>{errors.map((e, i) => <li key={i}>{formatIST(new Date(e.created_at))} · {e.stage}: {e.message}</li>)}</ul></section>
      )}
      <section>
        <h2 style={{ fontSize: 16 }}>Transcript</h2>
        <pre style={{ whiteSpace: "pre-wrap", background: "#fff", border: "1px solid #ddd", padding: 12, fontFamily: "inherit" }}>
          {c.transcript ?? "(no transcript)"}
        </pre>
      </section>
    </main>
  );
}
