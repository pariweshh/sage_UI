import { useEffect, useState } from 'react';
import { fetchMetrics, type MetricSample } from '../api';

const METRICS_POLL_MS = 30_000;
const SPARK_BUCKETS = 24; // one bar per hour of the served 24h window

interface Gauge {
  label: string;
  series: string;
  /** Format the latest sample for display. */
  format: (v: number) => string;
  /** Bar fill 0..1. */
  fill: (v: number) => number;
}

// Pluggable by design: any named series can become a gauge later (social
// counters are just new rows). These three come from the system check.
const GAUGES: Gauge[] = [
  { label: 'LOAD', series: 'system.load1', format: (v) => v.toFixed(2), fill: (v) => Math.min(v / 8, 1) },
  { label: 'MEM', series: 'system.mem_used_pct', format: (v) => `${Math.round(v)}%`, fill: (v) => v / 100 },
  { label: 'DISK FREE', series: 'system.disk_free_pct', format: (v) => `${Math.round(v)}%`, fill: (v) => v / 100 },
];

function latest(metrics: MetricSample[], name: string): number | null {
  const hit = metrics.find((m) => m.name === name); // rows arrive newest-first
  return hit ? hit.value : null;
}

/** Hourly cost buckets over the window, oldest first, normalized 0..1. */
function costSpark(metrics: MetricSample[], now: number): number[] {
  const buckets = new Array<number>(SPARK_BUCKETS).fill(0);
  const bucketMs = (24 * 3_600_000) / SPARK_BUCKETS;
  for (const m of metrics) {
    if (m.name !== 'cost.usd') continue;
    const idx = SPARK_BUCKETS - 1 - Math.floor((now - m.ts) / bucketMs);
    if (idx >= 0 && idx < SPARK_BUCKETS) buckets[idx] += m.value;
  }
  const max = Math.max(...buckets, 0.0001);
  return buckets.map((b) => b / max);
}

/** System vitals + the 24h model-spend sparkline, from the read-only metrics API. */
export function MetricsRail() {
  const [data, setData] = useState<{ metrics: MetricSample[]; now: number } | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    const load = async () => {
      try {
        setData(await fetchMetrics(ctrl.signal));
      } catch {
        // Poll again next tick.
      }
    };
    void load();
    const id = window.setInterval(() => void load(), METRICS_POLL_MS);
    return () => {
      ctrl.abort();
      window.clearInterval(id);
    };
  }, []);

  const metrics = data?.metrics ?? [];
  const spark = data ? costSpark(metrics, data.now) : [];
  const anyGauge = GAUGES.some((g) => latest(metrics, g.series) !== null);

  return (
    <section className="card">
      <h2>Metrics</h2>
      {!anyGauge && spark.every((b) => b === 0) ? (
        <p className="empty">Sampling… vitals arrive within minutes.</p>
      ) : (
        <>
          {GAUGES.map((g) => {
            const value = latest(metrics, g.series);
            if (value === null) return null;
            return (
              <div key={g.series} className="gauge">
                <span className="gauge-label">{g.label}</span>
                <span className="gauge-bar">
                  <i style={{ width: `${Math.round(g.fill(value) * 100)}%` }} />
                </span>
                <span className="gauge-value">{g.format(value)}</span>
              </div>
            );
          })}
          <div className="spark" title="Model spend per hour, last 24h">
            <span className="gauge-label">SPEND 24H</span>
            <span className="spark-bars" aria-hidden="true">
              {spark.map((v, i) => (
                <i key={i} style={{ height: `${Math.max(8, Math.round(v * 100))}%` }} />
              ))}
            </span>
          </div>
        </>
      )}
    </section>
  );
}
