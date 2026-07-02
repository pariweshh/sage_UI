import type { VoiceState } from '../voiceClient';
import type { CoreParams } from '../core/states';

/**
 * One theme = the whole visual identity in one object: the orb's per-state
 * params, the canvas far-field, and every semantic CSS token the chrome uses.
 * Reskinning Sage (the per-client story) means writing one of these; the
 * selfcheck proves both shipped themes define the identical key sets.
 */
export interface ThemeSpec {
  id: 'sage' | 'vault';
  label: string;
  /** Canvas far-field color behind the orb. */
  background: string;
  /** Per-state orb + particle params (color says who is talking). */
  core: Record<VoiceState, CoreParams>;
  /** Semantic CSS custom properties applied to :root on selection. */
  css: Record<string, string>;
}
