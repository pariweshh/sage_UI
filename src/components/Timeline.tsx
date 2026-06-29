import type { AuditRow } from '../api';

// The audit trail, newest first (ordered by the backend). Display only.
export function Timeline({ audit }: { audit: AuditRow[] }) {
  return (
    <section className="card timeline">
      <h2>Activity</h2>
      {audit.length === 0 ? (
        <p className="empty">No activity yet.</p>
      ) : (
        <ol className="list">
          {audit.map((r, i) => (
            <li key={`${r.ts}-${i}`} className="event">
              <time>{new Date(r.ts).toLocaleTimeString()}</time>
              <span className="event-name">{r.event}</span>
              {r.detail && <span className="event-detail">{r.detail}</span>}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
