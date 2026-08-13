import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const STORAGE_KEY = 'nowncard-css-theme';
const STYLE_ID = 'nowncard-css-theme-overrides';

export type CssThemeOverrides = Record<'light' | 'dark', Record<string, string>>;

export const CSS_THEME_VARS = [
  'space', 'space-2', 'tile', 'tile-soft', 'card-bg', 'line', 'line-soft',
  'ink', 'ink-muted', 'ink-faint',
  'accent', 'accent-hover', 'secondary', 'secondary-hover', 'danger',
  'success', 'warning', 'violet',
  'tile-gold', 'tile-gold-text', 'tile-blue', 'tile-blue-text',
  'btn-primary', 'btn-primary-text', 'btn-secondary', 'btn-secondary-text',
  'btn-danger', 'btn-danger-text',
] as const;

const HEX_COLOR = /^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/;

function sanitizeMap(raw: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (raw && typeof raw === 'object') {
    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
      if (/^[a-z0-9-]+$/.test(key) && typeof value === 'string' && HEX_COLOR.test(value)) {
        out[key] = value;
      }
    }
  }
  return out;
}

function sanitizeOverrides(raw: unknown): CssThemeOverrides {
  const src = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return { light: sanitizeMap(src.light), dark: sanitizeMap(src.dark) };
}

export function loadThemeOverrides(): CssThemeOverrides {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return sanitizeOverrides(JSON.parse(raw));
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

export async function fetchThemeOverrides(): Promise<CssThemeOverrides> {
  try {
    const snap = await getDoc(doc(db, 'config', 'theme'));
    if (snap.exists()) return sanitizeOverrides(snap.data());
  } catch { /* fall back to empty */ }
  return { light: {}, dark: {} };
}

// Site-wide save — writes to Firestore `config/theme` (readable by everyone,
// writable by admins via firestore.rules). Also caches locally for instant
// re-apply on the next load.
export async function saveThemeOverridesServer(overrides: CssThemeOverrides): Promise<void> {
  const payload = sanitizeOverrides(overrides);
  await setDoc(doc(db, 'config', 'theme'), {
    light: payload.light,
    dark: payload.dark,
    updatedAt: serverTimestamp(),
  }, { merge: true });
  saveThemeOverrides(payload);
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
