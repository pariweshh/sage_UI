import type { VoiceState } from '../voiceClient';

// The choreographed "base" parameters per state for the 3D plasma orb + particle halo.
// GSAP tweens these on a state change (see choreography.ts); useFrame reads them and
// layers continuous motion + the voice envelope on top. Behaviour first, colour second:
//  - THINKING drives flowSpeed fast with audioGain 0 (churn without sound).
//  - Colour says who is talking; the actual palette lives in the THEME (themes/*.ts).
// Tunable; values are a starting calibration. (ponytail: leave the knob.)
export interface CoreParams {
  color: string;          // orb + particle hue (hex)
  emissive: number;       // base brightness
  audioGain: number;      // how strongly the envelope drives waves/particles/brightness
  coreScale: number;      // breathing / overall scale baseline
  pulse: number;          // thinking heartbeat (0 or 1)
  waveAmp: number;        // orb surface wave height (small — keep it a smooth sphere)
  flowSpeed: number;      // internal plasma + wave-travel + thinking-churn speed
  particleEnergy: number; // particle drift/agitation (thinking high, time-driven)
  particleSpread: number; // how far particles expand with the envelope
}

/** Per-state targets for the core; supplied by the active theme (themes/*.ts). */
export type StateTargets = Record<VoiceState, CoreParams>;

export function cloneParams(p: CoreParams): CoreParams {
  return { ...p };
}

// Frame-rate-independent smoothing (used for amplitude smoothing; the per-state param
// transitions are choreographed by GSAP, not damped).
export function damp(current: number, target: number, tau: number, dt: number): number {
  return current + (target - current) * (1 - Math.exp(-dt / tau));
}
