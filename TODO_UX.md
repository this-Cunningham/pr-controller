# TODO — UX

- [ ] can we make the threads clickable that go to the comment/thread in github?

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
