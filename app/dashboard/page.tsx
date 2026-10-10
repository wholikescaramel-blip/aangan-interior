import type { CSSProperties } from "react";
import { computeMetrics, costConfig, loadCalls } from "@/lib/metrics";
import { formatIST } from "@/lib/telegram";
import { BarList, HourColumns, RateGroups } from "../charts";
import { Doodle, Footer, SectionTitle, STATUS, STATUS_ORDER, StatusSticker, TopBar } from "../ui";

type SP = Promise<Record<string, string | string[] | undefined>>;

const istDay = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(d); // YYYY-MM-DD
const startIST = (ymd: string) => new Date(`${ymd}T00:00:00+05:30`);
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86400000);

function range(sp: Record<string, string | string[] | undefined>) {
  const preset = String(sp.range ?? (sp.from ? "custom" : "30d"));
  const today = istDay(new Date());
  const end = addDays(startIST(today), 1);
  if (preset === "custom" && sp.from) {
    const from = startIST(String(sp.from));
    const to = sp.to ? addDays(startIST(String(sp.to)), 1) : end;
    return { preset, from, to };
  }
  const days = { today: 1, "7d": 7, "30d": 30, "90d": 90 }[preset];
  if (days) return { preset, from: addDays(end, -days), to: end };
  if (preset === "month") return { preset, from: startIST(today.slice(0, 8) + "01"), to: end };
  return { preset: "all", from: new Date("2020-01-01T00:00:00+05:30"), to: end };
}

const inr = (n: number) =>
  n >= 1e7 ? `₹${(n / 1e7).toFixed(2)} Cr` : n >= 1e5 ? `₹${(n / 1e5).toFixed(1)} L` : `₹${Math.round(n).toLocaleString("en-IN")}`;
const pct = (v: number | null) => (v == null ? "—" : `${Math.round(v * 100)}%`);
const secs = (v: number | null) => (v == null ? "—" : v < 60 ? `${v.toFixed(1)}s` : `${(v / 60).toFixed(1)} min`);
const mins = (v: number | null) => (v == null ? "—" : v < 60 ? `${Math.round(v)} min` : v < 1440 ? `${(v / 60).toFixed(1)} h` : `${(v / 1440).toFixed(1)} days`);

