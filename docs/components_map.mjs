// Generates docs/aangan_components_map_v2.svg (the as-built components map). Run: node docs/components_map.mjs
import { writeFileSync } from "node:fs";

const W = 2000, top = 88, hdr = 52, rowH = 112, actorW = 238, colW = (W - 20 - actorW) / 6;
const cols = ["Trigger", "Input", "Context", "Processing", "AI", "Output"];
const rows = [
  ["Caller", "Customer", "#eef0ff"], ["Vaani", "Voice agent", "#e8f2fd"], ["Knowledge files", "Context", "#e8f6ec"],
  ["Vercel backend", "Next.js API", "#eef2f6"], ["Gemini", "Qualification", "#fff7dc"], ["Neon database", "Records", "#e7f6f2"],
  ["Telegram", "Handoff", "#e8f2fd"], ["HubSpot", "CRM", "#fff0e8"], ["Cal.com", "Booking", "#f3ecfb"], ["Dashboard", "Nikhil's numbers", "#fbf3e6"],
];
const H = top + hdr + rows.length * rowH + 120;
const cx = (c) => 10 + actorW + colW * c + colW / 2;
const ry = (r) => top + hdr + rowH * r;
const box = { w: 262, h: 86 };
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

const boxes = {
  caller: { r: 0, c: 0, fill: "#e3e5ff", stroke: "#5b5fd6", lines: ["Calls the studio number", "Any hour, day or night", "English, Hindi or Hinglish"] },
  vaani: { r: 1, c: 1, fill: "#d6e8fc", stroke: "#3a7fd5", lines: ["Answers in seconds, says it is AI", "Asks qualifying questions, one at a time", "Never quotes a price (the Cut)"] },
  know: { r: 2, c: 2, fill: "#d3f0dc", stroke: "#2fa65a", lines: ["services.md, qualified.md", "→ qualification_rules.md (approved)", "pricing.md internal: never sent to AI"] },
  vercel: { r: 3, c: 3, fill: "#dde4ec", stroke: "#5f7790", lines: ["Receives call-end webhook (token)", "Ignores duplicates, saves the call", "Response time + after-hours flag"] },
  gemini: { r: 4, c: 4, fill: "#ffefb6", stroke: "#d9a400", lines: ["Reads transcript against the rules", "Status, reasons, summary, missing info", "Free-model fallback · no-₹ guard"] },
  neon: { r: 5, c: 5, fill: "#d2efe7", stroke: "#1f9e86", lines: ["Stores every call, verdict,", "claim, booking and error", "Idempotent on call id"] },
  tg: { r: 6, c: 5, fill: "#d6e8fc", stroke: "#3a7fd5", lines: ["Lead card to designers' group", "“I'll take it”: first tap wins", "Qualified + needs review only"] },
  hub: { r: 7, c: 5, fill: "#ffe2d1", stroke: "#e0733a", lines: ["Contact (dedupe by phone) + call log", "Deal for leads; stage on claim/booking", "Won / lost set by people only"] },
  calTrig: { r: 8, c: 0, fill: "#ebdcfa", stroke: "#8a55c9", lines: ["Designer sends booking link", "Client books a consultation", "(phone number required)"] },
  cal: { r: 8, c: 3, fill: "#ebdcfa", stroke: "#8a55c9", lines: ["Signed booking webhook", "Match by phone, then email", "→ Consult booked + group note"] },
  cron: { r: 9, c: 3, fill: "#f6e7cf", stroke: "#b9823a", lines: ["Hourly job (GitHub Actions)", "Sync deal stages and won value", "Retry any failed call"] },
  dash: { r: 9, c: 5, fill: "#f6e7cf", stroke: "#b9823a", lines: ["/dashboard: time to first response,", "funnel, claim-time conversion,", "cost per call / lead, revenue ÷ cost"] },
};
const pos = (k) => ({ x: cx(boxes[k].c) - box.w / 2, y: ry(boxes[k].r) + (rowH - box.h) / 2 });
const port = (k, side) => {
  const p = pos(k);
  if (side === "r") return [p.x + box.w, p.y + box.h / 2];
  if (side === "l") return [p.x, p.y + box.h / 2];
  if (side === "b") return [p.x + box.w / 2, p.y + box.h];
  return [p.x + box.w / 2, p.y];
};

let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="DejaVu Sans, Segoe UI, Arial, sans-serif">
<defs><marker id="a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#6b7280"/></marker></defs>
<rect width="${W}" height="${H}" fill="#fff"/>
<text x="${W / 2}" y="50" text-anchor="middle" font-size="26" font-weight="700" fill="#111">Aangan Studio  |  Phase 1: First Reach-out  |  Components Map (as built)</text>
<rect x="10" y="${top}" width="${W - 20}" height="${hdr}" fill="#1d2335"/>
<text x="${10 + actorW / 2}" y="${top + 33}" text-anchor="middle" font-size="17" font-weight="700" fill="#fff">Actor</text>`;
cols.forEach((c, i) => (svg += `<text x="${cx(i)}" y="${top + 33}" text-anchor="middle" font-size="17" font-weight="700" fill="#fff">${c}</text>`));
rows.forEach(([name, sub, bg], r) => {
  svg += `<rect x="${10 + actorW}" y="${ry(r)}" width="${W - 20 - actorW}" height="${rowH}" fill="${bg}"/>
