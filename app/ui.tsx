import type { CSSProperties, ReactNode } from "react";

export type Status = "qualified" | "needs_review" | "not_qualified" | "not_a_lead";

export const STATUS: Record<Status, { label: string; emoji: string; blurb: string }> = {
  qualified: { label: "Qualified", emoji: "🌿", blurb: "ready for a designer" },
  needs_review: { label: "Needs review", emoji: "🪔", blurb: "worth a closer look" },
  not_qualified: { label: "Not a fit", emoji: "🍂", blurb: "politely declined" },
  not_a_lead: { label: "Not a lead", emoji: "📦", blurb: "vendors, wrong numbers, clients" },
};
export const STATUS_ORDER: Status[] = ["qualified", "needs_review", "not_qualified", "not_a_lead"];

export function StatusSticker({ status }: { status: string | null }) {
  const s = status && status in STATUS ? STATUS[status as Status] : null;
  const c = s ? `var(--st-${status})` : "var(--st-none)";
  return (
    <span className="sticker" style={{ "--c": c } as CSSProperties}>
      <span className="dot" aria-hidden /> {s ? `${s.emoji} ${s.label}` : "⏳ Pending"}
    </span>
  );
}

/** Arch window with a little plant: the Aangan mark. */
export function ArchLogo({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <path d="M8 44V22a16 16 0 0 1 32 0v22z" fill="var(--accent-soft)" stroke="var(--accent)" strokeWidth="2.5" />
      <path d="M14 44V23a10 10 0 0 1 20 0v21" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeDasharray="2 3" />
      <path d="M24 41c0-7 0-10-5-14M24 41c0-6 1-9 6-12" stroke="var(--st-qualified)" strokeWidth="2" fill="none" strokeLinecap="round" />
      <ellipse cx="18.5" cy="26.5" rx="3.6" ry="2" transform="rotate(-35 18.5 26.5)" fill="var(--st-qualified)" />
      <ellipse cx="30" cy="28.5" rx="3.6" ry="2" transform="rotate(30 30 28.5)" fill="var(--st-qualified)" />
      <path d="M19 41h10l-1.5 4h-7z" fill="var(--brass)" />
    </svg>
  );
}

export function TopBar({ current }: { current: "home" | "dashboard" }) {
  return (
    <header className="topbar">
      <a href="/" className="brand">
        <ArchLogo />
        <span>
          <div className="brand-name">Aangan Studio</div>
          <div className="brand-tag">enquiry courtyard</div>
        </span>
      </a>
      <nav className="nav">
        <a href="/" aria-current={current === "home" ? "page" : undefined}>Home</a>
        <a href="/dashboard" aria-current={current === "dashboard" ? "page" : undefined}>Dashboard</a>
      </nav>
    </header>
  );
}

/** Small decorative doodles: lamp, plant, armchair, rug. */
export function Doodle({ kind, size = 72, style }: { kind: "lamp" | "plant" | "chair" | "rug" | "window"; size?: number; style?: CSSProperties }) {
  const common = { width: size, height: size, viewBox: "0 0 80 80", "aria-hidden": true, style };
  const stroke = { stroke: "var(--ink)", strokeWidth: 2, fill: "none", strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (kind) {
    case "lamp":
      return (
        <svg {...common}>
          <path d="M26 30l8-18h12l8 18z" fill="var(--st-needs_review)" opacity=".85" />
          <path d="M26 30l8-18h12l8 18z" {...stroke} />
          <path d="M40 30v34M30 66h20" {...stroke} />
          <circle cx="40" cy="36" r="3" fill="var(--brass)" />
        </svg>
      );
    case "plant":
      return (
        <svg {...common}>
          <path d="M28 52h24l-3 18H31z" fill="var(--accent)" opacity=".85" />
          <path d="M28 52h24l-3 18H31z" {...stroke} />
          <path d="M40 52V24M40 40c-8-2-12-8-12-14 6 0 11 4 12 10M40 34c6-2 10-7 10-13-6 0-10 4-10 9" {...stroke} />
          <path d="M40 40c-8-2-12-8-12-14 6 0 11 4 12 10z M40 34c6-2 10-7 10-13-6 0-10 4-10 9z" fill="var(--st-qualified)" opacity=".7" />
        </svg>
      );
    case "chair":
      return (
        <svg {...common}>
          <path d="M18 40c0-14 8-22 22-22s22 8 22 22v8H18z" fill="var(--st-not_a_lead)" opacity=".75" />
          <path d="M18 40c0-14 8-22 22-22s22 8 22 22v8H18z" {...stroke} />
          <path d="M12 44h8v14h40V44h8v18H12z" fill="var(--accent-soft)" />
          <path d="M12 44h8v14h40V44h8v18H12zM18 62v6M62 62v6" {...stroke} />
        </svg>
      );
    case "rug":
      return (
        <svg {...common}>
          <rect x="12" y="22" width="56" height="36" rx="4" fill="var(--accent-soft)" />
          <rect x="12" y="22" width="56" height="36" rx="4" {...stroke} />
          <path d="M40 28l10 12-10 12-10-12z" fill="var(--st-needs_review)" opacity=".8" />
          <path d="M6 26h6M6 32h6M6 38h6M6 44h6M6 50h6M6 56h6M68 26h6M68 32h6M68 38h6M68 44h6M68 50h6M68 56h6" stroke="var(--ink-3)" strokeWidth="1.5" />
        </svg>
      );
    case "window":
      return (
        <svg {...common}>
          <path d="M18 72V36a22 22 0 0 1 44 0v36z" fill="var(--leaf-soft)" />
          <path d="M18 72V36a22 22 0 0 1 44 0v36zM40 14v58M18 46h44" {...stroke} />
          <circle cx="52" cy="28" r="4" fill="var(--st-needs_review)" />
        </svg>
      );
  }
}

export function SectionTitle({ emoji, children, aside }: { emoji: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="section-title">
      <span aria-hidden style={{ fontSize: 22 }}>{emoji}</span>
      <h2>{children}</h2>
      <span className="rule" />
      {aside}
    </div>
  );
}

export function Footer() {
  return <footer className="footer">Made with chai & care for Aangan Studio, Pune · every call, beautifully handled 🪴</footer>;
}
