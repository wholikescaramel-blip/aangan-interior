/**
 * Normalise a phone number to E.164, defaulting to India (+91).
 * Returns null for anything that isn't a plausible number (withheld, "anonymous", too short).
 */
export function toE164(input: string | null | undefined): string | null {
  if (!input) return null;
  const raw = String(input).trim();
  const hasPlus = raw.startsWith("+");
  let digits = raw.replace(/\D/g, "");
  if (!digits) return null;

  if (!hasPlus && digits.startsWith("00")) return toE164("+" + digits.slice(2));
  if (hasPlus) return digits.length >= 8 && digits.length <= 15 ? "+" + digits : null;

  // Indian forms: 10-digit mobile, 0-prefixed, 91-prefixed.
  if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  if (digits.length === 10) return "+91" + digits;
  if (digits.length === 12 && digits.startsWith("91")) return "+" + digits;
  return null;
}

/** Last four digits, for the agent's "number ending ..." confirmation. */
export function last4(e164: string | null): string {
  return e164 ? e164.replace(/\D/g, "").slice(-4) : "";
}
