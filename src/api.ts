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

export interface Directive {
  label: string;
  metricName: string;
  target: number;
  unit: string;
  current: number;
}

export interface DashboardState {
  audit: AuditRow[];
  held: HeldAction[];
  notices: Notice[];
  cost: { totalUsd: number; ceilingUsd: number };
  killSwitch: { paused: boolean; reason: string };
  directive: Directive;
  now: number;
}

export const POLL_MS = 2000;

export async function fetchState(signal?: AbortSignal): Promise<DashboardState> {
  const res = await fetch('/api/state', { signal });
  if (!res.ok) throw new Error(`state request failed: ${res.status}`);
  return (await res.json()) as DashboardState;
}

export interface VaultNoteMeta {
  /** Note id: vault-relative path without the .md extension. */
  path: string;
  title: string;
  mtimeMs: number;
}

export interface VaultNote extends VaultNoteMeta {
  frontmatter: Record<string, string | string[]>;
  body: string;
  backlinks: string[];
}

export async function fetchVaultList(signal?: AbortSignal): Promise<VaultNoteMeta[]> {
  const res = await fetch('/api/vault/list', { signal });
  if (!res.ok) throw new Error(`vault list request failed: ${res.status}`);
  return ((await res.json()) as { notes: VaultNoteMeta[] }).notes;
}

export async function fetchVaultNote(path: string, signal?: AbortSignal): Promise<VaultNote> {
  const res = await fetch(`/api/vault/note?path=${encodeURIComponent(path)}`, { signal });
  if (res.status === 404) throw new Error('note not found');
  if (!res.ok) throw new Error(`vault note request failed: ${res.status}`);
  return (await res.json()) as VaultNote;
}

export interface ScheduleEvent {
  id: string;
  title: string;
  start: string;
  end: string;
}

export interface NextSkillRun {
  skill: string;
  schedule: string | null;
  nextDueAt: number | null;
}

export interface ScheduleData {
  events: ScheduleEvent[];
  calendarError: string | null;
  nextRuns: NextSkillRun[];
  now: number;
}

export interface SkillInfo {
  name: string;
  branch: string;
  description: string;
  schedule: string | null;
  nextDueAt: number | null;
  lastRun: { status: string; finishedAt: number | null; notePath: string | null; trigger: string } | null;
}

export async function fetchSkills(signal?: AbortSignal): Promise<SkillInfo[]> {
  const res = await fetch('/api/skills', { signal });
  if (!res.ok) throw new Error(`skills request failed: ${res.status}`);
  return ((await res.json()) as { skills: SkillInfo[] }).skills;
}

export interface MetricSample {
  ts: number;
  name: string;
  value: number;
}

export async function fetchMetrics(signal?: AbortSignal): Promise<{ metrics: MetricSample[]; now: number }> {
  const res = await fetch('/api/metrics', { signal });
  if (!res.ok) throw new Error(`metrics request failed: ${res.status}`);
  return (await res.json()) as { metrics: MetricSample[]; now: number };
}

export interface WireItemData {
  source: string;
  title: string;
  link: string;
  publishedAt: number | null;
}

export async function fetchWireItems(signal?: AbortSignal): Promise<WireItemData[]> {
  const res = await fetch('/api/wire', { signal });
  if (!res.ok) throw new Error(`wire request failed: ${res.status}`);
  return ((await res.json()) as { items: WireItemData[] }).items;
}

export async function fetchSchedule(signal?: AbortSignal): Promise<ScheduleData> {
  const res = await fetch('/api/schedule', { signal });
  if (!res.ok) throw new Error(`schedule request failed: ${res.status}`);
  return (await res.json()) as ScheduleData;
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
