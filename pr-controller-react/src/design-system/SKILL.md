---
name: wabi-sabi-design
description: Use this skill to generate well-branded interfaces and assets for PR Controller / the Wabi-Sabi design system — for production or throwaway prototypes/mocks. Contains the visual language (muted paper-ink palette, hairlines, persimmon seal accent), typography, tokens, and reusable React UI components (Button, Badge, DispositionTag, Tabs, ModeBadge, Toast, Confirmation, EmptyState, Skeleton) plus an assembled dashboard UI kit.
user-invocable: true
---

Read the `readme.md` file in this skill, then explore the other files.

- Foundations & rules: `readme.md` (CONTENT FUNDAMENTALS, VISUAL FOUNDATIONS, ICONOGRAPHY).
- Tokens: `styles.css` → `tokens/*.css`. Link `styles.css`; style with the CSS custom
  properties, never hard-coded colors.
- Components: `components/<group>/<Name>.jsx` with `.d.ts` (props) and `.prompt.md` (usage).
- Assembled screen: `ui_kits/pr-controller/index.html`.

If creating visual artifacts (slides, mocks, throwaway prototypes), copy assets/tokens out and
produce static HTML the user can open, linking `styles.css`. If working in production code,
read the rules here and reuse the component contracts to design natively in this brand.

The system ships locked to the **stone · dark** theme. To retheme, swap the `:root` block in
`tokens/colors.css` (all six warm/stone/tea × light/dark variants are tabulated in `readme.md`).

Keep it quiet: low chroma, hairlines not shadows, generous space, and reserve the persimmon
accent for genuine urgency only. No emoji; glyphs are functional (`⟳ ↳ ◆ ›_ ✓`).

If the user invokes this skill without other guidance, ask what they want to build, ask a few
questions, and act as an expert designer who outputs HTML artifacts or production code.
