// GLSL for the 3D plasma orb + its particle halo. The orb is a high-subdivision
// IcosahedronGeometry displaced along its normals; normals are RECOMPUTED analytically
// after displacement so the surface catches light and reads as a dimensional object.
// Everything is additive over the near-black field, so brightness = glow and Bloom
// (fixed intensity) catches it. Emissive rises from the voice envelope in-shader —
// there is NO per-frame bloom uniform.

// Ashima 3D simplex noise (snoise -> ~[-1,1]).
const SNOISE3 = /* glsl */ `
  vec3 mod289(vec3 x){ return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 mod289(vec4 x){ return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 permute(vec4 x){ return mod289(((x * 34.0) + 1.0) * x); }
  vec4 taylorInvSqrt(vec4 r){ return 1.79284291400159 - 0.85373472095314 * r; }
  float snoise(vec3 v){
    const vec2 C = vec2(1.0/6.0, 1.0/3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i  = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;
    i = mod289(i);
    vec4 p = permute(permute(permute(
              i.z + vec4(0.0, i1.z, i2.z, 1.0))
            + i.y + vec4(0.0, i1.y, i2.y, 1.0))
            + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    vec4 s0 = floor(b0) * 2.0 + 1.0;
    vec4 s1 = floor(b1) * 2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);
    vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
  }
`;

// fractal Brownian motion: 4 octaves of snoise for smooth, organic flow.
const FBM = /* glsl */ `
  float fbm(vec3 p){
    float f = 0.0, amp = 0.5;
    for (int i = 0; i < 4; i++) { f += amp * snoise(p); p *= 2.03; amp *= 0.5; }
    return f;
  }
`;

// Orb vertex shader: displace each vertex along its normal by layered fbm (waves that
// travel), then RECOMPUTE the normal from two tangent-offset neighbour samples so the
// lit surface reads as dimensional. uShock adds a brief travelling ripple.
export const ORB_VERT = /* glsl */ `
  precision highp float;
  uniform float uTime, uFlowTime, uWaveAmp, uEnv, uShock, uNoiseFreq;
  varying vec3 vNormal;
  varying vec3 vView;
  varying vec3 vPos;
  varying float vDisp;
  ${SNOISE3}
  ${FBM}
  float displace(vec3 dir) {
    float amt = uWaveAmp * (1.0 + uEnv * 1.5);
    float d = fbm(dir * uNoiseFreq + vec3(0.0, 0.0, uFlowTime * 0.6));
    d += 0.5 * fbm(dir * uNoiseFreq * 2.3 + vec3(uFlowTime * -0.9, 0.0, 0.0));
    d *= amt;
    d += uShock * uWaveAmp * 0.9 * sin(dir.y * 9.0 - uTime * 11.0);
    return d;
  }
  void main() {
    vec3 dir = normalize(position);
    float R = length(position);
    float d = displace(dir);
    vec3 displaced = dir * (R + d);

    vec3 ref = abs(dir.y) < 0.99 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
    vec3 tang = normalize(cross(dir, ref));
    vec3 bitang = normalize(cross(dir, tang));
    float eps = 0.04;
    vec3 dA = normalize(dir + tang * eps);
    vec3 dB = normalize(dir + bitang * eps);
    vec3 pA = dA * (R + displace(dA));
    vec3 pB = dB * (R + displace(dB));
    vec3 nrm = normalize(cross(pA - displaced, pB - displaced));
    if (dot(nrm, dir) < 0.0) nrm = -nrm;

    vec4 wp = modelMatrix * vec4(displaced, 1.0);
    vNormal = normalize(mat3(modelMatrix) * nrm);
    vView = normalize(cameraPosition - wp.xyz);
    vPos = displaced;
    vDisp = d / max(uWaveAmp, 0.001);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
  }
`;

