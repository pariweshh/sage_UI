// The only way the browser reaches Sage. Same-origin /api is proxied by Vite to
// the loopback backend. No provider SDKs, no API keys live in this project: the
// model, STT, and TTS all stay server-side. The single write the UI may make is
// dismissing a notice; everything else here is read-only.

export interface AuditRow {
  ts: number;
  event: string;
  detail: string;
}

export interface HeldAction {
  id: number;
  tool: string;
  action: string;
  createdAt: number;
}

export interface Notice {
  id: number;
  checkName: string;
  message: string;
  severity: string;
  createdAt: number;
}

export interface DashboardState {
  audit: AuditRow[];
  held: HeldAction[];
  notices: Notice[];
  cost: { totalUsd: number; ceilingUsd: number };
  killSwitch: { paused: boolean; reason: string };
  now: number;
}

export const POLL_MS = 2000;

export async function fetchState(signal?: AbortSignal): Promise<DashboardState> {
  const res = await fetch('/api/state', { signal });
  if (!res.ok) throw new Error(`state request failed: ${res.status}`);
  return (await res.json()) as DashboardState;
}

/** The lone write the UI is allowed: acknowledge a notice. Returns whether it changed. */
export async function dismissNotice(id: number): Promise<boolean> {
  const res = await fetch('/api/dismiss', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id }),
  });
  if (!res.ok) throw new Error(`dismiss request failed: ${res.status}`);
  const body = (await res.json()) as { dismissed: boolean };
  return body.dismissed;
}
