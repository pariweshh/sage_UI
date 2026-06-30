import gsap from 'gsap';
import { STATE_TARGETS, type CoreParams } from './states';
import type { VoiceState } from '../voiceClient';

// Choreograph a state TRANSITION as a GSAP timeline that mutates `params` over a
// sequence (never a crossfade). useFrame layers continuous motion + the voice envelope
// on top; this only sequences the discrete reconfiguration. The rendered hue lerps
// toward `params.color` in useFrame, so here we just snap the target hue at the right beat.
export function choreograph(params: CoreParams, to: VoiceState, reduced: boolean): gsap.core.Timeline {
  const t = STATE_TARGETS[to];
  const nums = numeric(t);
  const tl = gsap.timeline();

  if (reduced) {
    tl.set(params, { color: t.color });
    tl.to(params, { ...nums, duration: 0.5, ease: 'power1.out' });
    return tl;
  }

  if (to === 'idle') {
    // gentle decay back to ambient
    tl.set(params, { color: t.color }, 0.15);
    tl.to(params, { ...nums, duration: 0.9, ease: 'power2.out' });
    return tl;
  }

  if (to === 'listening') {
    // Ignition: a fast, snappy wake-up across every layer — overshoot bright + swell,
    // then settle to the elevated listening baseline (the voice envelope drives the rest).
    tl.set(params, { color: t.color });
    tl.to(params, {
      emissive: t.emissive * 1.45, coreScale: t.coreScale * 1.07,
      waveAmp: t.waveAmp, flowSpeed: t.flowSpeed, particleEnergy: t.particleEnergy,
      particleSpread: t.particleSpread, audioGain: t.audioGain, pulse: t.pulse,
      duration: 0.16, ease: 'power3.out',
    });
    tl.to(params, { emissive: t.emissive, coreScale: t.coreScale, duration: 0.5, ease: 'power2.out' });
    return tl;
  }

  // Energetic states: a choreographed reconfigure.
  // 1) a quick beat — dim and contract slightly
  tl.to(params, { emissive: t.emissive * 0.55, coreScale: t.coreScale * 0.95, duration: 0.16, ease: 'power2.in' });
  // 2) snap the motion identity (waves/flow/particles/gain/pulse) + switch hue target
  tl.set(params, { color: t.color }, 0.12);
  tl.to(
    params,
    {
      waveAmp: t.waveAmp, flowSpeed: t.flowSpeed, particleEnergy: t.particleEnergy,
      particleSpread: t.particleSpread, audioGain: t.audioGain, pulse: t.pulse,
      duration: 0.35, ease: 'power2.out',
    },
    '>-0.04',
  );
  // 3) settle brightness + scale back out
  tl.to(params, { emissive: t.emissive, coreScale: t.coreScale, duration: 0.45, ease: 'power2.out' }, '<0.1');
  // entering thinking: an extra spin-up overshoot on the churn speed
  if (to === 'thinking') {
    tl.fromTo(params, { flowSpeed: 0.3 }, { flowSpeed: t.flowSpeed, duration: 0.7, ease: 'power3.out' }, 0.0);
  }
  return tl;
}

function numeric(t: CoreParams): Omit<CoreParams, 'color'> {
  const { color: _ignore, ...rest } = t;
  return rest;
}