// Orb fragment shader: hot plasma gradient with domain-warped internal flow, a fake
// directional term (form) from the recomputed normal, and a fresnel rim (the glow).
export const ORB_FRAG = /* glsl */ `
  precision highp float;
  uniform vec3 uColor;
  uniform float uEmissive, uEnv, uFlowTime, uPulse, uTime;
  varying vec3 vNormal;
  varying vec3 vView;
  varying vec3 vPos;
  varying float vDisp;
  ${SNOISE3}
  ${FBM}
  void main() {
    vec3 N = normalize(vNormal);
    vec3 V = normalize(vView);
    vec3 L = normalize(vec3(0.4, 0.55, 0.75));
    float ndl = clamp(dot(N, L) * 0.5 + 0.5, 0.0, 1.0);     // wrap lighting -> soft form
    float fres = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 2.5); // rim glow

    vec3 q = vPos * 3.0;
    vec3 warp = vec3(
      fbm(q + uFlowTime * 0.3),
      fbm(q + vec3(3.1) - uFlowTime * 0.2),
      fbm(q + vec3(7.7) + uFlowTime * 0.15)
    );
    float plasma = 0.5 + 0.5 * fbm(q + warp * 1.2);
    float veins = smoothstep(0.6, 1.0, plasma + vDisp * 0.22);   // bright hot filaments

    // Saturated state-hue body, shaded by form + plasma; only hot veins go near-white,
    // so Bloom catches veins + rim (not the whole sphere -> stays coloured, not a grey moon).
    vec3 body = uColor * (0.55 + 0.7 * plasma) * (0.55 + 0.45 * ndl);
    vec3 col = mix(body, mix(uColor, vec3(1.0), 0.75), veins * 0.85);

    float pulse = 1.0 + uPulse * 0.35 * sin(uTime * 4.0);
    float gain = uEmissive * (1.0 + uEnv * 1.9) * pulse;
    vec3 outc = col * gain + uColor * fres * 1.6 * gain;          // colored fresnel rim glow
    gl_FragColor = vec4(outc, 1.0);
  }
`;

// Particle halo: additive glowing points around the orb. They drift/swirl gently,
// expand outward with the envelope, and get pushed out by uShock. Base positions carry
// radius 1..~1.6 (units of orb radius); the vertex scales by uOrbR.
export const POINTS_VERT = /* glsl */ `
  precision highp float;
  attribute float aSeed;
  uniform float uTime, uOrbR, uEnv, uShock, uSpread, uEnergy, uSize, uPixelRatio, uReduced;
  varying float vGlow;
  ${SNOISE3}
  void main() {
    vec3 dir = normalize(position);
    float baseR = length(position);
    float redMul = uReduced > 0.5 ? 0.4 : 1.0;
    float ang = uTime * (0.06 + 0.14 * aSeed) * redMul * (1.0 + uEnergy * 0.8);
    float ca = cos(ang), sa = sin(ang);
    vec3 sw = vec3(dir.x * ca - dir.z * sa, dir.y, dir.x * sa + dir.z * ca);
    float wander = snoise(dir * 3.0 + uTime * 0.25 * (1.0 + uEnergy)) * (0.04 + 0.12 * uEnergy) * redMul;
    float expand = baseR + uEnv * uSpread + uShock * 0.5 * (1.0 - aSeed * 0.4) + wander;
    vec3 pos = sw * expand * uOrbR;
    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;
    float boost = 1.0 + uEnv * 1.9 + uShock * 0.9;
    gl_PointSize = uSize * uPixelRatio * boost / max(0.15, -mv.z);
    vGlow = 0.4 + 0.7 * uEnv + 0.4 * uShock + 0.15 * uEnergy;
  }
`;

export const POINTS_FRAG = /* glsl */ `
  precision highp float;
  uniform vec3 uColor;
  varying float vGlow;
  void main() {
    vec2 uv = gl_PointCoord * 2.0 - 1.0;
    float d2 = dot(uv, uv);
    if (d2 > 1.0) discard;
    float a = 1.0 - d2;
    a *= a;                                   // soft round falloff
    vec3 c = uColor * (0.5 + 0.9 * vGlow);
    gl_FragColor = vec4(c * a, a);
  }
`;

// Orbital arc rings (thin tori around the orb). Each ring is mostly faint with a few
// hash-scattered bright accent arcs and gaps (matching the reference); the pattern
// rotates via uRot and brightens with the voice envelope. Soft tube cross-section so
// Bloom catches the glow.
export const RING_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const RING_FRAG = /* glsl */ `
  precision highp float;
  uniform vec3 uColor;
  uniform float uRot, uEmissive, uEnv, uShock, uSegs, uGap, uAccent, uBase, uSeed;
  varying vec2 vUv;
  float hash(float n){ return fract(sin(n * 12.9898 + uSeed) * 43758.5453); }
  void main() {
    float a = vUv.x + uRot;                                  // around the ring, rotating
    float cross = sin(clamp(vUv.y, 0.0, 1.0) * 3.14159265);  // soft tube cross-section
    float seg = a * uSegs;
    float idx = floor(seg);
    float fseg = fract(seg);
    float h = hash(idx);
    float present = step(uGap, h);                           // some segments are gaps
    float bright = step(1.0 - uAccent, h);                   // top fraction = bright accents
    float edges = smoothstep(0.0, 0.07, fseg) * smoothstep(1.0, 0.93, fseg);
    float level = present * (uBase + bright);
    float bri = level * edges * cross * uEmissive * (1.0 + uEnv * 1.9 + uShock * 0.9);
    vec3 col = mix(uColor, vec3(1.0), bright * (0.22 + uEnv * 0.4));
    gl_FragColor = vec4(col * bri, 1.0);
  }
`;
