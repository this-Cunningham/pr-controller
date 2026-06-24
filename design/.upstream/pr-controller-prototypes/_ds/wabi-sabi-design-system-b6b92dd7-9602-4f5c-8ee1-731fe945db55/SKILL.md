---
name: wabi-sabi-design
description: Use this skill to generate quiet, paper-ink interfaces and assets in the Wabi-Sabi design system — for production or throwaway prototypes/mocks. A reusable, product-agnostic aesthetic: muted low-chroma paper-ink palette, hairlines instead of shadows, generous space, a single persimmon seal accent, restrained typography (Newsreader / Hanken Grotesk / IBM Plex Mono), six themes, and a small set of React UI primitives (Button, TextButton, Badge, DispositionTag, Callout, Tabs, ScopeBadge, ThemeSwitcher, Toast, Confirmation, EmptyState, Skeleton, OrganicLoader).
user-invocable: true
---

Read the `readme.md` file in this skill, then explore the other files.

- Foundations & rules: `readme.md` (VISUAL FOUNDATIONS, the abstract tone vocabulary, ICONOGRAPHY).
- Tokens: `styles.css` → `tokens/*.css`. Link `styles.css`; style with the CSS custom
  properties, never hard-coded colors.
- Components: `components/<group>/<Name>.jsx` with `.d.ts` (props) and `.prompt.md` (usage).
- Specimens: `guidelines/*.html` and the per-group component cards.

If creating visual artifacts (slides, mocks, throwaway prototypes), copy assets/tokens out and
produce static HTML the user can open, linking `styles.css`. If working in production code,
read the rules here and reuse the component contracts to design natively in this aesthetic.

The system ships with the **stone · dark** theme as default. To retheme, set `data-theme` on
`<html>` (all six warm/stone/tea × light/dark variants are tabulated in `readme.md`) — the
**ThemeSwitcher** component does this at runtime.

Every primitive speaks one abstract tone vocabulary — **urgent · active · neutral · pending ·
praise · error** (plus `outline` for de-emphasized states). Pick a tone by meaning; the same
name means the same thing across all components.

Keep it quiet: low chroma, hairlines not shadows, generous space, and reserve the persimmon
accent for genuine urgency only. No emoji; glyphs are functional (`⟳ ↳ ◆ ✓`).

If the user invokes this skill without other guidance, ask what they want to build, ask a few
questions, and act as an expert designer who outputs HTML artifacts or production code.
