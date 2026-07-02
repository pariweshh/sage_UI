import { useEffect, useState, type ReactNode } from 'react';
import { fetchVaultNote, type VaultNote } from '../api';

interface Props {
  path: string;
  onClose: () => void;
  onNavigate: (path: string) => void;
}

// Inline markdown: **bold** and [[wikilinks]] (with |alias and #heading forms).
// Wikilinks navigate within the slide-over. Everything else renders as text —
// note contents are untrusted data and are never interpreted as markup/HTML.
function renderInline(text: string, onNavigate: (p: string) => void): ReactNode[] {
  return text.split(/(\[\[[^\]]+\]\]|\*\*[^*]+\*\*)/g).map((part, i) => {
    if (part.startsWith('[[') && part.endsWith(']]')) {
      const inner = part.slice(2, -2);
      const target = inner.split('|')[0].split('#')[0].trim();
      const label = inner.includes('|') ? inner.split('|').slice(1).join('|') : target;
      return (
        <button key={i} type="button" className="wikilink" onClick={() => onNavigate(target)}>
          {label}
        </button>
      );
    }
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

// Tiny block renderer: headings, bullet lists, paragraphs. No markdown dep.
function renderBody(body: string, onNavigate: (p: string) => void): ReactNode[] {
  const blocks: ReactNode[] = [];
  let bullets: string[] = [];
  let paragraph: string[] = [];

  const flush = (key: number) => {
    if (bullets.length > 0) {
      blocks.push(
        <ul key={`ul-${key}`}>
          {bullets.map((b, i) => (
            <li key={i}>{renderInline(b, onNavigate)}</li>
          ))}
        </ul>,
      );
      bullets = [];
    }
    if (paragraph.length > 0) {
      blocks.push(<p key={`p-${key}`}>{renderInline(paragraph.join(' '), onNavigate)}</p>);
      paragraph = [];
    }
  };

  body.split('\n').forEach((line, i) => {
    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    if (heading) {
      flush(i);
      const level = heading[1].length;
      const content = renderInline(heading[2], onNavigate);
      blocks.push(level === 1 ? <h3 key={i}>{content}</h3> : level === 2 ? <h4 key={i}>{content}</h4> : <h5 key={i}>{content}</h5>);
    } else if (line.startsWith('- ')) {
      if (paragraph.length > 0) flush(i);
      bullets.push(line.slice(2));
    } else if (line.trim() === '') {
      flush(i);
    } else {
      if (bullets.length > 0) flush(i);
      paragraph.push(line);
    }
  });
  flush(body.length);
  return blocks;
}

// Slide-over reader for one vault note. Read-only; Escape or the scrim closes.
export function NoteView({ path, onClose, onNavigate }: Props) {
  const [note, setNote] = useState<VaultNote | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    setNote(null);
    setError(null);
    fetchVaultNote(path, ctrl.signal)
      .then(setNote)
      .catch((e: Error) => {
        if (e.name !== 'AbortError') setError(e.message);
      });
    return () => ctrl.abort();
  }, [path]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const created = typeof note?.frontmatter.created === 'string' ? note.frontmatter.created : null;

  return (
    <div className="note-scrim" onClick={onClose} role="presentation">
      <aside className="note-view" onClick={(e) => e.stopPropagation()} aria-label="Vault note">
        <header className="note-head">
          <div>
            <h2>{note?.title ?? path}</h2>
            <p className="note-sub">
              <span>{path}</span>
              {created && <time>{new Date(created).toLocaleString()}</time>}
            </p>
          </div>
          <button type="button" className="note-close" onClick={onClose} aria-label="Close note">
            ✕
          </button>
        </header>
        <div className="note-body">
          {error && <p className="empty">Could not open this note: {error}.</p>}
          {!error && note === null && <p className="empty">Opening…</p>}
          {note && renderBody(note.body, onNavigate)}
        </div>
        {note && note.backlinks.length > 0 && (
          <footer className="note-links">
            <span className="note-links-label">Linked from</span>
            {note.backlinks.map((b) => (
              <button key={b} type="button" className="wikilink" onClick={() => onNavigate(b)}>
                {b}
              </button>
            ))}
          </footer>
        )}
      </aside>
    </div>
  );
}
