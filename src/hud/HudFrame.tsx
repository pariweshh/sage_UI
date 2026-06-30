// The crisp HUD chrome: an angular corner-bracket frame, edge tick rails, a faint
// grid, corner glints, and a scanline/grain CRT overlay. Pure decoration (the
// real telemetry lives in the readout panels) — pointer-events none, low contrast,
// and the animated scanline is dropped under reduced-motion.

function Corner({ cls }: { cls: string }) {
  return (
    <svg className={`hud-corner ${cls}`} viewBox="0 0 72 72" aria-hidden="true">
      <path d="M4 28 L4 10 L10 4 L28 4" />
      <path className="hud-corner-tick" d="M4 36 L4 31" />
      <path className="hud-corner-tick" d="M36 4 L31 4" />
    </svg>
  );
}

export function HudFrame({ reduced }: { reduced: boolean }) {
  return (
    <div className="hud" aria-hidden="true">
      <div className="hud-grid" />
      <div className="hud-frame" />
      <Corner cls="tl" />
      <Corner cls="tr" />
      <Corner cls="br" />
      <Corner cls="bl" />
      <div className="hud-rail hud-rail-top" />
      <div className="hud-rail hud-rail-bottom" />
      <span className="hud-glint hud-glint-top" />
      <span className="hud-glint hud-glint-bottom" />
      <div className={`hud-fx ${reduced ? 'hud-fx-static' : ''}`} />
    </div>
  );
}
