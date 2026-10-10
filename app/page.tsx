import { sql } from "@/lib/db";
import { ArchLogo, Doodle, Footer, TopBar } from "./ui";

export const dynamic = "force-dynamic";

async function todayCounts() {
  try {
    const r = (await sql()`
      SELECT count(*)::int AS calls,
             count(*) FILTER (WHERE q.status IN ('qualified','needs_review'))::int AS leads,
             count(ho.claimed_at)::int AS claimed
      FROM calls c
      LEFT JOIN qualifications q ON q.call_id = c.id
      LEFT JOIN handoffs ho ON ho.call_id = c.id
      WHERE c.processing_status <> 'ignored'
        AND COALESCE(c.started_at, c.received_at) >= (date_trunc('day', now() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata')`) as any[];
    return r[0] as { calls: number; leads: number; claimed: number };
  } catch {
    return null;
  }
}

const STEPS = [
  { doodle: "window" as const, title: "Someone rings", text: "Day or night, in English, Hindi or Hinglish. Our AI assistant says namaste and listens." },
  { doodle: "rug" as const, title: "A gentle chat", text: "Home or office, which area, how big, by when. One question at a time, never a price." },
  { doodle: "plant" as const, title: "Sorted with care", text: "The studio's own rules decide: ready for a designer, worth a look, or not quite a fit." },
  { doodle: "lamp" as const, title: "A designer says “mine!”", text: "Good leads pop into Telegram. First tap claims it, and a callback follows within the hour." },
];

export default async function Home() {
  const today = await todayCounts();
  return (
    <div className="wrap">
      <TopBar current="home" />

      <section className="card arch" style={{ display: "grid", gridTemplateColumns: "minmax(0,1.3fr) minmax(0,1fr)", gap: 24, alignItems: "center", padding: "48px 28px 28px" }}>
        <div>
          <span className="chip">🪔 Aangan Studio · Pune</span>
          <h1 style={{ fontSize: "clamp(34px, 5vw, 54px)", marginTop: 14 }}>
            Every call, <span style={{ color: "var(--accent)", fontStyle: "italic" }}>beautifully</span> handled.
          </h1>
          <p className="muted" style={{ fontSize: 17, maxWidth: 520 }}>
            This is the studio’s enquiry courtyard: where every phone call is welcomed, understood, and passed to a designer
            who’ll love working on it.
          </p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 18 }}>
            <a className="btn" href="/dashboard">Open the dashboard →</a>
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "center", alignItems: "flex-end", gap: 4, minHeight: 180 }} aria-hidden>
          <Doodle kind="plant" size={96} />
          <div style={{ display: "grid", placeItems: "center" }}>
            <ArchLogo size={150} />
          </div>
          <Doodle kind="chair" size={110} />
        </div>
      </section>

      {today && (
        <div className="grid tiles" style={{ marginTop: 16 }}>
          <div className="tile"><div className="label">📞 Calls today</div><div className="value">{today.calls}</div></div>
          <div className="tile"><div className="label">✨ Leads today</div><div className="value">{today.leads}</div></div>
          <div className="tile"><div className="label">🙋 Claimed today</div><div className="value">{today.claimed}</div></div>
        </div>
      )}

      <div className="section-title"><span aria-hidden style={{ fontSize: 22 }}>🧭</span><h2>How a call travels</h2><span className="rule" /></div>
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        {STEPS.map((s, i) => (
          <div key={s.title} className="card" style={{ position: "relative" }}>
            <span className="chip" style={{ position: "absolute", top: 14, right: 14 }}>{i + 1}</span>
            <Doodle kind={s.doodle} size={68} />
            <h3 style={{ marginTop: 6 }}>{s.title}</h3>
            <p className="muted" style={{ marginBottom: 0 }}>{s.text}</p>
          </div>
        ))}
      </div>
      <Footer />
    </div>
  );
}
