// Base positions for the orb's particle halo. Even angular distribution via a fibonacci
// sphere; radius biased toward the surface (1.0) with a tail out to ~1.6 (units of orb
// radius — the points vertex shader scales by uOrbR). Deterministic (index-based, no
// Math.random) so it doesn't reshuffle between reloads.
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

export function makeParticles(count: number): { positions: Float32Array; seeds: Float32Array } {
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const y = 1 - (i / (count - 1)) * 2; // 1 .. -1
    const ringR = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = GOLDEN_ANGLE * i;
    const x = Math.cos(theta) * ringR;
    const z = Math.sin(theta) * ringR;
    // low-discrepancy radius: most points near the surface, some out in the halo
    const t = (i * 0.6180339887498949) % 1;
    const rad = 1.0 + Math.pow(t, 1.6) * 0.6; // 1.0 .. 1.6
    positions[i * 3] = x * rad;
    positions[i * 3 + 1] = y * rad;
    positions[i * 3 + 2] = z * rad;
    seeds[i] = t;
  }
  return { positions, seeds };
}
