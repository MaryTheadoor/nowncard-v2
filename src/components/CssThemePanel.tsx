import { useEffect, useState } from 'react';
import { Palette, RefreshCw, Copy, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import {
  CSS_THEME_VARS, loadThemeOverrides, saveThemeOverrides, applyThemeOverrides,
  clearThemeOverrides, getEffectiveVar, getThemeDefaults,
  type CssThemeOverrides,
} from '@/lib/css-theme';

type VarValues = Record<string, { light: string; dark: string }>;
type Mode = 'light' | 'dark';

const SECTIONS: { label: string; vars: string[] }[] = [
  { label: 'Page & Surfaces', vars: ['space', 'space-2', 'tile', 'tile-soft', 'card-bg', 'line', 'line-soft'] },
  { label: 'Text', vars: ['ink', 'ink-muted', 'ink-faint'] },
  { label: 'Accents & Buttons', vars: ['accent', 'accent-hover', 'secondary', 'secondary-hover', 'danger'] },
  { label: 'Homepage Tiles', vars: ['tile-gold', 'tile-gold-text', 'tile-blue', 'tile-blue-text'] },
];

function captureCurrent(): VarValues {
  const overrides = loadThemeOverrides();
  const out = {} as VarValues;
  for (const name of CSS_THEME_VARS) {
    out[name] = {
      light: overrides.light[name] || getEffectiveVar(name, 'light'),
      dark: overrides.dark[name] || getEffectiveVar(name, 'dark'),
    };
  }
  return out;
}

function VarInput({ value, onCommit }: { value: string; onCommit: (v: string) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? value;
  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={/^#[0-9a-f]{6}$/i.test(value) ? value : '#000000'}
        onChange={(e) => onCommit(e.target.value)}
        className="w-8 h-8 rounded cursor-pointer border border-line bg-transparent"
        title="Pick color"
      />
      <input
        type="text"
        value={shown}
        onChange={(e) => {
          setDraft(e.target.value);
          if (/^#[0-9a-f]{6}$/i.test(e.target.value)) onCommit(e.target.value.toLowerCase());
        }}
        onBlur={() => setDraft(null)}
        className="w-24 px-2 py-1 bg-space border border-line rounded-lg text-xs font-mono text-ink focus:outline-none focus:border-accent"
        spellCheck={false}
      />
    </div>
  );
}

export default function CssThemePanel() {
  const [defaults] = useState<VarValues>(getThemeDefaults);
  const [values, setValues] = useState<VarValues>(captureCurrent);

  useEffect(() => {
    const overrides: CssThemeOverrides = { light: {}, dark: {} };
    for (const name of CSS_THEME_VARS) {
      if (values[name].light !== defaults[name].light) overrides.light[name] = values[name].light;
      if (values[name].dark !== defaults[name].dark) overrides.dark[name] = values[name].dark;
    }
    applyThemeOverrides(overrides);
    saveThemeOverrides(overrides);
  }, [values, defaults]);

  const update = (name: string, mode: Mode, value: string) => {
    setValues((prev) => ({ ...prev, [name]: { ...prev[name], [mode]: value } }));
  };

  const reset = () => {
    clearThemeOverrides();
    setValues(defaults);
    toast.success('Theme reset to defaults');
  };

  const exportCss = async () => {
    const block = (mode: Mode) =>
      CSS_THEME_VARS.map((name) => `  --${name}: ${values[name][mode]};`).join('\n');
    const css = `:root {\n${block('light')}\n}\n\n.dark {\n${block('dark')}\n}`;
    try {
      await navigator.clipboard.writeText(css);
      toast.success('Theme CSS copied to clipboard');
    } catch {
      toast.error('Could not copy CSS');
    }
  };

  return (
    <section className="bg-tile border border-line rounded-2xl p-6">
      <div className="flex items-start justify-between gap-3 flex-wrap mb-5">
        <div>
          <h2 className="text-lg font-extrabold flex items-center gap-2">
            <Palette className="w-5 h-5 text-accent" /> Site Theme (CSS variables)
          </h2>
          <p className="text-xs text-ink-muted mt-1">
            Adjust colors live — saved to this browser and applied instantly. Export the CSS to
            commit changes to the codebase permanently.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportCss} className="btn btn-secondary btn-sm">
            <Copy className="w-3.5 h-3.5" /> Export CSS
          </button>
          <button onClick={reset} className="btn btn-danger btn-sm">
            <RotateCcw className="w-3.5 h-3.5" /> Reset
          </button>
        </div>
      </div>

      <div className="space-y-6">
        {SECTIONS.map((section) => (
          <div key={section.label}>
            <h3 className="text-xs font-bold uppercase tracking-wider text-ink-faint mb-3">{section.label}</h3>
            <div className="space-y-2">
              <div className="grid grid-cols-[9rem_1fr_1fr] items-center gap-3 text-[11px] font-bold uppercase tracking-wider text-ink-faint px-1">
                <span>Variable</span>
                <span>Light</span>
                <span>Dark</span>
              </div>
              {section.vars.map((name) => (
                <div key={name} className="grid grid-cols-[9rem_1fr_1fr] items-center gap-3 bg-space border border-line rounded-xl px-3 py-2">
                  <span className="text-xs font-bold font-mono text-ink">{name}</span>
                  <VarInput value={values[name].light} onCommit={(v) => update(name, 'light', v)} />
                  <VarInput value={values[name].dark} onCommit={(v) => update(name, 'dark', v)} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <p className="text-[11px] text-ink-faint mt-5 flex items-center gap-1.5">
        <RefreshCw className="w-3 h-3" /> Overrides live in this browser via localStorage (key{' '}
        <code className="font-mono">nowncard-css-theme</code>).
      </p>
    </section>
  );
}
