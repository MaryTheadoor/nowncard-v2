const STORAGE_KEY = 'nowncard-css-theme';
const STYLE_ID = 'nowncard-css-theme-overrides';

export type CssThemeOverrides = Record<'light' | 'dark', Record<string, string>>;

export const CSS_THEME_VARS = [
  'space', 'space-2', 'tile', 'tile-soft', 'card-bg', 'line', 'line-soft',
  'ink', 'ink-muted', 'ink-faint',
  'accent', 'accent-hover', 'secondary', 'secondary-hover', 'danger',
  'tile-gold', 'tile-gold-text', 'tile-blue', 'tile-blue-text',
] as const;

export function loadThemeOverrides(): CssThemeOverrides {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<CssThemeOverrides>;
      if (parsed && typeof parsed === 'object') {
        return {
          light: parsed.light && typeof parsed.light === 'object' ? parsed.light : {},
          dark: parsed.dark && typeof parsed.dark === 'object' ? parsed.dark : {},
        };
      }
    }
  } catch {
    /* ignore corrupt storage */
  }
  return { light: {}, dark: {} };
}

export function saveThemeOverrides(overrides: CssThemeOverrides) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides)); } catch { /* ignore */ }
}

export function clearThemeOverrides() {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  document.getElementById(STYLE_ID)?.remove();
}

export function applyThemeOverrides(overrides: CssThemeOverrides) {
  const lightRules = Object.entries(overrides.light)
    .map(([name, value]) => `:root:not(.dark) { --${name}: ${value}; }`)
    .join('\n');
  const darkRules = Object.entries(overrides.dark)
    .map(([name, value]) => `.dark { --${name}: ${value}; }`)
    .join('\n');
  const css = [lightRules, darkRules].filter(Boolean).join('\n');
  if (!css) {
    document.getElementById(STYLE_ID)?.remove();
    return;
  }
  let el = document.getElementById(STYLE_ID);
  if (!el) {
    el = document.createElement('style');
    el.id = STYLE_ID;
    document.head.appendChild(el);
  }
  el.textContent = css;
}

export function getEffectiveVar(name: string, mode: 'light' | 'dark'): string {
  const root = document.documentElement;
  const wasDark = root.classList.contains('dark');
  if (mode === 'dark') root.classList.add('dark');
  else root.classList.remove('dark');
  const value = getComputedStyle(root).getPropertyValue(`--${name}`).trim();
  if (mode === 'dark' && !wasDark) root.classList.remove('dark');
  else if (mode === 'light' && wasDark) root.classList.add('dark');
  return value;
}

export function getThemeDefaults(): Record<string, { light: string; dark: string }> {
  document.getElementById(STYLE_ID)?.remove();
  const out = {} as Record<string, { light: string; dark: string }>;
  for (const name of CSS_THEME_VARS) {
    out[name] = { light: getEffectiveVar(name, 'light'), dark: getEffectiveVar(name, 'dark') };
  }
  applyThemeOverrides(loadThemeOverrides());
  return out;
}
