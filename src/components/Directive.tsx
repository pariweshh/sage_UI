import type { Directive as DirectiveData } from '../api';

interface Props {
  directive: DirectiveData;
}

// The primary directive: one goal, huge, always visible under the core.
// Configured in sage.config.json; the value is the latest sample of its
// metric series (loggable by voice: "log 2 deep-work hours").
export function Directive({ directive }: Props) {
  const progress = directive.target > 0 ? Math.min(directive.current / directive.target, 1) : 0;
  return (
    <div className="directive" role="status" aria-label={`${directive.label}: ${directive.current} of ${directive.target}`}>
      <span className="directive-label">Primary directive · {directive.label}</span>
      <span className="directive-value">
        {Number.isInteger(directive.current) ? directive.current.toLocaleString() : directive.current.toFixed(1)}
        <i className="directive-unit">{directive.unit}</i>
      </span>
      <span className="directive-track" aria-hidden="true">
        <i style={{ width: `${Math.round(progress * 100)}%` }} />
      </span>
      <span className="directive-target">
        target {directive.target.toLocaleString()}
        {directive.unit}
      </span>
    </div>
  );
}
