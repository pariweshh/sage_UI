import { useCallback, useEffect, useState } from 'react';
import { fetchState, dismissNotice, POLL_MS, type DashboardState } from './api';
import { useVoice } from './useVoice';
import type { VoiceState } from './voiceClient';
import { Scene } from './core/Scene';
import { HudFrame } from './hud/HudFrame';
import { StatusStrip } from './components/StatusStrip';
import { Pending } from './components/Pending';
import { Notices } from './components/Notices';
import { Timeline } from './components/Timeline';
import { Conversation } from './components/Conversation';
import { VoicePanel } from './components/VoicePanel';

// DEV-only visual preview: ?state=thinking forces the core's appearance for
// tuning/screenshots. Presentation only — it cannot trigger actions, read data,
// or touch the gate, and it is compiled out of production builds.
function statePreview(): VoiceState | null {
  if (!import.meta.env.DEV || typeof window === 'undefined') return null;
  const v = new URLSearchParams(window.location.search).get('state');
  return v === 'idle' || v === 'listening' || v === 'thinking' || v === 'speaking' ? v : null;
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

function App() {
  const reduced = usePrefersReducedMotion();
  const voice = useVoice();

  const [state, setState] = useState<DashboardState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [chatExpanded, setChatExpanded] = useState(false); // owns the dock state so the greeting can hide when typing

  // Browsers block audio before a user gesture. The greeting TEXT shows on load; its speech
  // plays once on the first interaction (any click or keypress covers opening the chat, the
  // toggle, or hold-to-talk). playGreeting is a no-op if speak replies is off or already fired.
  useEffect(() => {
    const onGesture = () => voice.playGreeting();
    window.addEventListener('pointerdown', onGesture, { once: true });
    window.addEventListener('keydown', onGesture, { once: true });
    return () => {
      window.removeEventListener('pointerdown', onGesture);
      window.removeEventListener('keydown', onGesture);
    };
  }, [voice.playGreeting]);

  // Quick mute / hands-free toggle: "M" flips Conversation mode (ignored while typing in a field).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key !== 'm' && e.key !== 'M') || e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      voice.setConversationMode(!voice.conversationMode);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [voice.conversationMode, voice.setConversationMode]);

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const next = await fetchState(signal);
      setState(next);
      setError(null);
    } catch (e) {
      if ((e as Error).name !== 'AbortError') {
        setError('LINK LOST — start the server with `npm run server` in ../sage.');
      }
    }
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    void load(ctrl.signal);
    const id = window.setInterval(() => void load(), POLL_MS);
    return () => {
      ctrl.abort();
      window.clearInterval(id);
    };
  }, [load]);

  const onDismiss = useCallback(async (id: number) => {
    try {
      await dismissNotice(id);
      setState((s) => (s ? { ...s, notices: s.notices.filter((n) => n.id !== id) } : s));
    } catch {
      setError('Could not dismiss; it will reappear on the next refresh.');
    }
  }, []);

  // The core's appearance follows the live voice state (or the DEV preview).
  const coreState = statePreview() ?? voice.state;
  const pending = state?.held.length ?? 0;

  return (
    <div className="app">
      {/* Layer A: the reactive HUD core (fixed, behind everything). */}
      <Scene
        state={coreState}
        getAmplitude={voice.getAmplitude}
        reduced={reduced}
        replyPulse={voice.replyPulse}
        armed={voice.conversationMode && voice.convoStatus === 'armed'}
      />
      {/* Layer B chrome frame: brackets, rails, grid, scanlines. */}
      <HudFrame reduced={reduced} />

      <div className="overlay">
        <header className="topbar">
          <div className="brand">
            <span className="mark" aria-hidden="true" />
            <span className="brand-name">SAGE</span>
            <span className="brand-sub">// HUD</span>
          </div>
          <div className="telemetry">
            <span className="tlm">
              <i>STATE</i>
              <b className={`tlm-state s-${coreState}`}>{coreState.toUpperCase()}</b>
            </span>
            <span className="tlm">
              <i>PENDING</i>
              <b>{pending.toString().padStart(2, '0')}</b>
            </span>
            {voice.convoStatus !== 'off' && (
              <span
                className={`hot-mic hot-mic-${voice.convoStatus}`}
                role="status"
                aria-live="polite"
                title="Conversation mode is on — the mic is live. Press M or the toggle to stop."
              >
                <span className="hot-dot" aria-hidden="true" />
                {voice.convoStatus === 'capturing'
                  ? 'LISTENING'
                  : voice.convoStatus === 'blocked'
                    ? 'MIC HELD'
                    : 'MIC LIVE'}
              </span>
            )}
          </div>
          {state && <StatusStrip cost={state.cost} killSwitch={state.killSwitch} />}
        </header>

        {error && <div className="banner error">{error}</div>}

        <div className="stage">
          <aside className="rail rail-left">
            {state && <Pending held={state.held} />}
            {state && <Notices notices={state.notices} onDismiss={onDismiss} />}
            <Conversation lines={voice.lines} partial={voice.partial} />
          </aside>

          <div className="center">
            <p className="talk-hint">Hold space to talk</p>
            {voice.greeting && !chatExpanded && <p className="talk-greeting">{voice.greeting}</p>}
          </div>

          <aside className="rail rail-right">
            {state ? <Timeline audit={state.audit} /> : <div className="card dim">LINK… awaiting telemetry</div>}
          </aside>
        </div>

        <VoicePanel
          state={voice.state}
          connected={voice.connected}
          pttStart={voice.pttStart}
          pttEnd={voice.pttEnd}
          sendTyped={voice.sendTyped}
          setSpeak={voice.setSpeak}
          speakReplies={voice.speakReplies}
          conversationMode={voice.conversationMode}
          setConversationMode={voice.setConversationMode}
          expanded={chatExpanded}
          onToggle={() => setChatExpanded((v) => !v)}
        />
      </div>
    </div>
  );
}

export default App;
