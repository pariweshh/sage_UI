import { useCallback, useEffect, useState } from 'react';
import type { ThemeSpec } from './themes/types';
import { SAGE_THEME } from './themes/sage';
import { VAULT_THEME } from './themes/vault';

export const THEMES: Record<'sage' | 'vault', ThemeSpec> = { sage: SAGE_THEME, vault: VAULT_THEME };
export type ThemeId = keyof typeof THEMES;

const STORAGE_KEY = 'sage-theme';

/**
 * Theme selection: applies the chosen theme's semantic CSS tokens to :root and
 * hands the ThemeSpec to the 3D core. Pure presentation - no backend involvement,
 * no firewall impact. Sticky via localStorage.
 */
export function useTheme(): { theme: ThemeSpec; themeId: ThemeId; toggle: () => void } {
  const [themeId, setThemeId] = useState<ThemeId>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'vault' ? 'vault' : 'sage';
    } catch {
      return 'sage';
    }
  });

  useEffect(() => {
    const theme = THEMES[themeId];
    const root = document.documentElement;
    root.dataset.theme = themeId;
    for (const [key, value] of Object.entries(theme.css)) root.style.setProperty(key, value);
    try {
      localStorage.setItem(STORAGE_KEY, themeId);
    } catch {
      // Private-mode storage failures just lose stickiness, nothing else.
    }
  }, [themeId]);

  const toggle = useCallback(() => setThemeId((t) => (t === 'sage' ? 'vault' : 'sage')), []);
  return { theme: THEMES[themeId], themeId, toggle };
}
