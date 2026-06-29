import type { Notice } from '../api';

interface Props {
  notices: Notice[];
  onDismiss: (id: number) => void;
}

// Notices are heartbeat output. Dismiss is the one write the UI may make, and it
// only acknowledges the notice (sets its flag) on the backend.
export function Notices({ notices, onDismiss }: Props) {
  return (
    <section className="card">
      <h2>Notices</h2>
      {notices.length === 0 ? (
        <p className="empty">Inbox clear.</p>
      ) : (
        <ul className="list">
          {notices.map((n) => (
            <li key={n.id} className={`notice sev-${n.severity}`}>
              <div className="notice-body">
                <span className="notice-top">
                  <span className="sev">{n.severity}</span>
                  <time>{new Date(n.createdAt).toLocaleString()}</time>
                </span>
                <span className="notice-msg">{n.message}</span>
              </div>
              <button type="button" className="dismiss" onClick={() => onDismiss(n.id)}>
                Dismiss
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
