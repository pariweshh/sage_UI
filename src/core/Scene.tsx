import { Canvas } from '@react-three/fiber';
import { EffectComposer, Bloom, ChromaticAberration, Vignette, Noise } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import { Vector2 } from 'three';
import { Core } from './Core';
import type { VoiceState } from '../voiceClient';

interface SceneProps {
  state: VoiceState;
  getAmplitude: () => number;
  reduced: boolean;
  replyPulse: number;
}

// The HUD core stage. Post-processing is spare and cinematic: Bloom (FIXED
// intensity — the glow comes from additive emissive in the shaders, never a
// per-frame bloom uniform), subtle ChromaticAberration, Vignette, faint grain.
export function Scene({ state, getAmplitude, reduced, replyPulse }: SceneProps) {
  return (
    <Canvas
      className="scene"
      camera={{ position: [0, 0, 4], fov: 42 }}
      gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
      dpr={[1, 2]}
    >
      <color attach="background" args={['#02050b']} />
      <Core state={state} getAmplitude={getAmplitude} reduced={reduced} replyPulse={replyPulse} />
      <EffectComposer>
        <Bloom intensity={1.15} luminanceThreshold={0.12} luminanceSmoothing={0.65} radius={0.8} mipmapBlur />
        <ChromaticAberration offset={new Vector2(0.0008, 0.0011)} />
        <Vignette offset={0.28} darkness={0.82} />
        <Noise premultiply blendFunction={BlendFunction.SCREEN} opacity={reduced ? 0 : 0.03} />
      </EffectComposer>
    </Canvas>
  );
}
