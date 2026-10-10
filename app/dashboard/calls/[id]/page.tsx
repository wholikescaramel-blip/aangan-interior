import { notFound } from "next/navigation";
import { sql } from "@/lib/db";
import { dealUrl } from "@/lib/hubspot";
import { formatIST } from "@/lib/telegram";
import { Doodle, Footer, SectionTitle, StatusSticker, TopBar } from "../../../ui";

const LABELS: Record<string, string> = {
  name: "🙂 Name", phone: "📱 Phone", project_type: "🏠 Project", scope: "🛋️ Scope", location: "📍 Area",
  property_status: "🔑 Property", carpet_area_sqft: "📐 Carpet area", timeline: "🗓️ Timeline", budget: "👛 Budget",
  decision_maker: "🤝 Decides", source: "💌 Heard via", asked_about_pricing: "💬 Asked pricing",
};

/** Splits "Agent: …\nCaller: …" transcripts into bubbles; anything else is shown as one block. */
function toTurns(t: string | null): { who: "agent" | "caller" | "other"; text: string }[] {
  if (!t) return [];
  const turns: { who: "agent" | "caller" | "other"; text: string }[] = [];
  for (const line of t.split(/\n/)) {
    const m = line.match(/^\s*(agent|assistant|ai|bot|caller|user|customer)\s*:\s*(.*)$/i);
    if (m) turns.push({ who: /caller|user|customer/i.test(m[1]) ? "caller" : "agent", text: m[2] });
    else if (turns.length && line.trim()) turns[turns.length - 1].text += "\n" + line;
    else if (line.trim()) turns.push({ who: "other", text: line });
  }
  return turns;
}

export default async function CallPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const rows = (await sql()`
    SELECT c.*, q.status, q.reasons, q.collected, q.missing_info, q.summary, q.suggested_next_step, q.not_a_lead_tag,
           h.deal_id, ho.claimed_by, ho.claimed_at, ho.posted_at,
           (SELECT event_start_at FROM bookings b WHERE b.call_id = c.id AND b.status = 'active' ORDER BY booked_at DESC LIMIT 1) AS booked_for
    FROM calls c
    LEFT JOIN qualifications q ON q.call_id = c.id
    LEFT JOIN hubspot_sync h ON h.call_id = c.id
    LEFT JOIN handoffs ho ON ho.call_id = c.id
    WHERE c.id = ${id}`) as any[];
  const c = rows[0];
  if (!c) notFound();
  const errors = (await sql()`SELECT stage, message, created_at FROM errors WHERE call_id = ${id} ORDER BY created_at`) as any[];
  const when = new Date(c.started_at ?? c.received_at);
  const deal = dealUrl(c.deal_id);
  const turns = toTurns(c.transcript);
  const k = c.collected ?? {};

  return (
    <div className="wrap">
      <TopBar current="dashboard" />
      <p style={{ margin: "0 0 10px" }}><a href="/dashboard">← Back to the ledger</a></p>

      <div className="card arch" style={{ display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 320px" }}>
          <StatusSticker status={c.status} />
          <h1 style={{ marginTop: 10 }}>{k.name ?? "Unknown caller"}</h1>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
            <span className="chip">🕰️ {formatIST(when)}</span>
            {c.after_hours && <span className="chip">🌙 after hours</span>}
            <span className="chip">📱 {c.caller_number_e164 ?? "number withheld"}</span>
            {c.duration_seconds != null && <span className="chip">⏳ {Math.round((c.duration_seconds / 60) * 10) / 10} min</span>}
            {c.response_time_seconds != null && <span className="chip">⚡ answered in {Number(c.response_time_seconds)}s</span>}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 14 }}>
            {deal && <a className="btn" href={deal}>Open in HubSpot</a>}
            {c.recording_url && <a className="btn ghost" href={c.recording_url}>▶ Recording</a>}
          </div>
        </div>
        <div className="card" style={{ flex: "0 1 260px", background: "var(--surface-2)", boxShadow: "none" }}>
          <div className="muted" style={{ fontSize: 13 }}>Handover</div>
          <div style={{ fontWeight: 600, marginTop: 4 }}>
            {c.claimed_by ? `🙋 ${c.claimed_by}` : c.posted_at ? "⏳ Waiting for a designer" : "Not sent to the group"}
          </div>
          {c.claimed_at && <div className="faint" style={{ fontSize: 13 }}>claimed {formatIST(new Date(c.claimed_at))}</div>}
          {c.booked_for && <div style={{ marginTop: 8 }}>📅 Consultation {formatIST(new Date(c.booked_for))}</div>}
        </div>
      </div>

      {c.summary && (
        <>
          <SectionTitle emoji="📝">For the designer</SectionTitle>
          <div className="grid two">
            <div className="card">
              <p style={{ whiteSpace: "pre-wrap", marginTop: 0 }}>{c.summary}</p>
              <p style={{ marginBottom: 0 }}><b>Next step:</b> {c.suggested_next_step}</p>
              {c.missing_info?.length > 0 && <p className="muted" style={{ marginBottom: 0 }}>Still missing: {c.missing_info.join(", ")}</p>}
            </div>
            <div className="card">
              <h3 style={{ marginBottom: 8 }}>Why this outcome</h3>
              <ul style={{ margin: 0, paddingLeft: 18 }}>{(c.reasons ?? []).map((r: string, i: number) => <li key={i}>{r}</li>)}</ul>
            </div>
          </div>
        </>
      )}

      {c.collected && (
        <>
          <SectionTitle emoji="🧵">What we learned</SectionTitle>
          <div className="kv">
            {Object.entries(LABELS).map(([key, label]) => {
              const v = k[key];
              const shown = v === null || v === undefined ? "—" : typeof v === "boolean" ? (v ? "yes" : "no") : key === "carpet_area_sqft" ? `${Number(v).toLocaleString("en-IN")} sq ft` : String(v);
              return <div key={key}><div className="k">{label}</div><div className="v">{shown}</div></div>;
            })}
          </div>
        </>
      )}

      {errors.length > 0 && (
        <>
          <SectionTitle emoji="⚠️">Hiccups</SectionTitle>
          <div className="card">
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {errors.map((e, i) => <li key={i}><span className="faint">{formatIST(new Date(e.created_at))} · {e.stage}:</span> {e.message}</li>)}
            </ul>
          </div>
        </>
      )}

      <SectionTitle emoji="☎️">The conversation</SectionTitle>
      <div className="card">
        {turns.length ? (
          <div className="chat">
            {turns.map((t, i) =>
              t.who === "other" ? (
                <div key={i} className="faint" style={{ textAlign: "center", fontSize: 13, whiteSpace: "pre-wrap" }}>{t.text}</div>
              ) : (
                <div key={i} className={`bubble ${t.who}`}>
                  <span className="who">{t.who === "agent" ? "Aangan assistant" : "Caller"}</span>
                  {t.text}
                </div>
              ),
            )}
          </div>
        ) : (
          <div className="empty"><Doodle kind="lamp" size={80} /><p>No transcript for this call.</p></div>
        )}
      </div>
      <Footer />
    </div>
  );
}
