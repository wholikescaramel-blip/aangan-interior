"use client";

import { useRef, useState, type ReactNode } from "react";

type Tip = { x: number; y: number; text: ReactNode } | null;

function useTip() {
  const ref = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<Tip>(null);
  const show = (e: React.MouseEvent | React.FocusEvent, text: ReactNode) => {
    const box = ref.current?.getBoundingClientRect();
    const target = (e.currentTarget as HTMLElement).getBoundingClientRect();
    if (!box) return;
    const mx = "clientX" in e && e.clientX ? e.clientX : target.left + target.width / 2;
    setTip({ x: mx - box.left, y: target.top - box.top, text });
  };
  const node = tip ? <div className="tooltip" style={{ left: tip.x, top: tip.y }}>{tip.text}</div> : null;
  return { ref, show, hide: () => setTip(null), node };
}

function AsTable({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <details className="as-table">
      <summary>See as table</summary>
      <table className="t">
        <thead><tr>{head.map((h, i) => <th key={h} className={i ? "r" : ""}>{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className={j ? "r num" : ""}>{c}</td>)}</tr>)}</tbody>
      </table>
    </details>
  );
}

export interface BarItem { key: string; label: ReactNode; value: number; color: string; note?: string; display?: string }

/** Horizontal bars from one baseline: label, bar (<=24px, rounded data end), value at the tip. */
export function BarList({ items, tableHead, valueSuffix = "" }: { items: BarItem[]; tableHead: [string, string]; valueSuffix?: string }) {
  const { ref, show, hide, node } = useTip();
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="chart" ref={ref}>
      <div style={{ display: "grid", gap: 10 }}>
        {items.map((it) => {
          const pct = (it.value / max) * 100;
          const shown = it.display ?? `${it.value.toLocaleString("en-IN")}${valueSuffix}`;
          return (
            <div key={it.key} style={{ display: "grid", gridTemplateColumns: "minmax(110px, 34%) 1fr", gap: 10, alignItems: "center" }}>
              <div style={{ fontSize: 14, color: "var(--ink-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.label}</div>
              <div
                tabIndex={0}
                onMouseMove={(e) => show(e, <><b>{shown}</b>{it.note ? ` · ${it.note}` : ""}</>)}
                onFocus={(e) => show(e, <><b>{shown}</b>{it.note ? ` · ${it.note}` : ""}</>)}
                onMouseLeave={hide}
                onBlur={hide}
                style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 28, outline: "none", cursor: "default" }}
              >
                <div style={{ width: `${Math.max(pct, it.value > 0 ? 1.5 : 0)}%`, height: 22, background: it.color, borderRadius: "0 4px 4px 0", transition: "width .5s ease" }} />
                <span className="num" style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap" }}>{shown}</span>
              </div>
            </div>
          );
        })}
      </div>
      {node}
      <AsTable head={tableHead} rows={items.map((i) => [typeof i.label === "string" ? i.label : i.key, i.display ?? i.value])} />
    </div>
  );
}

/** 24 columns for hour-of-day (IST), with the 10:00–19:00 business band shaded. */
export function HourColumns({ counts }: { counts: number[] }) {
  const { ref, show, hide, node } = useTip();
  const W = 720, H = 200, pad = { l: 28, r: 6, t: 12, b: 26 };
  const max = Math.max(1, ...counts);
  const step = Math.max(1, Math.ceil(max / 4));
  const top = step * Math.ceil(max / step);
  const bw = (W - pad.l - pad.r) / 24;
  const y = (v: number) => pad.t + (H - pad.t - pad.b) * (1 - v / top);
  const label = (h: number) => `${((h + 11) % 12) + 1}${h < 12 ? "am" : "pm"}`;
  const ticks = Array.from({ length: Math.floor(top / step) + 1 }, (_, i) => i * step);
  return (
    <div className="chart" ref={ref}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Calls by hour of day">
        <rect x={pad.l + bw * 10} y={pad.t} width={bw * 9} height={H - pad.t - pad.b} fill="var(--band)" rx="6" />
        <text x={pad.l + bw * 14.5} y={pad.t + 12} textAnchor="middle" className="axis">studio hours</text>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} className="grid-line" />
            <text x={pad.l - 6} y={y(t) + 4} textAnchor="end" className="axis">{t}</text>
          </g>
        ))}
        {counts.map((c, h) => {
          const bwInner = Math.min(18, bw - 4);
          const x = pad.l + bw * h + (bw - bwInner) / 2;
          const yh = y(c);
          const hgt = H - pad.b - yh;
          return (
            <g key={h}>
              {c > 0 && <path d={`M${x},${H - pad.b} V${yh + 4} q0,-4 4,-4 h${bwInner - 8} q4,0 4,4 V${H - pad.b} z`} fill="var(--bar)" />}
              <rect x={pad.l + bw * h} y={pad.t} width={bw} height={H - pad.t - pad.b} fill="transparent"
                onMouseMove={(e) => show(e, <><b>{c}</b> call{c === 1 ? "" : "s"} · {label(h)}–{label((h + 1) % 24)}</>)} onMouseLeave={hide} />
              {h % 3 === 0 && <text x={pad.l + bw * h + bw / 2} y={H - 8} textAnchor="middle" className="axis">{label(h)}</text>}
              {hgt < 0 && null}
            </g>
          );
        })}
      </svg>
      {node}
      <AsTable head={["Hour (IST)", "Calls"]} rows={counts.map((c, h) => [`${label(h)}–${label((h + 1) % 24)}`, c]).filter((r) => r[1] !== 0)} />
    </div>
  );
}

export interface GroupRow { label: string; n: number; values: number[] } // values as 0..1 rates

/** Grouped bars of rates (one shared % axis) with a legend. */
export function RateGroups({ rows, series }: { rows: GroupRow[]; series: { name: string; color: string }[] }) {
  const { ref, show, hide, node } = useTip();
  return (
    <div className="chart" ref={ref}>
      <div style={{ display: "grid", gap: 14 }}>
        {rows.map((r) => (
          <div key={r.label}>
            <div style={{ fontSize: 13, color: "var(--ink-2)", marginBottom: 4 }}>
              <b style={{ color: "var(--ink)" }}>{r.label}</b> <span className="faint">· {r.n} lead{r.n === 1 ? "" : "s"}</span>
            </div>
            {series.map((s, i) => {
              const v = r.values[i];
              const txt = r.n ? `${Math.round(v * 100)}%` : "—";
              return (
                <div key={s.name} tabIndex={0} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2, outline: "none" }}
                  onMouseMove={(e) => show(e, <>{s.name}: <b>{txt}</b> of {r.n}</>)} onMouseLeave={hide}
                  onFocus={(e) => show(e, <>{s.name}: <b>{txt}</b> of {r.n}</>)} onBlur={hide}>
                  <div style={{ width: `${Math.max(v * 100, v > 0 ? 1.5 : 0)}%`, height: 14, background: s.color, borderRadius: "0 4px 4px 0", transition: "width .5s" }} />
                  <span className="num" style={{ fontSize: 12, fontWeight: 600 }}>{txt}</span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <div className="legend">{series.map((s) => <span key={s.name}><i style={{ background: s.color }} />{s.name}</span>)}</div>
      {node}
      <AsTable head={["Claimed within", "Leads", ...series.map((s) => s.name)]}
        rows={rows.map((r) => [r.label, r.n, ...r.values.map((v) => (r.n ? `${Math.round(v * 100)}%` : "—"))])} />
    </div>
  );
}
