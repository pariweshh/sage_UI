import { useEffect, useState } from 'react';
import { fetchSchedule, type ScheduleData } from '../api';

const SCHEDULE_POLL_MS = 15_000; // calendar + next-run countdowns move on minute timescales

function timeOf(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function countdown(untilMs: number, nowMs: number): string {
  const delta = untilMs - nowMs;
  if (delta <= 0) return 'due';
  const minutes = Math.round(delta / 60_000);
  if (minutes < 60) return `in ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `in ${hours}h ${(minutes % 60).toString().padStart(2, '0')}m`;
}

// Read-only view of the day: today's calendar events plus the next scheduled
// skill runs (the automation layer). Data comes from GET /api/schedule.
export function SchedulePanel() {
  const [data, setData] = useState<ScheduleData | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    const load = async () => {
      try {
        setData(await fetchSchedule(ctrl.signal));
      } catch {
        // The app-level banner reports a dead link; try again next poll.
      }
    };
    void load();
    const id = window.setInterval(() => void load(), SCHEDULE_POLL_MS);
    return () => {
      ctrl.abort();
      window.clearInterval(id);
    };
  }, []);

  return (
    <section className="card">
      <h2>Schedule</h2>
      {data === null ? (
        <p className="empty">Reading the day…</p>
      ) : (
        <>
          {data.events.length === 0 ? (
            <p className="empty">{data.calendarError ? 'Calendar not connected.' : 'Nothing scheduled today.'}</p>
          ) : (
            <ul className="list">
              {data.events.map((e) => (
                <li key={e.id} className="sched-row">
                  <span className="sched-time">{timeOf(e.start)}</span>
                  <span className="sched-title">{e.title}</span>
                </li>
              ))}
            </ul>
          )}
          {data.nextRuns.length > 0 && (
            <ul className="list sched-runs">
              {data.nextRuns.map((r) => (
                <li key={r.skill} className="sched-row sched-run">
                  <span className="sched-time">
                    {r.nextDueAt === null ? 'soon' : countdown(r.nextDueAt, data.now)}
                  </span>
                  <span className="sched-title">
                    {r.skill} <i className="sched-cadence">{r.schedule}</i>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
