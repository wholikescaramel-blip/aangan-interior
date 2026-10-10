import { describe, expect, it } from "vitest";
import { toE164, last4 } from "../../lib/phone";
import { callbackWindowFor, fillPrompt, isBusinessHoursIST } from "../../lib/prompt";
import { containsPriceFigure } from "../../lib/price_guard";

describe("phone normalisation", () => {
  it.each([
    ["9876543210", "+919876543210"],
    ["09876543210", "+919876543210"],
    ["919876543210", "+919876543210"],
    ["+91 98765 43210", "+919876543210"],
    ["+91-98765-43210", "+919876543210"],
    ["0091 9876543210", "+919876543210"],
    ["(987) 654-3210", "+919876543210"],
    ["+14155550123", "+14155550123"],
  ])("%s -> %s", (input, out) => expect(toE164(input)).toBe(out));

  it.each([null, undefined, "", "anonymous", "withheld", "12345", "+12"])("rejects %s", (input) =>
    expect(toE164(input as string)).toBeNull(),
  );

  it("last4", () => {
    expect(last4("+919876543210")).toBe("3210");
    expect(last4(null)).toBe("");
  });
});

describe("business hours (Mon–Sat 10:00–19:00 IST)", () => {
  const ist = (s: string) => new Date(`${s}+05:30`);
  it.each([
    ["2026-10-10T10:00:00", true], // Saturday open
    ["2026-10-10T09:59:59", false],
    ["2026-10-10T18:59:59", true],
    ["2026-10-10T19:00:00", false],
    ["2026-10-11T12:00:00", false], // Sunday closed
    ["2026-10-12T02:00:00", false],
  ])("%s -> %s", (t, open) => expect(isBusinessHoursIST(ist(t))).toBe(open));

  it("one-hour callback only when the hour fits before closing", () => {
    const env = { CALLBACK_WINDOW_BUSINESS_HOURS: "within an hour", CALLBACK_WINDOW_AFTER_HOURS: "by eleven a.m. on the next working day" };
    expect(callbackWindowFor(ist("2026-10-12T11:00:00"), env)).toBe("within an hour");
    expect(callbackWindowFor(ist("2026-10-12T18:10:00"), env)).toBe("by eleven a.m. on the next working day");
    expect(callbackWindowFor(ist("2026-10-11T11:00:00"), env)).toBe("by eleven a.m. on the next working day");
  });
});

describe("prompt rendering", () => {
  const vars = { isBusinessHours: true, callbackWindow: "within an hour", callerNumberLast4: "3210", today: "Monday" };
  const tpl = "<!-- c -->Call {{CALLBACK_WINDOW}} ending {{CALLER_NUMBER_LAST4}}. {{#if APPROVED_PRICE_BAND_TEXT}}SAY: {{APPROVED_PRICE_BAND_TEXT}}{{else}}No numbers.{{/if}}";
  it("fills vars and strips comments", () => {
    expect(fillPrompt(tpl, vars)).toBe("Call within an hour ending 3210. No numbers.");
  });
  it("price sentence only when configured", () => {
    expect(fillPrompt(tpl, { ...vars, approvedPriceBandText: "X." })).toContain("SAY: X.");
  });
  it("the shipped v2 prompt renders with no leftover placeholders", async () => {
    const { renderAgentPrompt } = await import("../../lib/prompt");
    const out = renderAgentPrompt(vars, "v2");
    expect(out).not.toMatch(/\{\{/);
    expect(out).toContain("still no numbers at all");
  });
});

describe("price guard", () => {
  it.each([
    "That would be ₹1,800 per sq ft",
    "around 15 lakh",
    "Rs. 2000",
    "eighteen hundred rupees per square foot",
    "1800/sq ft",
    "लगभग 10 लाख",
    "do crore",
  ])("flags %s", (t) => expect(containsPriceFigure(t)).toBe(true));

  it.each([
    "So that's a 3BHK of about 1,400 sq ft in Kothrud.",
    "Roughly, is it closer to eight hundred or fifteen hundred square feet?",
    "Pricing depends on the site and what's included.",
    "Call me on 98765 43210",
  ])("allows %s", (t) => expect(containsPriceFigure(t)).toBe(false));
});
