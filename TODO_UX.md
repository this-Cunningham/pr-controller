# TODO — UX

- [ ] add config slider that adjusts the "surface this to me" sensitivity of the workers. (maybe some users will want their workers to surface more things. some users will want their workers to handle everything (except aborted complicated rebases)) this slider would change the prompts that the workers get when going over PRs
- [ ] can we make the threads clickable that go to the comment/thread in github?
- [ ] **Scan on/off toggle** in the header, default **OFF** so a fresh start is inert — nothing scans or dispatches until you opt in (directly defuses the "fully live on startup" hazard). Toggling ON polls immediately then at the normal interval; OFF stops polling. Sketch: a server-side `scanEnabled` flag (in-memory so it ALWAYS starts off — no persistence), gate the poll loop on it, a `POST /scan` endpoint that flips it + kicks an immediate poll, and `scanEnabled` in state.json. The design system has no Switch component (no form components yet), so use a Button-as-toggle ("Scanning: OFF / ON"). This is the right "stay inert until I say go" primitive (better than a worker read-only mode — plan mode wedges a headless `claude -p`). Overlaps the larger "setup mode / config UI panel" item in TODO.md.
      _DONE (2026-06-23, committed 09dc9c4) — shipped as "polling on/off" vocabulary: in-memory
      `pollingEnabled` (always off at boot), gated poll loop, `POST /polling {on}`, `pollingEnabled`
      in state.json, header Start/Stop Button. Interim plain Button; polished visual to come from the
      designer pass._

## Settings panel — deferred (restart-required fields)
The first settings-panel pass intentionally ships only fields that apply LIVE (which PRs to
watch, my username, check interval, assistant model, trigger phrases, check rules). The fields
below are bound at daemon startup, so they can't apply live and are deferred until real restart
support exists.

- [ ] **Settings fields that require a daemon restart** — add to the panel once restart works:
  - **GitHub host** — which GitHub the app connects to (public github.com or a company GitHub).
  - **Clone folder** — the local folder where repositories are checked out.
  - **Git connection** — SSH vs HTTPS for talking to GitHub.
  - **Server port** — the local port the app runs on (advanced).

  Each needs an "applies after restart" marker, plus a **Restart** action on the panel. BLOCKED on
  real restart support: the daemon serves its own UI, so it can't restart itself unsupervised —
  needs (a) a supervisor that relaunches on exit (launchd on macOS, or pm2), (b) a `POST /restart`
  endpoint (write `config.local.json` → `process.exit(0)`), and (c) a reconnect-after-restart UX
  (the React app already has SSE auto-reconnect + `/state.json` polling). Graceful order: polling
  OFF → let in-flight workers drain → restart. Overlaps the "config UI panel" item in TODO.md.
