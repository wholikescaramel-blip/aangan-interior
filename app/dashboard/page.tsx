import { sql } from "@/lib/db";
import { formatIST } from "@/lib/telegram";

// Interim view: recent calls. The metrics dashboard (funnel, response times, costs) is built last.
export default async function Dashboard() {
  const calls = (await sql()`
    SELECT c.id, c.started_at, c.received_at, c.caller_number_e164, c.after_hours, c.processing_status,
           q.status, q.collected->>'name' AS name, ho.claimed_by,
           (SELECT count(*) FROM errors e WHERE e.call_id = c.id) AS error_count
    FROM calls c
    LEFT JOIN qualifications q ON q.call_id = c.id
    LEFT JOIN handoffs ho ON ho.call_id = c.id
    ORDER BY c.received_at DESC LIMIT 50`) as any[];
  return (
    <main>
      <h1 style={{ fontSize: 22 }}>Recent calls</h1>
      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 14 }}>
          <thead><tr style={{ textAlign: "left", borderBottom: "1px solid #ccc" }}>
            <th>When</th><th>Caller</th><th>Status</th><th>Claimed by</th><th>Pipeline</th><th>Errors</th>
          </tr></thead>
          <tbody>
            {calls.map((c) => (
              <tr key={c.id} style={{ borderBottom: "1px solid #eee" }}>
                <td><a href={`/dashboard/calls/${c.id}`}>{formatIST(new Date(c.started_at ?? c.received_at))}</a>{c.after_hours ? " 🌙" : ""}</td>
                <td>{c.name ?? "—"} {c.caller_number_e164 ? `· ${c.caller_number_e164}` : ""}</td>
                <td>{c.status ?? "—"}</td>
                <td>{c.claimed_by ?? "—"}</td>
                <td>{c.processing_status}</td>
                <td>{Number(c.error_count) || ""}</td>
              </tr>
            ))}
            {!calls.length && <tr><td colSpan={6} style={{ padding: 12, color: "#666" }}>No calls yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </main>
  );
}
