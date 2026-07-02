import { SAGE_THEME } from './src/themes/sage';
import { VAULT_THEME } from './src/themes/vault';
import type { ThemeSpec } from './src/themes/types';

// Proves the reskin story: both shipped themes define IDENTICAL key sets
// (css tokens, states, per-state params) with well-formed values. Run: npx tsx themes.selfcheck.ts
let ok = true;
const check = (name: string, passed: boolean): void => {
  console.log(`${passed ? 'PASS' : 'FAIL'}: ${name}`);
  if (!passed) ok = false;
};

const HEX_RE = /^#[0-9a-f]{6}$/i;
const CSS_VALUE_RE = /^(#[0-9a-f]{6}|rgba\([\d\s,.]+\)|[\d\s,]+)$/i;
const STATES = ['idle', 'listening', 'thinking', 'speaking'] as const;
const PARAM_KEYS = ['color', 'emissive', 'audioGain', 'coreScale', 'pulse', 'waveAmp', 'flowSpeed', 'particleEnergy', 'particleSpread'];

const themes: ThemeSpec[] = [SAGE_THEME, VAULT_THEME];

// 1. CSS token parity: same var names in both themes, no more, no less.
const keysOf = (t: ThemeSpec): string => Object.keys(t.css).sort().join(',');
check('both themes define the identical css token set', keysOf(SAGE_THEME) === keysOf(VAULT_THEME));

for (const theme of themes) {
  // 2. Every css value is a well-formed hex/rgba/rgb-triple string.
  check(
    `${theme.id}: css values are well-formed`,
    Object.values(theme.css).every((v) => CSS_VALUE_RE.test(v.trim())),
  );
  // 3. Every state exists with a complete param set and a valid hex color.
  check(
    `${theme.id}: all four states have complete core params`,
    STATES.every(
      (s) =>
        PARAM_KEYS.every((k) => k in theme.core[s]) &&
        HEX_RE.test(theme.core[s].color) &&
        PARAM_KEYS.filter((k) => k !== 'color').every((k) => Number.isFinite((theme.core[s] as unknown as Record<string, number>)[k])),
    ),
  );
  // 4. The background is a valid hex.
  check(`${theme.id}: background is a valid hex`, HEX_RE.test(theme.background));
}

// 5. The themes are actually different (a copy-paste reskin that changes nothing is a bug).
check(
  'the two themes differ where it matters',
  SAGE_THEME.css['--accent'] !== VAULT_THEME.css['--accent'] && SAGE_THEME.core.idle.color !== VAULT_THEME.core.idle.color,
);

console.log(ok ? 'THEMES SELFCHECK PASS' : 'THEMES SELFCHECK FAIL');
process.exit(ok ? 0 : 1);
