/** DRY_RUN defaults to true: HubSpot writes are skipped and Telegram goes to the admin chat only. */
export const isDryRun = () => (process.env.DRY_RUN ?? "true").toLowerCase() !== "false";

export const sendNeedsReview = () => (process.env.SEND_NEEDS_REVIEW ?? "true").toLowerCase() !== "false";

export const appUrl = (path = "") => `${(process.env.APP_BASE_URL ?? "").replace(/\/$/, "")}${path}`;

export function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
}