export default async function Dashboard({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const { preset, from, to } = range(sp);
  const calls = await loadCalls(from, to);
  const m = computeMetrics(calls, from, to, costConfig());
  const presets: [string, string][] = [["today", "Today"], ["7d", "7 days"], ["30d", "30 days"], ["month", "This month"], ["90d", "90 days"], ["all", "All time"]];
  const target = m.claimedWithinHourPct;

  return (
    <div className="wrap">
      <TopBar current="dashboard" />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
        <div>
          <h1>The courtyard ledger</h1>
          <p className="muted" style={{ margin: 0 }}>Every call, who picked it up, and where it went. Numbers in IST.</p>
        </div>
        <form className="filters" method="get">
          {presets.map(([k, l]) => (
            <a key={k} className="pill" href={`?range=${k}`} aria-current={preset === k ? "true" : undefined}>{l}</a>
          ))}
          <input type="date" name="from" defaultValue={preset === "custom" ? istDay(from) : ""} aria-label="From" />
          <input type="date" name="to" defaultValue={preset === "custom" ? istDay(addDays(to, -1)) : ""} aria-label="To" />
          <button className="btn ghost" type="submit">Apply</button>
        </form>
      </div>

      {/* Hero: the key metric */}
      <div className="hero" style={{ marginTop: 22 }}>
        <div className="card arch" style={{ display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 240px" }}>
            <div className="muted" style={{ fontSize: 14 }}>⏱️ Time to first human response</div>
            <div className="hero-figure">{mins(m.claimMedianMin)}</div>
            <div className="muted" style={{ marginTop: 6 }}>
              median from lead posted → designer claimed ·{" "}
              <b style={{ color: "var(--ink)" }}>{pct(target)}</b> claimed within the 1-hour promise
            </div>
            <div className="faint" style={{ fontSize: 13, marginTop: 8 }}>
              The AI answers in {secs(m.responseMedian)} (median) · {secs(m.responseP90)} p90
            </div>
          </div>
          <span className="hide-sm"><Doodle kind="window" size={110} /></span>
        </div>
        <div className="grid tiles" style={{ gridTemplateColumns: "repeat(2, minmax(0,1fr))" }}>
          <Tile label="📞 Calls" value={m.total.toLocaleString("en-IN")} sub={`${pct(m.afterHoursPct)} after hours`} />
          <Tile label="✨ Sent to designers" value={(m.byStatus.qualified + m.byStatus.needs_review).toLocaleString("en-IN")} sub={`${m.byStatus.qualified} qualified · ${m.byStatus.needs_review} to review`} />
          <Tile label="🎯 Conversion" value={pct(m.conversion)} sub="sent to designers → won" />
          <Tile label="🏡 Won revenue" value={inr(m.wonValue)} sub={`${inr(m.openPipeline)} still open`} />
        </div>
      </div>

      <SectionTitle emoji="🧺">Who called</SectionTitle>
      <div className="grid two">
        <div className="card">
          <div className="card-head"><h3>Calls by outcome</h3><span className="faint">{m.total} total</span></div>
          <BarList
            tableHead={["Outcome", "Calls"]}
            items={[
              ...STATUS_ORDER.map((s) => ({
                key: s, value: m.byStatus[s], color: `var(--st-${s})`, note: STATUS[s].blurb,
                label: `${STATUS[s].emoji} ${STATUS[s].label}`,
              })),
              ...(m.byStatus.pending ? [{ key: "pending", label: "⏳ Pending", value: m.byStatus.pending, color: "var(--st-none)", note: "still being processed" }] : []),
            ]}
          />
        </div>
        <div className="card">
          <div className="card-head"><h3>Calls by hour</h3><span className="faint">{pct(m.afterHoursPct)} outside studio hours</span></div>
          <HourColumns counts={m.byHour} />
        </div>
      </div>

      <SectionTitle emoji="🪴">From hello to handover</SectionTitle>
      <div className="grid two">
        <div className="card">
          <div className="card-head"><h3>Funnel</h3><span className="faint">stages synced hourly from HubSpot</span></div>
          <BarList
            tableHead={["Stage", "Count"]}
            items={m.funnel.map((f, i) => ({
              key: f.key, label: f.label, value: f.value, color: `var(--f${i + 1})`,
              note: i && m.funnel[i - 1].value ? `${Math.round((f.value / m.funnel[i - 1].value) * 100)}% of ${m.funnel[i - 1].label.toLowerCase()}` : undefined,
            }))}
          />
        </div>
        <div className="card">
          <div className="card-head"><h3>Does a fast claim convert better?</h3><span className="faint">claimed leads by claim time</span></div>
          <RateGroups rows={m.bands} series={[{ name: "Booked a consult", color: "var(--f3)" }, { name: "Won", color: "var(--f5)" }]} />
        </div>
      </div>

      <SectionTitle emoji="🪙">What it costs</SectionTitle>
      <div className="grid tiles">
        <Tile label="Total cost" value={inr(m.cost.total)} sub={`Vaani ${inr(m.cost.vaani)} · Gemini ${inr(m.cost.gemini)} · fixed ${inr(m.cost.fixed)}`} />
        <Tile label="Per call" value={m.cost.perCall == null ? "—" : inr(m.cost.perCall)} sub="all-in" />
        <Tile label="Per month" value={inr(m.cost.perMonth)} sub="at this range's pace" />
        <Tile label="Per qualified lead" value={m.cost.perQualified == null ? "—" : inr(m.cost.perQualified)} />
        <Tile label="Won revenue ÷ cost" value={m.cost.roi == null ? "—" : m.cost.roi >= 100 ? `${Math.round(m.cost.roi).toLocaleString("en-IN")}×` : `${m.cost.roi.toFixed(1)}×`} sub="the success metric" />
      </div>

      <SectionTitle emoji="📒" aside={<span className="faint" style={{ fontSize: 13 }}>{calls.length > 40 ? "latest 40" : ""}</span>}>Recent calls</SectionTitle>
      <div className="card" style={{ padding: 0 }}>
        {calls.length ? (
          <div className="table-wrap">
            <table className="t">
              <thead><tr><th>When</th><th>Caller</th><th>Outcome</th><th>Picked up by</th><th>Links</th><th className="r">Hiccups</th></tr></thead>
              <tbody>
                {calls.slice(0, 40).map((c) => (
                  <tr key={c.id}>
                    <td className="num" style={{ whiteSpace: "nowrap" }}>{formatIST(c.at).replace(" IST", "")}{c.afterHours ? " 🌙" : ""}</td>
                    <td><b>{c.name ?? "Unknown"}</b><div className="faint" style={{ fontSize: 12 }}>{c.callerNumber ?? "number withheld"}</div></td>
                    <td><StatusSticker status={c.status} /></td>
                    <td style={{ whiteSpace: "nowrap" }}>{c.claimedBy ? `🙋 ${c.claimedBy}` : c.postedAt ? <span className="faint">waiting…</span> : <span className="faint">—</span>}{c.booked ? <span title="consultation booked"> · 📅</span> : ""}</td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <a href={`/dashboard/calls/${c.id}`}>Transcript</a>
                      {c.recordingUrl && <> · <a href={c.recordingUrl}>Recording</a></>}
                    </td>
                    <td className="r">{c.errorCount ? <span title="see the call page">⚠️ {c.errorCount}</span> : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty">
            <Doodle kind="chair" size={96} />
            <h3 style={{ marginTop: 8 }}>The courtyard is quiet</h3>
            <p className="muted">No calls in this range yet. Once Vaani is connected, every call lands here.</p>
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string; style?: CSSProperties }) {
  return (
    <div className="tile">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {sub && <div className="sub">{sub}</div>}
    </div>
  );
}
