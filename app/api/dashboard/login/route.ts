import { SESSION_COOKIE, sessionToken } from "@/lib/auth";
import { safeEqual } from "@/lib/vaani";

export async function POST(req: Request) {
  const form = await req.formData();
  const password = String(form.get("password") ?? "");
  const next = String(form.get("next") ?? "/dashboard");
  const expected = process.env.DASHBOARD_PASSWORD;
  const target = new URL(next.startsWith("/dashboard") ? next : "/dashboard", req.url);
  if (!expected || !safeEqual(password, expected)) {
    target.searchParams.set("error", "1");
    return Response.redirect(target, 303);
  }
  const res = Response.redirect(target, 303);
  const headers = new Headers(res.headers);
  headers.append("Set-Cookie", `${SESSION_COOKIE}=${sessionToken()}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${60 * 60 * 24 * 30}`);
  return new Response(null, { status: 303, headers });
}
