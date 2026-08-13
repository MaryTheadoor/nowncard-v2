# NownCard — Theming Protocol

> Authoritative outline of the site-wide theming system: token taxonomy, inventory,
> how it's wired, and the rules for extending it. All site-chrome colors route through
> CSS variables that are editable from **Admin → Theme** and stored in Firestore
> `config/theme` (applied to every visitor on load).

---

## 1. How it works

1. **Tokens are defined** in `src/index.css` as CSS custom properties on `:root` (light)
   and `.dark` (dark), and mapped into Tailwind v4's `@theme` block
   (`--color-<name>: var(--<name>)`) so utilities like `bg-tile`, `text-accent`,
   `border-success/25` resolve to the tokens.
2. **The admin panel** (`src/components/CssThemePanel.tsx`) lists every editable token
   (light + dark) with a color picker + hex field, a **live surface preview**
   (`src/components/ThemePreview.tsx`), and debounced persistence.
3. **Overrides are stored** in Firestore `config/theme` via `src/lib/css-theme.ts` and
   re-injected on load as a `<style>` tag with mode-scoped rules
   (`:root:not(.dark)` / `.dark`). Values are sanitized (hex-only) on write and read.

## 2. Token taxonomy

Tokens are grouped by role. Naming is lowercase, kebab-case, semantic (never a literal
color name like `blue-400`).

| Group | Tokens | Purpose |
|-------|--------|---------|
| Surfaces | `space`, `space-2`, `tile`, `tile-soft`, `card-bg` | page bg, section bg, panels, subtle panels |
| Text | `ink`, `ink-muted`, `ink-faint` | primary / muted / faint text |
| Borders | `line`, `line-soft` | panel borders, subtle dividers |
| Accents | `accent`, `accent-hover`, `secondary`, `secondary-hover` | brand gold + brand blue |
| Semantic | `danger`, `success`, `warning`, `violet` | error / positive / caution / business-purple |
| Special | `tile-gold`, `tile-gold-text`, `tile-blue`, `tile-blue-text` | homepage callout tiles |
| Buttons | `btn-primary`, `btn-primary-text`, `btn-secondary`, `btn-secondary-text`, `btn-danger`, `btn-danger-text` | tactile buttons (base + label) |

## 3. Inventory (light / dark)

| Token | Light | Dark | Controls |
|-------|-------|------|----------|
| `space` | `#f8f9fa` | `#391681` | page background |
| `space-2` | `#ffffff` | `#2e1270` | alternate section bg |
| `tile` | `#ffffff` | `#111827` | cards/panels |
| `tile-soft` | `#f1f5f9` | `#1a2235` | subtle panels |
| `card-bg` | `#ffffff` | `#f4f1ec` | light card-face bg |
| `ink` | `#0f172a` | `#f8f9fc` | primary text |
| `ink-muted` | `#64748b` | `#8a93a5` | secondary text |
| `ink-faint` | `#94a3b8` | `#7d89a1` | tertiary/hint text |
| `line` | `#e2e8f0` | `#4b3a93` | borders |
| `line-soft` | `#f1f5f9` | `#3a2a78` | subtle dividers |
| `accent` | `#d4a34a` | `#f5b940` | brand gold (CTAs, highlights) |
| `accent-hover` | `#c1913a` | `#ffc95e` | accent hover |
| `secondary` | `#4a90d9` | `#74b8ff` | brand blue (info, headings) |
| `secondary-hover` | `#3d7ec4` | `#86c4ff` | secondary hover |
| `danger` | `#ef4444` | `#ef4444` | errors/destructive |
| `success` | `#059669` | `#34d399` | positive/available/saved |
| `warning` | `#b45309` | `#fbbf24` | caution/pending/pro plan |
| `violet` | `#7c3aed` | `#a78bfa` | business/team accent |
| `tile-gold` / `tile-gold-text` | `#d4a34a` / `#1a1408` | `#f5b940` / `#1a1408` | gold callout tile |
| `tile-blue` / `tile-blue-text` | `#3578b8` / `#ffffff` | `#2f6ba5` / `#ffffff` | blue callout tile |
| `btn-primary` / `btn-primary-text` | `#e2ad41` / `#1a1408` | same | primary button |
| `btn-secondary` / `btn-secondary-text` | `#2f6ba5` / `#ffffff` | same | secondary button |
| `btn-danger` / `btn-danger-text` | `#dc2626` / `#ffffff` | same | danger button |

> Button *depth* (highlight/shade/edge) is derived from the base color with fixed
> `rgba()` overlays — never `color-mix()` — for cross-browser consistency (see §4).

## 4. Rules / protocol

1. **Never hardcode a color in a component.** Use a token utility (`bg-tile`,
   `text-ink-muted`, `border-success/25`, `fill-warning`) or `var(--token)` for inline styles.
   Raw Tailwind palette classes (`text-blue-400`, `bg-emerald-500/10`) and hex literals
   are not allowed for site chrome.
2. **Adding a new token:** define it in `:root` **and** `.dark`, map it in `@theme`
   (`--color-<name>: var(--<name>)`), and add it to `CSS_THEME_VARS` in
   `src/lib/css-theme.ts` (and a section in `CssThemePanel.tsx`) so it's editable.
3. **Buttons:** base color + label color tokens only; depth is fixed `rgba()` overlays.
   Do **not** use `color-mix`/`oklab` in gradients or `box-shadow` (breaks Firefox mobile).
4. **Semantic colors** (`success`/`warning`/`danger`/`violet`/`secondary`) are for status
   badges, plan labels, and icon accents — not arbitrary decoration.
5. **Card-face colors are out of scope** for site theming: `--card-*` tokens (and the
   `useCardTheme` hex fallbacks) are the *per-card* design system controlled by the card
   editor (`card.cardTheme`, `cardBgColor`, `textColor`, `accentColor`), not the site theme.
6. **Third-party brand colors** (e.g. the Google sign-in button) stay hardcoded by design.

## 5. Known gaps (hardcoded colors still to migrate)

| Location | Color | Notes |
|----------|-------|-------|
| `LandingPage.tsx` hero glows | `rgba(245,185,64,0.20)`, `rgba(116,184,255,0.14)` | radial glows behind hero; derive from `accent`/`secondary` or add glow tokens |
| `App.tsx` toaster | `#111827` / `#1e293b` / `#f8f9fc` | hardcoded toast chrome |
| `AuthModal.tsx` Google button | `#4285F4` / `#34A853` / `#FBBC05` / `#EA4335` | intentional (Google brand) |
| `DashboardPage.tsx` avatar fallback | `from-[#64748b] to-[#94a3b8]` | neutral gray gradient; low priority |
| `BackgroundPositioner.tsx` | `#d4a34a` (accent), `#0a0e1a` | should reference `--accent`/`--space` |
| `useCardTheme.ts` / card renderers | `#12121a`, `#f4f1ec`, … | per-card face system (out of scope, see §4.5) |
| `index.css` `body::before` noise / `::selection` | fixed rgba | decorative texture/selection |

---

*Last updated: 2026-08-12. Source of truth for wiring: `src/index.css`, `src/lib/css-theme.ts`,
`src/components/CssThemePanel.tsx`, `src/components/ThemePreview.tsx`.*