<rect x="10" y="${ry(r)}" width="${actorW}" height="${rowH}" fill="#1d2335"/>
<line x1="10" x2="${10 + actorW}" y1="${ry(r)}" y2="${ry(r)}" stroke="#2c3550"/>
<text x="${10 + actorW / 2}" y="${ry(r) + rowH / 2}" text-anchor="middle" font-size="16" font-weight="700" fill="#fff">${esc(name)}</text>
<text x="${10 + actorW / 2}" y="${ry(r) + rowH / 2 + 22}" text-anchor="middle" font-size="12" fill="#9aa3b5">${esc(sub)}</text>`;
});
for (let i = 1; i < 6; i++)
  svg += `<line x1="${10 + actorW + colW * i}" x2="${10 + actorW + colW * i}" y1="${top + hdr}" y2="${ry(rows.length)}" stroke="#fff" stroke-width="1.5" opacity=".7"/>`;

const path = (pts, label) => {
  svg += `<path d="M${pts.map((p) => p.join(",")).join(" L")}" fill="none" stroke="#6b7280" stroke-width="1.8" stroke-dasharray="7 5" marker-end="url(#a)"/>`;
  svg += `<circle cx="${pts[0][0]}" cy="${pts[0][1]}" r="4.5" fill="#22c55e"/>`;
  if (label) svg += `<text x="${label[0]}" y="${label[1]}" font-size="11.5" fill="#4b5563" font-style="italic">${esc(label[2])}</text>`;
};

const cb = port("caller", "b"), vt = port("vaani", "t");
path([cb, [cb[0], cb[1] + 14], [vt[0], cb[1] + 14], vt]);
const vr = port("vaani", "r"), vct = port("vercel", "t");
path([vr, [vct[0], vr[1]], vct], [vr[0] + 18, vr[1] - 8, "call_started + call_postprocessing"]);
const kr = port("know", "r"), gt = port("gemini", "t");
path([kr, [gt[0], kr[1]], gt]);
const vb = port("vercel", "b"), gl = port("gemini", "l");
path([vb, [vb[0], gl[1]], gl]);
const gr = port("gemini", "r"), busX = gr[0] + 22;
for (const k of ["neon", "tg", "hub"]) { const l = port(k, "l"); path([gr, [busX, gr[1]], [busX, l[1]], l]); }
const tb = port("tg", "b"), ht = port("hub", "t");
path([[tb[0] + 70, tb[1]], [ht[0] + 70, ht[1]]], [tb[0] - 120, tb[1] + 16, "claim → Designer contacted"]);
const tl = port("tg", "l"), ctt = port("calTrig", "t");
path([[tl[0], tl[1] + 22], [ctt[0], tl[1] + 22], ctt], [ctt[0] + 12, tl[1] + 16, "designer claims and calls back"]);
const ctr = port("calTrig", "r"), cl = port("cal", "l");
path([ctr, cl]);
const cr = port("cal", "r"), hl = port("hub", "l");
path([cr, [cr[0] + 130, cr[1]], [cr[0] + 130, hl[1] + 26], [hl[0], hl[1] + 26]], [cr[0] + 12, cr[1] - 8, "→ Consult booked"]);
const cronR = port("cron", "r"), dl = port("dash", "l");
path([cronR, dl], [cronR[0] + 14, cronR[1] - 8, "stages + won value"]);
const nr = port("neon", "r"), dr = port("dash", "r");
path([nr, [nr[0] + 9, nr[1]], [nr[0] + 9, dr[1]], dr]);

for (const [k, b] of Object.entries(boxes)) {
  const p = pos(k);
  svg += `<rect x="${p.x}" y="${p.y}" width="${box.w}" height="${box.h}" rx="9" fill="${b.fill}" stroke="${b.stroke}" stroke-width="2"/>`;
  b.lines.forEach((t, i) => (svg += `<text x="${p.x + box.w / 2}" y="${p.y + 27 + i * 19}" text-anchor="middle" font-size="12.5" fill="#1f2937">${esc(t)}</text>`));
}
const fy = ry(rows.length) + 34;
svg += `<text x="${W / 2}" y="${fy}" text-anchor="middle" font-size="14" font-style="italic" fill="#374151">Built and live: Vaani → Vercel → Gemini → Neon → Telegram, plus HubSpot, Cal.com and the dashboard. Every enquiry is a channel-agnostic “Enquiry”.</text>
<text x="${W / 2}" y="${fy + 26}" text-anchor="middle" font-size="14" font-style="italic" fill="#374151">Next phases (not built): unclaimed-lead escalation, reassignment, designer routing. WhatsApp and web form plug in as new Enquiry adapters.</text>
<text x="${W / 2}" y="${fy + 52}" text-anchor="middle" font-size="13" fill="#6b7280">Live: aangan-interior.vercel.app  ·  Repo: github.com/wholikescaramel-blip/aangan-interior</text></svg>`;

writeFileSync(new URL("./aangan_components_map_v2.svg", import.meta.url), svg);
console.log("wrote docs/aangan_components_map_v2.svg", W, H);
