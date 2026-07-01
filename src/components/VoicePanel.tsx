import { useEffect, useRef, useState } from 'react';
import type { VoiceState } from '../voiceClient';
import { Emblem } from './Emblem';

interface VoicePanelProps {
  state: VoiceState;
  connected: boolean;
  pttStart: () => void;
  pttEnd: () => void;
  sendTyped: (text: string) => void;
  setSpeak: (on: boolean) => void;
  speakReplies: boolean;
  conversationMode: boolean;
  setConversationMode: (on: boolean) => void;
  expanded: boolean;
  onToggle: () => void;
}

// Docked chat bar: collapsed by default to a slim handle ("Type instead"), keeping the orb the
// hero. Clicking it expands UPWARD into the console (Hold to Talk + typed input + speak toggle).
// The conversation transcript lives in its own left-column panel now, so dialogue is visible in
// voice mode without ever opening this. Spacebar push-to-talk works while collapsed.
export function VoicePanel({ state, connected, pttStart, pttEnd, sendTyped, setSpeak, speakReplies, conversationMode, setConversationMode, expanded, onToggle }: VoicePanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState(''); // collapsed by default; `expanded` is owned by App

  // Submit a typed turn (or a typed gate answer) and clear the field; Part C backend
  // routes it into the same runTurn. Empty submits are ignored.
  const submitTyped = () => {
    const t = draft.trim();
    if (!t) return;
    sendTyped(t);
    setDraft('');
  };

  // Spacebar push-to-talk (hold). Ignored while typing in a field, so a revealed +
  // focused input types a space instead of triggering PTT; otherwise space = PTT.
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

  // Focus the field when the console opens; blur on collapse so spacebar PTT works again.
  useEffect(() => {
    if (expanded) inputRef.current?.focus();
    else inputRef.current?.blur();
  }, [expanded]);

  return (
    <div className="dockbar">
      <div className={`dock-console ${expanded ? 'open' : ''}`}>
        <div className="dock-console-inner">
          <div className="dock-panel">
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

            <div className="chat-row">
              <span className="chat-slash" aria-hidden="true" />
              <input
                ref={inputRef}
                className="chat-input"
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    submitTyped();
                  }
                }}
                placeholder="Type to Sage..."
                aria-label="Type a message to Sage"
                aria-hidden={!expanded}
                tabIndex={expanded ? 0 : -1}
              />
              <span className="chat-seg" aria-hidden="true" />
            </div>

            <div className="toggle-row">
              <button
                type="button"
                className="speak-toggle"
                aria-pressed={speakReplies}
                onClick={() => setSpeak(!speakReplies)}
                onKeyDown={(e) => {
                  if (e.code === 'Space') e.preventDefault();
                }}
              >
                speak replies: {speakReplies ? 'on' : 'off'}
              </button>
              <button
                type="button"
                className={`speak-toggle convo-toggle ${conversationMode ? 'convo-on' : ''}`}
                aria-pressed={conversationMode}
                onClick={() => setConversationMode(!conversationMode)}
                onKeyDown={(e) => {
                  if (e.code === 'Space') e.preventDefault();
                }}
                title="Hands-free: I detect when you start and stop talking. Press M to toggle."
              >
                conversation: {conversationMode ? 'on' : 'off'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div
        className="dock-handle"
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        aria-label={expanded ? 'Collapse chat console' : 'Open chat console to type'}
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            onToggle();
          }
        }}
      >
        <Emblem />
        <span className="dock-label">{expanded ? 'Voice only' : 'Type instead'}</span>
        <span className="chat-seg" aria-hidden="true" />
        <span className="dock-chevron" aria-hidden="true">{expanded ? '▾' : '▴'}</span>
      </div>
    </div>
  );
}
