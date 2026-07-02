import type { ThemeSpec } from './types';

// The original identity: cyan chrome on near-black, violet thinking, amber
// speaking, cyberpunk-yellow cut accents. Values match the pre-theme HUD.
export const SAGE_THEME: ThemeSpec = {
  id: 'sage',
  label: 'Sage',
  background: '#02050b',
  core: {
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
  },
  css: {
    '--space': '#02050b',
    '--accent': '#3fe0ff',
    '--accent-hi': '#8af0ff',
    '--accent-dim': '#4a7e92',
    '--accent-rgb': '63, 224, 255',
    '--line': 'rgba(90, 200, 255, 0.18)',
    '--line-2': 'rgba(90, 200, 255, 0.09)',
    '--grid': 'rgba(90, 200, 255, 0.05)',
    '--panel': 'rgba(8, 16, 26, 0.42)',
    '--text': '#9fc4d6',
    '--text-hi': '#d6f1fb',
    '--text-dim': '#5b7382',
    '--state-thinking': '#b985ff',
    '--state-speaking': '#ffc15c',
    '--ok': '#5fe0a0',
    '--warn': '#ffcf6b',
    '--alert': '#ff6b5f',
    '--cut-accent': '#f5e000',
    '--cut-accent-dim': '#b8a82e',
    '--cut-line': 'rgba(90, 200, 255, 0.32)',
  },
};
