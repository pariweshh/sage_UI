import { useEffect, useRef } from 'react';
import { useVoice } from '../useVoice';

const STATE_LABEL: Record<string, string> = {
  idle: 'at rest',
  listening: 'listening',
  thinking: 'thinking',
  speaking: 'speaking',
};

// Phase 2 centrepiece: push-to-talk + live transcript. Phase 3 replaces this
// stage with the voice-reactive blob, driven by the same state.
export function VoicePanel() {
  const { state, connected, lines, partial, pttStart, pttEnd } = useVoice();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Spacebar push-to-talk (hold). Ignored while typing in a field.
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || e.repeat) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      e.preventDefault();
      pttStart();
    };
    const up = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      e.preventDefault();
      pttEnd();
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [pttStart, pttEnd]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [lines, partial]);

  return (
    <section className="voice card">
      <div className="voice-head">
        <span className={`dot dot-${state}`} aria-hidden="true" />
        <span className="voice-state">{connected ? STATE_LABEL[state] : 'connecting…'}</span>
      </div>

      <button
        type="button"
        className={`ptt ${state === 'listening' ? 'ptt-live' : ''}`}
        disabled={!connected}
        onPointerDown={(e) => {
          e.preventDefault();
          pttStart();
        }}
        onPointerUp={(e) => {
          e.preventDefault();
          pttEnd();
        }}
        onPointerLeave={() => pttEnd()}
        onContextMenu={(e) => e.preventDefault()}
      >
        {state === 'listening' ? 'Listening… release to send' : 'Hold to talk'}
      </button>
      <p className="ptt-hint">Hold the button or the spacebar. Approvals are spoken, never clicked.</p>

      <div className="transcript" ref={scrollRef}>
        {lines.length === 0 && !partial && <p className="empty">Say hello to Sage.</p>}
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
      </div>
    </section>
  );
}
