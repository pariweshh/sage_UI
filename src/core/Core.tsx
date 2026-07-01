import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, Color, type Group } from 'three';
import { ORB_VERT, ORB_FRAG, POINTS_VERT, POINTS_FRAG, RING_VERT, RING_FRAG } from './coreShaders';
import { STATE_TARGETS, cloneParams, type CoreParams } from './states';
import { choreograph } from './choreography';
import { makeParticles } from './particles';
import type { VoiceState } from '../voiceClient';

interface CoreProps {
  state: VoiceState;
  getAmplitude: () => number;
  reduced: boolean;
  replyPulse: number;
  /** Conversation mode armed (waiting for me to speak): a subtle "hot/listening" cue on idle. */
  armed?: boolean;
}

const IDLE = STATE_TARGETS.idle.color;
const ORB_R = 0.3; // orb radius (world units)
const ORB_DETAIL = 24; // icosahedron subdivision — smooth, even verts, no pole pinch
const HERO = 1.5; // orb-as-centerpiece: scales the whole core (orb + rings + particles)
const PARTICLE_COUNT = 3500;
const DPR = typeof window !== 'undefined' ? Math.min(2, window.devicePixelRatio || 1) : 1;

// Orbital arc rings around the orb: sparse, tilted for depth, each mostly faint with a
// few bright accent arcs + gaps. Always present; reactive via uEnv/uShock/uColor.
const RINGS = [
  { radius: 0.4, tube: 0.0042, tilt: [0.16, 0.05, 0.0], segs: 7, gap: 0.32, accent: 0.34, base: 0.13, seed: 1.3, speed: 0.05 },
  { radius: 0.46, tube: 0.0042, tilt: [0.2, -0.04, 0.0], segs: 9, gap: 0.34, accent: 0.3, base: 0.12, seed: 5.7, speed: -0.04 },
  { radius: 0.52, tube: 0.0048, tilt: [0.17, 0.06, 0.0], segs: 6, gap: 0.34, accent: 0.36, base: 0.12, seed: 9.1, speed: 0.045 },
  { radius: 0.58, tube: 0.0048, tilt: [0.21, -0.05, 0.0], segs: 8, gap: 0.36, accent: 0.32, base: 0.11, seed: 13.2, speed: -0.03 },
] as const;

