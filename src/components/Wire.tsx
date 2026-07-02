import { useEffect, useState } from 'react';
import { fetchWireItems, type WireItemData } from '../api';

const WIRE_POLL_MS = 5 * 60_000; // the backend caches for ten minutes anyway

function age(publishedAt: number | null): string {
  if (publishedAt === null) return '';
  const minutes = Math.round((Date.now() - publishedAt) / 60_000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

// The AI wire: headlines from the configured feeds. Read-only; clicking a
// headline opens the source in a new tab (never inside the HUD).
export function Wire() {
  const [items, setItems] = useState<WireItemData[] | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    const load = async () => {
      try {
        setItems(await fetchWireItems(ctrl.signal));
      } catch {
        // Poll again next tick; the app-level banner reports a dead link.
      }
    };
    void load();
    const id = window.setInterval(() => void load(), WIRE_POLL_MS);
    return () => {
      ctrl.abort();
      window.clearInterval(id);
    };
  }, []);

  return (
    <section className="card">
      <h2>Wire</h2>
      {items === null ? (
        <p className="empty">Tuning the wire…</p>
      ) : items.length === 0 ? (
        <p className="empty">The wire is quiet.</p>
      ) : (
        <ul className="list">
          {items.map((i) => (
            <li key={i.link || i.title} className="wire-row">
              <a className="wire-title" href={i.link} target="_blank" rel="noopener noreferrer">
                {i.title}
              </a>
              <span className="wire-meta">
                {i.source}
                {i.publishedAt !== null && ` · ${age(i.publishedAt)}`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
