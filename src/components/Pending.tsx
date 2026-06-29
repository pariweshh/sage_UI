import type { HeldAction } from '../api';

// Read-only by design. A held action is something Sage paused on at the
// confirmation gate; it is approved only by a spoken yes through the voice
// channel, never a button here. This panel mirrors, it does not act.
export function Pending({ held }: { held: HeldAction[] }) {
  return (
    <section className="card">
      <h2>Awaiting your decision</h2>
      {held.length === 0 ? (
        <p className="empty">Nothing waiting. Sage answers the gate by your spoken yes, not a button here.</p>
      ) : (
        <ul className="list">
          {held.map((h) => (
            <li key={h.id} className="held">
              <span className="held-tool">{h.tool}</span>
              <span className="held-action">{h.action}</span>
              <span className="held-note">approve by voice</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
