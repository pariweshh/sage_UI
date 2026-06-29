import type { DashboardState } from '../api';

interface Props {
  cost: DashboardState['cost'];
  killSwitch: DashboardState['killSwitch'];
}

export function StatusStrip({ cost, killSwitch }: Props) {
  const pct = cost.ceilingUsd > 0 ? Math.min(100, (cost.totalUsd / cost.ceilingUsd) * 100) : 0;
  const near = pct >= 80;

  return (
    <div className="status">
      <span className={`pill ${killSwitch.paused ? 'pill-paused' : 'pill-on'}`}>
        {killSwitch.paused
          ? `paused${killSwitch.reason ? ` · ${killSwitch.reason}` : ''}`
          : 'proactive on'}
      </span>
      <div className="cost" title={`$${cost.totalUsd.toFixed(4)} of $${cost.ceilingUsd.toFixed(2)} ceiling`}>
        <span className="cost-figures">
          ${cost.totalUsd.toFixed(4)} <span className="dim">/ ${cost.ceilingUsd.toFixed(2)}</span>
        </span>
        <span className="meter">
          <span className={`meter-fill ${near ? 'meter-near' : ''}`} style={{ width: `${pct}%` }} />
        </span>
      </div>
    </div>
  );
}
