import { useCallback, useEffect, useState } from 'react';
import { fetchState, dismissNotice, POLL_MS, type DashboardState } from './api';
import { StatusStrip } from './components/StatusStrip';
import { Pending } from './components/Pending';
import { Notices } from './components/Notices';
import { Timeline } from './components/Timeline';

function App() {
  const [state, setState] = useState<DashboardState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const next = await fetchState(signal);
      setState(next);
      setError(null);
    } catch (e) {
      if ((e as Error).name !== 'AbortError') {
        setError('Backend unreachable. Start it with `npm run server` in ../sage.');
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
      // Drop it locally for instant feedback; the next poll confirms from the store.
      setState((s) => (s ? { ...s, notices: s.notices.filter((n) => n.id !== id) } : s));
    } catch {
      setError('Could not dismiss. It will reappear on the next refresh.');
    }
  }, []);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="mark" aria-hidden="true" />
          Sage
          <span className="sub">dashboard</span>
        </div>
        {state && <StatusStrip cost={state.cost} killSwitch={state.killSwitch} />}
      </header>

      {error && <div className="banner error">{error}</div>}
      {!state && !error && <div className="banner">Connecting to Sage…</div>}

      {state && (
        <main className="grid">
          {/* Phase 3 places the voice-reactive blob as the centrepiece here. */}
          <section className="col col-side">
            <Pending held={state.held} />
            <Notices notices={state.notices} onDismiss={onDismiss} />
          </section>
          <section className="col col-timeline">
            <Timeline audit={state.audit} />
          </section>
        </main>
      )}
    </div>
  );
}

export default App;
