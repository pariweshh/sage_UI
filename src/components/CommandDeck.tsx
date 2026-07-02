import { useEffect, useState } from 'react';
import { fetchSkills, type SkillInfo } from '../api';
import type { SkillStatus } from '../voiceClient';

const SKILLS_POLL_MS = 15_000;

interface Props {
  connected: boolean;
  busy: boolean;
  /** Live status from the voice channel; overrides the polled last-run dot. */
  liveStatus: Record<string, SkillStatus>;
  onRun: (name: string) => void;
}

function dotFor(skill: SkillInfo, live?: SkillStatus): string {
  if (live === 'running') return 'run';
  const status = live ?? skill.lastRun?.status;
  if (status === 'ok') return 'ok';
  if (status === 'error') return 'err';
  return 'idle';
}

function lastRunAge(skill: SkillInfo): string {
  const at = skill.lastRun?.finishedAt;
  if (!at) return 'never run';
  const minutes = Math.round((Date.now() - at) / 60_000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `${hours}h ago` : `${Math.floor(hours / 24)}d ago`;
}

/**
 * The command deck: every discovered skill, one click away. A click is an
 * UTTERANCE ("run <name>") sent over the conversation WebSocket - never a new
 * write surface, never an approval. A consequential tool inside a skill still
 * pauses at the gate for a spoken/typed yes. Disabled when the link is down.
 */
export function CommandDeck({ connected, busy, liveStatus, onRun }: Props) {
  const [skills, setSkills] = useState<SkillInfo[]>([]);

  useEffect(() => {
    const ctrl = new AbortController();
    const load = async () => {
      try {
        setSkills(await fetchSkills(ctrl.signal));
      } catch {
        // Poll again next tick; the app-level banner already reports a dead link.
      }
    };
    void load();
    const id = window.setInterval(() => void load(), SKILLS_POLL_MS);
    return () => {
      ctrl.abort();
      window.clearInterval(id);
    };
  }, []);

  if (skills.length === 0) return null;

  return (
    <div className="deck" role="toolbar" aria-label="Command deck">
      <span className="deck-label">Deck</span>
      {skills.map((s) => {
        const dot = dotFor(s, liveStatus[s.name]);
        return (
          <button
            key={s.name}
            type="button"
            className="deck-chip"
            disabled={!connected || busy || dot === 'run'}
            title={`${s.description}\nLast run: ${lastRunAge(s)}${s.schedule ? `\nSchedule: ${s.schedule}` : ''}`}
            onClick={() => onRun(s.name)}
          >
            <span className={`deck-dot dot-${dot}`} aria-hidden="true" />
            <span className="deck-name">{s.name}</span>
            <span className="deck-branch">{s.branch}</span>
          </button>
        );
      })}
    </div>
  );
}
