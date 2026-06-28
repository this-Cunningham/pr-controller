// UI-CHECK fixture for the dashboard — a representative state.json covering every
// disposition tone, the seal/needs treatment, the JIRA banner, the staged-approach
// flow, the AgentWorking (ripple) treatment, and the "Resolve in terminal" branch
// label. Lets you eyeball the React components in every visual state with NO daemon
// and NO live GitHub data.
//
// SCOPE: this is ONLY for visual/component checks. It does NOT run the app — it
// stubs the backend client-side. To actually run pr-controller (real daemon + real
// Claude workers against the sandbox PRs), use the run-pr-controller skill, not
// this. The action buttons here POST to a backend that isn't really there, so they
// won't do anything meaningful.
//
// USAGE (chrome-devtools CLI — daemon-free, just the Vite dev server):
//   cd pr-controller-react && yarn dev &           # Vite on http://localhost:5173
//   chrome-devtools navigate_page --url "http://localhost:5173" \
//     --initScript "$(cat dev/inject-demo-state.ts)"
// (This .ts is deliberately written as the JS∩TS subset, so `cat`-ing it raw into the
//  init script evals directly in the browser — no build/emit step needed.)
//
// It runs before the app's scripts and intercepts the /state.json fetch, returning
// FIX below — so no backend (and no Vite proxy target) is needed. Switch lanes with
// the tab buttons. To force the first-load Skeleton (ensō OrganicLoader) instead,
// change the FIX return to `new Promise(()=>{})`.
const FIX = {
  updatedAt: "2026-06-21T03:00:00.000Z",
  scope: ["demo/web#101"],
  lanes: ["needs", "progress", "waiting"],
  prs: [
    {
      repo: "demo/web", number: 101, title: "Add SSO login flow", url: "#",
      isDraft: false, reviewDecision: "REVIEW_REQUIRED", behindBase: true,
      needsJira: true, branchHealth: { failingChecks: [{ name: "unit-api" }] }, sortRank: 0,
      threads: [
        { threadId: "t1", path: "src/auth.js", line: 42, author: "reviewer", lastAuthor: "reviewer",
          body: "This silently swallows the expired-token error — is that intentional?",
          disposition: "needsYourApproval", reason: "Reviewer flagged a possible bug; the agent drafted an approach.",
          suggestedApproach: "Keep the expired-token guard and add the SSO branch above it.",
          suggestedReply: "Good catch — the guard is intentional for silent re-auth; I'll add the SSO branch above it." }
      ]
    },
    {
      repo: "demo/api", number: 88, title: "Bump pg driver to 8.x", url: "#",
      isDraft: false, reviewDecision: "REVIEW_REQUIRED", outOfSync: true, branchHealth: {}, sortRank: 1, threads: []
    },
    {
      repo: "demo/web", number: 102, title: "Refactor the cart reducer", url: "#",
      isDraft: false, reviewDecision: "REVIEW_REQUIRED", branchHealth: {}, sortRank: 2,
      threads: [
        { threadId: "t2", path: "src/cart.js", line: 88, author: "reviewer", lastAuthor: "reviewer",
          body: "Can we memoize this selector?", disposition: "notYetReviewed", reason: "Agent hasn't judged this yet." }
      ]
    },
    {
      repo: "demo/api", number: 90, title: "Add a request rate limiter", url: "#",
      isDraft: false, reviewDecision: "APPROVED", branchHealth: {}, sortRank: 3,
      threads: [
        { threadId: "t3", path: "src/limit.js", line: 12, author: "reviewer", lastAuthor: "agent",
          body: "Use a token bucket here.", disposition: "agentAutoFixed", reason: "Agent switched to a token bucket and replied." },
        { threadId: "t4", path: "src/limit.js", line: 30, author: "reviewer", lastAuthor: "reviewer",
          body: "What about burst traffic?", disposition: "agentError", reason: "The agent could not classify this thread." }
      ]
    }
  ],
  placements: [
    { prKey: "demo/web#101", lane: "needs", subjectKind: "thread", subjectId: "t1", disposition: "needsYourApproval", reason: "", sortRank: 0 },
    { prKey: "demo/web#101", lane: "needs", subjectKind: "jira", subjectId: "jira", disposition: "jiraNeeded", reason: "", sortRank: 1 },
    { prKey: "demo/api#88", lane: "needs", subjectKind: "branch", subjectId: "branch", disposition: "branchOutOfSync", reason: "The branch diverged from origin/main — last sync 3 days ago.", sortRank: 0 },
    { prKey: "demo/web#102", lane: "progress", subjectKind: "thread", subjectId: "t2", disposition: "notYetReviewed", reason: "", sortRank: 1 },
    { prKey: "demo/api#90", lane: "waiting", subjectKind: "thread", subjectId: "t3", disposition: "agentAutoFixed", reason: "", sortRank: 1 },
    { prKey: "demo/api#90", lane: "waiting", subjectKind: "thread", subjectId: "t4", disposition: "agentError", reason: "", sortRank: 2 }
  ]
};
// Keep this body plain JS — no TS-only syntax (type annotations, casts). The file is
// cat'd verbatim into a chrome-devtools --initScript, so it must eval as-is in the
// browser; it also lives in the React tsconfig `include`, so it must still pass
// `yarn typecheck`. The arrow form gets its param types contextually from `window.fetch`
// (no annotations needed), and binding to `window` preserves fetch's receiver.
const _f = window.fetch.bind(window);
window.fetch = (u, o) => {
  if (String(u).indexOf("/state.json") >= 0) {
    return Promise.resolve(new Response(JSON.stringify(FIX), { status: 200, headers: { "Content-Type": "application/json" } }));
  }
  return _f(u, o);
};
