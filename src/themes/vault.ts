import type { ThemeSpec } from './types';

// The V.A.U.L.T.-inspired alternate: violet chrome on a purple-black field,
// acid-green cut accents, green speaking. Same motion identity as Sage - only
// the palette shifts (proof the reskin story holds).
export const VAULT_THEME: ThemeSpec = {
  id: 'vault',
  label: 'Vault',
  background: '#050208',
  core: {
    idle: {
      color: '#8b7bff', emissive: 0.62, audioGain: 0.0, coreScale: 1.0, pulse: 0.0,
      waveAmp: 0.022, flowSpeed: 0.25, particleEnergy: 0.15, particleSpread: 0.3,
    },
    listening: {
      color: '#b3a1ff', emissive: 1.05, audioGain: 1.8, coreScale: 1.06, pulse: 0.0,
      waveAmp: 0.05, flowSpeed: 0.6, particleEnergy: 0.45, particleSpread: 1.1,
    },
    thinking: {
      color: '#e08cff', emissive: 0.9, audioGain: 0.0, coreScale: 1.0, pulse: 1.0,
      waveAmp: 0.036, flowSpeed: 1.35, particleEnergy: 0.7, particleSpread: 0.3,
    },
    speaking: {
      color: '#7dff9d', emissive: 1.0, audioGain: 1.5, coreScale: 1.04, pulse: 0.0,
      waveAmp: 0.042, flowSpeed: 0.52, particleEnergy: 0.4, particleSpread: 0.85,
    },
  },
  css: {
    '--space': '#050208',
    '--accent': '#9d8cff',
    '--accent-hi': '#c9bdff',
    '--accent-dim': '#6a5f9e',
    '--accent-rgb': '157, 140, 255',
    '--line': 'rgba(157, 140, 255, 0.18)',
    '--line-2': 'rgba(157, 140, 255, 0.09)',
    '--grid': 'rgba(157, 140, 255, 0.05)',
    '--panel': 'rgba(12, 8, 22, 0.42)',
    '--text': '#b4a9d6',
    '--text-hi': '#e8e2fb',
    '--text-dim': '#6f6488',
    '--state-thinking': '#e08cff',
    '--state-speaking': '#7dff9d',
    '--ok': '#5fe0a0',
    '--warn': '#ffcf6b',
    '--alert': '#ff6b5f',
    '--cut-accent': '#a6ff3e',
    '--cut-accent-dim': '#6f9e37',
    '--cut-line': 'rgba(157, 140, 255, 0.32)',
  },
};
