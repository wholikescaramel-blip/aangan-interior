/**
 * Detects money figures and per-sq-ft rates in text that must never contain them
 * (agent speech, Telegram messages, AI summaries).
 * Area mentions such as "1,400 sq ft" or "fourteen hundred square feet" are allowed.
 */
const PATTERNS: RegExp[] = [
  /₹/,
  /\bINR\b/i,
  /\bRs\.?\s*\d/i,
  /\brupees?\b/i,
  /\brupaye?\b/i,
  /रुपय|रुपए|रुपये/,
  /\blakhs?\b|\blacs?\b|\blakh\b/i,
  /लाख/,
  /\bcrores?\b|करोड़/i,
  /\bper\s*(sq\.?\s*(ft|feet|foot)|square\s*(feet|foot|ft))\b/i,
  /\/\s*sq\.?\s*ft/i,
  /\bpsf\b/i,
  /\b\d+(\.\d+)?\s*k\b\s*(per|\/)/i,
];

export function findPriceFigures(text: string): string[] {
  const hits: string[] = [];
  for (const re of PATTERNS) {
    const m = text.match(re);
    if (m) hits.push(m[0]);
  }
  return hits;
}

export function containsPriceFigure(text: string): boolean {
  return findPriceFigures(text).length > 0;
}