export function Core({ state, getAmplitude, reduced, replyPulse, armed }: CoreProps) {
  const groupRef = useRef<Group>(null);
  const params = useRef<CoreParams>(cloneParams(STATE_TARGETS.idle));
  const tlRef = useRef<ReturnType<typeof choreograph> | null>(null);
  const time = useRef(0);
  const flow = useRef(0);
  const audioSm = useRef(0);
  const prevAmp = useRef(0);
  const shock = useRef(0);
  const orbRot = useRef(0);
  const ringsGroupRef = useRef<Group>(null);
  const ringRot = useRef<number[]>(RINGS.map(() => 0));
  const pointer = useRef({ x: 0, y: 0 });
  const renderCol = useRef(new Color(IDLE));
  const tmpCol = useMemo(() => new Color(), []);

  const particles = useMemo(() => makeParticles(PARTICLE_COUNT), []);

  const uOrb = useMemo(
    () => ({
      uTime: { value: 0 },
      uFlowTime: { value: 0 },
      uColor: { value: new Color(IDLE) },
      uEmissive: { value: 0.62 },
      uEnv: { value: 0 },
      uShock: { value: 0 },
      uWaveAmp: { value: 0.022 },
      uNoiseFreq: { value: 1.8 },
      uPulse: { value: 0 },
    }),
    [],
  );
  const uPoints = useMemo(
    () => ({
      uTime: { value: 0 },
      uOrbR: { value: ORB_R },
      uColor: { value: new Color(IDLE) },
      uEnv: { value: 0 },
      uShock: { value: 0 },
      uSpread: { value: 0.3 },
      uEnergy: { value: 0.15 },
      uSize: { value: 6.5 },
      uPixelRatio: { value: DPR },
      uReduced: { value: reduced ? 1 : 0 },
    }),
    [reduced],
  );
  const uRings = useMemo(
    () =>
      RINGS.map((r) => ({
        uRot: { value: 0 },
        uEmissive: { value: 1.05 },
        uEnv: { value: 0 },
        uShock: { value: 0 },
        uColor: { value: new Color(IDLE) },
        uSegs: { value: r.segs },
        uGap: { value: r.gap },
        uAccent: { value: r.accent },
        uBase: { value: r.base },
        uSeed: { value: r.seed },
      })),
    [],
  );

  // pointer parallax
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      pointer.current = { x: (e.clientX / window.innerWidth) * 2 - 1, y: (e.clientY / window.innerHeight) * 2 - 1 };
    };
    window.addEventListener('pointermove', onMove);
    return () => window.removeEventListener('pointermove', onMove);
  }, []);

  // choreograph each state change (kill the prior timeline first)
  useEffect(() => {
    tlRef.current?.kill();
    tlRef.current = choreograph(params.current, state, reduced);
    return () => {
      tlRef.current?.kill();
    };
  }, [state, reduced]);

  // A silent typed reply: fire a one-shot impulse (reuses the shock mechanism, so the
  // pulse propagates through orb + particles + rings). The initial 0 doesn't fire; under
  // reduced motion the frame loop forces shock to 0, keeping it calm.
  useEffect(() => {
    if (replyPulse > 0) shock.current = 1;
  }, [replyPulse]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const p = params.current;
    time.current += dt * (reduced ? 0.5 : 1);
    const T = time.current;

    const amp = getAmplitude();
    // Envelope follower: fast attack, slow release -> reacts instantly, settles smoothly.
    const envTau = amp > audioSm.current ? 0.012 : 0.18;
    audioSm.current += (amp - audioSm.current) * (1 - Math.exp(-dt / envTau));
    const env = (reduced ? audioSm.current * 0.5 : audioSm.current) * p.audioGain;

    // Conversation mode "armed" cue: a subtle brighter breathing glow on idle, so I can tell the
    // mic is hot and waiting — distinct from, and far gentler than, the listening ignition.
    const armedIdle = armed === true && state === 'idle';
    const armedGlow = armedIdle ? (reduced ? 0.12 : 0.06 + (Math.sin(T * 2.2) * 0.5 + 0.5) * 0.16) : 0;

    // Voice speeds the surface flow too -> waves travel faster when ignited.
    flow.current += dt * p.flowSpeed * (1 + env * 0.6) * (reduced ? 0.4 : 1);

    if (!reduced) {
      if (amp - prevAmp.current > 0.12 && amp > 0.22) shock.current = 1;
      shock.current *= Math.exp(-dt / 0.22);
    } else {
      shock.current = 0;
    }
    prevAmp.current = amp;

    tmpCol.set(p.color);
    renderCol.current.lerp(tmpCol, 1 - Math.exp(-dt / 0.18));
    const col = renderCol.current;

    const breath = Math.sin(T * 0.6) * 0.025 + Math.sin(T * 1.7) * 0.012;
    const scale = HERO * p.coreScale * (1 + breath + env * 0.09 + shock.current * 0.08);
    const g = groupRef.current;
    if (g) {
      g.scale.setScalar(scale);
      orbRot.current += dt * (reduced ? 0.04 : 0.11);
      g.rotation.y = orbRot.current;
      const tx = 0.18 + (reduced ? 0 : -pointer.current.y * 0.12);
      const k = 1 - Math.exp(-dt / (reduced ? 0.3 : 0.2));
      g.rotation.x += (tx - g.rotation.x) * k;
    }

    uOrb.uTime.value = T;
    uOrb.uFlowTime.value = flow.current;
    uOrb.uColor.value.copy(col);
    uOrb.uEmissive.value = p.emissive + armedGlow;
    uOrb.uEnv.value = env;
    uOrb.uShock.value = shock.current;
    uOrb.uWaveAmp.value = p.waveAmp;
    uOrb.uPulse.value = p.pulse;

    uPoints.uTime.value = flow.current;
    uPoints.uColor.value.copy(col);
    uPoints.uEnv.value = env;
    uPoints.uShock.value = shock.current;
    uPoints.uSpread.value = p.particleSpread;
    uPoints.uEnergy.value = p.particleEnergy + (armedIdle ? 0.06 : 0);
    uPoints.uReduced.value = reduced ? 1 : 0;

    for (let i = 0; i < RINGS.length; i++) {
      ringRot.current[i] += dt * RINGS[i].speed * (1 + env * 2) * (reduced ? 0.3 : 1);
      const u = uRings[i];
      u.uRot.value = ringRot.current[i];
      u.uEnv.value = env;
      u.uShock.value = shock.current;
      u.uColor.value.copy(col);
    }
    const rg = ringsGroupRef.current;
    if (rg) rg.scale.setScalar(1 + shock.current * 0.06 + env * 0.025);
  });

  const orbMat = { transparent: true, depthWrite: false, depthTest: false, blending: AdditiveBlending, toneMapped: false };
  const ptsMat = { transparent: true, depthWrite: false, depthTest: false, blending: AdditiveBlending, toneMapped: false };

  return (
    <group ref={groupRef} position={[0, 0.28, 0]} rotation={[0.18, 0, 0]}>
      <mesh>
        <icosahedronGeometry args={[ORB_R, ORB_DETAIL]} />
        <shaderMaterial vertexShader={ORB_VERT} fragmentShader={ORB_FRAG} uniforms={uOrb} {...orbMat} />
      </mesh>
      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[particles.positions, 3]} />
          <bufferAttribute attach="attributes-aSeed" args={[particles.seeds, 1]} />
        </bufferGeometry>
        <shaderMaterial vertexShader={POINTS_VERT} fragmentShader={POINTS_FRAG} uniforms={uPoints} {...ptsMat} />
      </points>
      <group ref={ringsGroupRef}>
        {RINGS.map((r, i) => (
          <mesh key={i} rotation={[r.tilt[0], r.tilt[1], r.tilt[2]]}>
            <torusGeometry args={[r.radius, r.tube, 8, 220]} />
            <shaderMaterial vertexShader={RING_VERT} fragmentShader={RING_FRAG} uniforms={uRings[i]} {...ptsMat} />
          </mesh>
        ))}
      </group>
    </group>
  );
}
