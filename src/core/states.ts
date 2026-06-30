import type { VoiceState } from '../voiceClient';

// The choreographed "base" parameters per state for the 3D plasma orb + particle halo.
// GSAP tweens these on a state change (see choreography.ts); useFrame reads them and
// layers continuous motion + the voice envelope on top. Behaviour first, colour second:
//  - THINKING drives flowSpeed fast with audioGain 0 (churn without sound).
//  - LISTENING is cool cyan, SPEAKING warm amber (colour says who is talking).
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

export const STATE_TARGETS: Record<VoiceState, CoreParams> = {
  idle: {
    color: '#37c9e0', emissive: 0.62, audioGain: 0.0, coreScale: 1.0, pulse: 0.0,
    waveAmp: 0.022, flowSpeed: 0.25, particleEnergy: 0.15, particleSpread: 0.3,
  },
  listening: {
    color: '#5fe9ff', emissive: 1.05, audioGain: 1.8, coreScale: 1.06, pulse: 0.0,
    waveAmp: 0.05, flowSpeed: 0.6, particleEnergy: 0.45, particleSpread: 1.1,
  },
  thinking: {
    color: '#b985ff', emissive: 0.9, audioGain: 0.0, coreScale: 1.0, pulse: 1.0,
    waveAmp: 0.036, flowSpeed: 1.35, particleEnergy: 0.7, particleSpread: 0.3,
  },
  speaking: {
    color: '#ffc15c', emissive: 1.0, audioGain: 1.5, coreScale: 1.04, pulse: 0.0,
    waveAmp: 0.042, flowSpeed: 0.52, particleEnergy: 0.4, particleSpread: 0.85,
  },
};

export function cloneParams(p: CoreParams): CoreParams {
  return { ...p };
}

// Frame-rate-independent smoothing (used for amplitude smoothing; the per-state param
// transitions are choreographed by GSAP, not damped).
export function damp(current: number, target: number, tau: number, dt: number): number {
  return current + (target - current) * (1 - Math.exp(-dt / tau));
}
