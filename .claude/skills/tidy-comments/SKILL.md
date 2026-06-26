---
name: tidy-comments
version: 1.3.0
description: >-
  Clean up code comments in a scope — remove noise (restated code, duplicates, stale/filler),
  trim bloated/redundant blocks to their core, keep the ones that carry real information (the
  "why", invariants, gotchas, far pointers).
  Use when asked to tidy/clean up/prune comments, or review a diff for comment hygiene.
argument-hint: [scope — e.g. "the diff vs main", "worker.mjs", or empty for the working diff]
---

# Tidy code comments

Clean up comments in the scope — *intelligently*. Scope = `$ARGUMENTS` (default: the
uncommitted/working diff, i.e. `git diff` + staged).

Judge each comment on its merits: does it carry information the code, names, and types don't
already make clear? Remove the genuine noise; keep the genuine signal. This is NOT a blanket
deletion pass — leanness is a *byproduct of precise judgment*, not a quota or a default-to-cut.
A leaner result is good only when every removed line was genuine noise and every kept line is
real signal. Over-pruning real context is a worse failure than leaving one extra comment.

## First: calibrate to the file
Read the file's style and judge each comment against what the code already makes obvious there.
Don't impose a generic density target, and don't chop comments just to lower the count.
Run BOTH lenses: (a) is each comment noise? — REMOVE/KEEP below; (b) is each *block* bloated? —
trim, below. Asking only "did I over-prune?" gives long comments a free pass.

## REMOVE a comment when it:
- restates what the next line obviously does — `// increment i`, `// loop over items`
- duplicates a nearby block comment or a self-documenting name — e.g. a comment on
  `isInterrupted: wasInterrupted` that just re-says the function name
- breaks local consistency — commenting one item when its siblings are uncommented
- is stale / contradicts the code, or is dead commented-out code
- is filler — `// ditto`, `// helper`, `// see above`

## KEEP a comment that earns its place — it explains:
- WHY, not what — the rationale, the tradeoff, the rejected alternative
- non-obvious ordering — "must run before X because…"
- a safety invariant / "never do Y here" constraint
- a workaround for an external quirk (API/CLI/browser behavior, a race)
- a pointer to related code that's far away — "see drainWorkers"
- anything that would genuinely surprise the next reader

## Long blocks earn scrutiny too — *trim*, don't rubber-stamp
A comment can be load-bearing AND bloated. Don't auto-keep a block because it's long or looks
like a header/WHY. Whittle to the core — never gut the rationale/rejected-alternative itself:
- self-repetition — states one point 2–3× (re-says its own title, re-explains a sibling). Keep it once.
- cross-comment redundancy — the SAME invariant told in full in 2–3 places. Keep ONE canonical home;
  point the rest at it (`// see dispatchDecision`) — one place to edit when the rule changes, not three.
- stale far-pointer — a `(see X)` / `(plan §295-317)` that no longer resolves is misdirection. Verify
  it points at something real, then drop or fix it; don't keep a pointer on faith.

## Process (don't bulk-delete)
1. List each comment you'd remove or trim: file:line, the comment, a one-line reason, keep/remove call.
2. Wait for the user's OK.
3. Apply — comment-only edits, no logic changes.
4. Run the build/tests to confirm nothing broke.

## Example
Remove: `liveWorkers.add(child); // add child to liveWorkers` (restates code).
Keep:   `liveWorkers.add(child); // tracked so shutdown can drain it instead of orphaning it (see drainWorkers)` (why + far pointer).
Trim:   a header that says "serialized per PR … this module owns that serialization" → keep the WHY
        (two `claude -p` on one session UUID corrupt both); cut the line that just re-says the title.

---
_Improve this skill over time with `/auto-improve tidy-comments` (see _changelog.json)._
