import { useEffect, useRef, useState } from 'react';
import type { TranscriptLine } from '../voiceClient';

interface ConversationProps {
  lines: TranscriptLine[];
  partial: string;
}

// Your dialogue with Sage, always visible in voice or typed mode. Separate from the
// Activity/audit panel on the right (system/tool log). Compact, fixed-height, newest at the
// bottom; auto-scrolls only when already at the bottom, so scrolling up to read is not yanked.
export function Conversation({ lines, partial }: ConversationProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);
  const [collapsed, setCollapsed] = useState(false); // fold to a header so the rail never crowds

  const onScroll = () => {
    const el = scrollRef.current;
    if (el) atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
  };
  useEffect(() => {
    const el = scrollRef.current;
    if (el && atBottomRef.current) el.scrollTo({ top: el.scrollHeight });
  }, [lines, partial]);

  return (
    <section className="card conversation">
      <h2>
        <button
          type="button"
          className="card-fold"
          aria-expanded={!collapsed}
          onClick={() => setCollapsed((c) => !c)}
          title={collapsed ? 'Expand the conversation' : 'Collapse the conversation'}
        >
          Conversation <i aria-hidden="true">{collapsed ? '▸' : '▾'}</i>
        </button>
      </h2>
      {collapsed ? null : (
      <div className="convo-scroll" ref={scrollRef} onScroll={onScroll}>
        {lines.length === 0 && !partial ? (
          <p className="empty">Nothing said yet. Hold space to talk, or type.</p>
        ) : (
          <>
            {lines.map((l, i) => (
              <p key={i} className={`line line-${l.role}`}>
                <span className="who">{l.role === 'you' ? 'you' : 'sage'}</span>
                <span className="said">{l.text}</span>
              </p>
            ))}
            {partial && (
              <p className="line line-sage partial">
                <span className="who">sage</span>
                <span className="said">{partial}</span>
              </p>
            )}
          </>
        )}
      </div>
      )}
    </section>
  );
}
