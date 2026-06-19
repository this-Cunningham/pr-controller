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
  data.js                  # MOCK PR data (flat list) + item routing  ← swap for your API
  useDashboard.js          # all dashboard state + actions (the one stateful hook)
  meta.js                  # presentational lookup maps + tag/branch → tab routing
  components/
    Header.jsx             # wordmark, scope badge, summary line, refresh
    ScopeBadge.jsx         # all PRs ⇄ scoped-to-N badge (the agent always acts for real)
    SectionTabs.jsx        # sticky Needs you / In progress / Waiting tabs + counts
    PRCard.jsx             # the repeating PR unit, rendered for ONE tab's item slice
    ThreadRow.jsx          # one reviewer thread; controls vary by disposition tag
    BranchStatus.jsx       # PR-level branch health (conflict / surfaced / out-of-sync)
    StagedApprovalsBar.jsx # per-PR cart footer → Run agent (N)
    ReviewPill.jsx         # APPROVED / REVIEW_REQUIRED / DRAFT
    StatusPill.jsx         # "behind base" / "CI failing: …"
    JiraBanner.jsx         # missing-ticket compliance banner + Set ticket
    Button.jsx             # primary / outline / ghost / accent button
    Confirmation.jsx       # post-action acknowledgment line + Undo
    Toast.jsx              # transient bottom-center confirmation
    Skeleton.jsx           # first-fetch loading state
    EmptyState.jsx         # "nothing needs you" ensō
```

## Component tree

```
App
├─ Header → ScopeBadge
├─ SectionTabs
├─ (loading) Skeleton
└─ active tab
   ├─ PRCard  (× N — only PRs with an item in this tab)
   │  ├─ ReviewPill
   │  ├─ StatusPill (× pills)
   │  ├─ BranchStatus           (when the PR's branch routes here)
   │  ├─ ThreadRow (× threads)  → Button, Confirmation
   │  ├─ JiraBanner             → Button   (needs tab)
   │  └─ StagedApprovalsBar     → Button   (needs tab, when approaches staged)
   └─ EmptyState   (when the tab is empty)
Toast  (portal-free, fixed)
```

## State model (`useDashboard`)

| State        | Meaning                                                                 |
|--------------|-------------------------------------------------------------------------|
| `scope`      | `'all'` \| `'scoped'` — which PRs the agent watches (it always acts)     |
| `tab`        | active section: `'needs'` \| `'progress'` \| `'waiting'`                 |
| `loading`    | first-fetch skeleton (~850 ms on mount)                                 |
| `refreshing` | refresh in flight (~900 ms)                                             |
| `updated`    | last-updated label                                                      |
| `toastMsg`   | current toast string (auto-clears after 2.8 s)                          |
| `threads`    | per-thread overlay → `{ approachStaged?, replySent?, replyText?, terminalOpen? }` |
| `branch`     | per-PR branch overlay → `{ detailsOpen?, terminalOpen? }`               |
| `runs`       | per-PR → `'running'` once Run agent fires                              |
| `jira`       | per-PR overlay → `{ status:'set', value }` keyed by PR id               |

Actions: `approveApproach · unstageApproach · sendReply · undoReply · discuss · runAgent · toggleBranchDetails · branchTerminal · setTicket · toggleScope · refresh`.

## Wiring real data

`src/data.js` holds mock PRs. Replace it with data from the PR-agent backend; keep the shape:

```js
PR     = { id, repo, number, title, review, jira?, pills[], branch?, threads[] }
review = 'APPROVED' | 'REVIEW_REQUIRED' | 'DRAFT'
pill   = { label, kind: 'behind' | 'ci' }
branch = { kind: 'conflict' | 'surfaced' | 'outofsync', detail?, details? }
thread = { id, tag, loc, author, body, reasonSummary, reasonFull?, approach?, reply? }
tag    = 'input' | 'fixed' | 'waiting' | 'pending' | 'praise' | 'error'
```

The unit is the ITEM: `meta.js` maps each thread tag and branch kind to a tab
(`TAG_TAB` / `BRANCH_TAB`), so a single PR can appear in more than one tab. Sections are
**derived** by `buildSections()` (no manual grouping). For live auto-refresh, fetch on an
interval and feed the result in via state/props instead of the static import.

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
