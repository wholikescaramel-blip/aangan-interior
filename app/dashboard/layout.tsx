import { isAuthed } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  if (!(await isAuthed())) {
    return (
      <main style={{ maxWidth: 360, margin: "15vh auto", padding: 16 }}>
        <h1 style={{ fontSize: 20 }}>Aangan intake dashboard</h1>
        <form method="post" action="/api/dashboard/login" style={{ display: "grid", gap: 8 }}>
          <input type="password" name="password" placeholder="Password" required autoFocus style={{ padding: 10, fontSize: 16 }} />
          <button type="submit" style={{ padding: 10, fontSize: 16 }}>Sign in</button>
        </form>
      </main>
    );
  }
  return <div style={{ maxWidth: 1100, margin: "0 auto", padding: 16 }}>{children}</div>;
}
