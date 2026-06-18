# PR Controller — React app

A runnable React (Vite) implementation of the PR Controller dashboard: a single-screen,
read-mostly view of your open PRs and what the automated agent is doing with each one.
The UI is split into discrete, reusable components. Theme is locked to **stone (dark)**.

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
```

Build for production:

```bash
npm run build
npm run preview
```

Requires Node 18+.

## What's where

```
index.html                 # mounts #root, loads Google Fonts
src/
  main.jsx                 # React entry
  theme.css                # design tokens (CSS variables), resets, keyframes,
                           #   + all six theme variants documented at the bottom
  data.js                  # MOCK PR data + section grouping  ← swap for your API
  useDashboard.js          # all dashboard state + actions (the one stateful hook)
  meta.js                  # presentational lookup maps (tags, review pills, status pills)
  components/
    Header.jsx             # wordmark, mode badge, summary line, refresh
    ModeBadge.jsx          # safe ⇄ live toggle (pulsing dot when live)
    SectionTabs.jsx        # sticky Needs you / Auto-handling / Waiting tabs + counts
    PRCard.jsx             # the repeating PR unit (emphasis state for "needs you")
    ThreadRow.jsx          # one reviewer thread; controls vary by disposition tag
    ReviewPill.jsx         # APPROVED / REVIEW_REQUIRED / DRAFT
    StatusPill.jsx         # "N auto-fixable" / "behind base" / "CI failing: …"
    JiraBanner.jsx         # missing-ticket compliance banner + Set ticket
    Button.jsx             # primary / outline / ghost button
    Confirmation.jsx       # post-action acknowledgment line + Undo
    Toast.jsx              # transient bottom-center confirmation
    Skeleton.jsx           # first-fetch loading state
    EmptyState.jsx         # "nothing flagged" ensō
```

## Component tree

```
App
├─ Header → ModeBadge
├─ SectionTabs
├─ (loading) Skeleton
└─ active section
   ├─ PRCard  (× N)
   │  ├─ ReviewPill
   │  ├─ StatusPill (× pills)
   │  ├─ ThreadRow (× threads)   → Button, Confirmation
   │  └─ JiraBanner              → Button
   └─ EmptyState   (when the section is empty)
Toast  (portal-free, fixed)
```

## State model (`useDashboard`)

| State        | Meaning                                                                 |
|--------------|-------------------------------------------------------------------------|
| `mode`       | `'safe'` \| `'live'` — global agent mode                                |
| `tab`        | active section: `'needs'` \| `'auto'` \| `'waiting'`                     |
| `loading`    | first-fetch skeleton (~850 ms on mount)                                 |
| `refreshing` | refresh in flight (~900 ms)                                             |
| `updated`    | last-updated label                                                      |
| `toastMsg`   | current toast string (auto-clears after 2.8 s)                          |
| `threads`    | per-thread overlay → `{ status, rebuttal? }` keyed by thread id         |
| `jira`       | per-PR overlay → `{ status:'set', value }` keyed by PR id               |

Actions: `approve · skip · discuss · undo · sendRebuttal · setTicket · toggleMode · refresh`.
Thread `status` ∈ `pending | approved | skipped | discussing | rebutted`.

## Wiring real data

`src/data.js` holds mock PRs. Replace it with data from the PR-agent backend; keep the shape:

```js
PR     = { id, repo, number, title, review, jira, pills[], threads[] }
review = 'APPROVED' | 'REVIEW_REQUIRED' | 'DRAFT'
pill   = { label, kind: 'auto' | 'behind' | 'ci' }
thread = { id, tag, loc, author, body, reason }
tag    = 'hashout' | 'agree' | 'waiting' | 'praise' | 'error'
```

Group PRs into the three `SECTIONS` (needs / auto / waiting). For live auto-refresh,
fetch on an interval and feed the result in via state/props instead of the static import.

## Theming

All styling references CSS custom properties defined in `src/theme.css`. The file ships
**stone · dark** locked in `:root`, and includes a reference block with all six variants
(warm/stone/tea × light/dark) — paste another block into `:root` to switch, or wire the
variants to a `data-theme` attribute if you want a runtime switcher.

## Notes

- Styling uses inline style objects + a handful of CSS hover/focus helpers (in `theme.css`).
  Swap for CSS Modules / Tailwind / your system if preferred — the structure won't change.
- The decorative paper-grain overlay from the prototype is omitted here; add a fixed,
  low-opacity noise layer behind the content column if you want it.
- This was generated from an HTML design prototype; recreate styling with your own
  design system if your codebase has one.
