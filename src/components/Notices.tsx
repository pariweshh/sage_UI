import type { Notice } from '../api';

interface Props {
  notices: Notice[];
  onDismiss: (id: number) => void;
  /** Open a vault note mentioned in a notice (e.g. a finished skill run's brief). */
  onOpenNote?: (path: string) => void;
}

// A notice that mentions a vault note (skill runs link their output) gets an
// inline open affordance; purely a read, like clicking the Vault panel.
const NOTE_PATH_RE = /(?:Inbox|Daily|Briefs|Knowledge|Projects|System)\/[A-Za-z0-9._/-]+/;

// Notices are heartbeat output. Dismiss is the one write the UI may make, and it
// only acknowledges the notice (sets its flag) on the backend.
export function Notices({ notices, onDismiss, onOpenNote }: Props) {
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
                {onOpenNote && NOTE_PATH_RE.test(n.message) && (
                  <button
                    type="button"
                    className="wikilink notice-note"
                    onClick={() => onOpenNote((NOTE_PATH_RE.exec(n.message) as RegExpExecArray)[0])}
                  >
                    open note
                  </button>
                )}
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
