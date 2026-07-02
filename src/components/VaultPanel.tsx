import { useEffect, useState } from 'react';
import { fetchVaultList, type VaultNoteMeta } from '../api';

const VAULT_POLL_MS = 10_000; // the vault changes on human/skill timescales, not per-second

interface Props {
  onOpen: (path: string) => void;
}

// Read-only window into the knowledge vault: recent notes, newest first.
// Clicking a note opens the NoteView slide-over; nothing here writes.
export function VaultPanel({ onOpen }: Props) {
  const [notes, setNotes] = useState<VaultNoteMeta[] | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    const load = async () => {
      try {
        setNotes(await fetchVaultList(ctrl.signal));
      } catch {
        // Poll again next tick; the app-level banner already reports a dead link.
      }
    };
    void load();
    const id = window.setInterval(() => void load(), VAULT_POLL_MS);
    return () => {
      ctrl.abort();
      window.clearInterval(id);
    };
  }, []);

  return (
    <section className="card">
      <h2>Vault</h2>
      {notes === null ? (
        <p className="empty">Reading the vault…</p>
      ) : notes.length === 0 ? (
        <p className="empty">No notes yet. Ask Sage to save one.</p>
      ) : (
        <ul className="list">
          {notes.map((n) => (
            <li key={n.path}>
              <button type="button" className="vault-item" onClick={() => onOpen(n.path)}>
                <span className="vault-title">{n.title}</span>
                <span className="vault-meta">
                  <span className="vault-path">{n.path}</span>
                  <time>{new Date(n.mtimeMs).toLocaleDateString()}</time>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
