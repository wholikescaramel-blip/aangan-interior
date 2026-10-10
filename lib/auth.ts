import { createHmac } from "node:crypto";
import { cookies } from "next/headers";
import { safeEqual } from "./vaani";

export const SESSION_COOKIE = "aangan_dash";

/** Session value derived from the password, so changing DASHBOARD_PASSWORD logs everyone out. */
export function sessionToken(password = process.env.DASHBOARD_PASSWORD ?? ""): string {
  return createHmac("sha256", password).update("aangan-dashboard-v1").digest("hex");
}

export async function isAuthed(): Promise<boolean> {
  if (!process.env.DASHBOARD_PASSWORD) return false;
  const v = (await cookies()).get(SESSION_COOKIE)?.value;
  return !!v && safeEqual(v, sessionToken());
}
