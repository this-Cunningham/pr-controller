// Locks the worker-prompt assembler (prompt.ts) — the ONE construction site for the net
// prompt, shared by the real worker (worker.ts) and the Prompt-tracer (server /prompt-traces).
//  - renderPrompt(assembleWorkerPrompt(ctx)) is a pure '\n' join of the segment bodies, so
//    it reproduces worker.ts's `task` byte-for-byte (parity proven exhaustively at refactor
//    time; here we lock the structural invariants that keep it that way).
//  - buildPromptTraces emits the templated situations the UI renders, with NO live PR data.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  assembleWorkerPrompt, renderPrompt, renderFailingChecks, buildPromptTraces,
  type PromptContext,
} from '../prompt.ts';
import { SENSITIVITY_LEVELS, sensitivityPrompt } from '../sensitivity.ts';

const RULES = '# House rules\nbe excellent\n';

function ctx(over: Partial<PromptContext> = {}): PromptContext {
  return {
    runType: 'resume', recovered: false, rules: RULES,
    diffMode: 'none', diffSlot: '',
    since: 'abc123', prRef: 'o/r#7 — Title', worktreePath: '/wt', outPath: '/wt/out.json',
    detached: false, pushRefspec: 'HEAD:feat', headRefName: 'feat',
    sensitivityText: sensitivityPrompt(2),
    health: { present: false, mergeable: 'M', mergeState: 'S', checkState: 'C', failingChecks: '', rebase: false, base: 'main' },
    threadsSlot: '[{"threadId":"T1"}]',
    ...over,
  };
}

test('renderPrompt is exactly the segment bodies joined by newline (the join parity guarantee)', () => {
  const segs = assembleWorkerPrompt(ctx());
  assert.equal(renderPrompt(segs), segs.map((s) => s.body).join('\n'));
});

test('first run leads with the house-rules doc + the familiarize/diff block', () => {
  const segs = assembleWorkerPrompt(ctx({ runType: 'first', diffMode: 'inline', diffSlot: 'DIFF' }));
  assert.equal(segs[0].id, 'house-rules');
  assert.equal(segs[0].src, 'const');
  assert.equal(segs[0].body, RULES);
  assert.equal(segs[1].id, 'familiarize');
  assert.match(segs[1].body, /## Familiarize yourself with this PR FIRST/);
  assert.match(segs[1].body, /```diff\nDIFF\n```/);
  // first run carries no resume/run-mode block
  assert.equal(segs.find((s) => s.id === 'run-mode'), undefined);
});

test('resume vs apply-approved swap the run-mode header and threads heading', () => {
  const resume = renderPrompt(assembleWorkerPrompt(ctx()));
  assert.match(resume, /RESUME RUN\./);
  assert.match(resume, /## New\/changed unresolved threads/);

  const approved = renderPrompt(assembleWorkerPrompt(ctx({ runType: 'applyApproved' })));
  assert.match(approved, /APPLY-APPROVED RUN\./);
  assert.match(approved, /## Approved threads — execute the approach you proposed on each/);
});

test('recovered prepend appears only on a resume (never a first run)', () => {
  const recovered = assembleWorkerPrompt(ctx({ recovered: true }));
  assert.equal(recovered[0].id, 'recovered');
  assert.match(recovered[0].body, /interrupted before it finished and the worktree was reset to origin\/feat/);
  // first run ignores `recovered`
  const first = assembleWorkerPrompt(ctx({ runType: 'first', recovered: true, diffMode: 'inline', diffSlot: 'D' }));
  assert.equal(first.find((s) => s.id === 'recovered'), undefined);
});

test('the since slot drives the `git diff <since>..HEAD` wording on/off', () => {
  assert.match(renderPrompt(assembleWorkerPrompt(ctx({ since: 'deadbeef' }))), /git diff deadbeef\.\.HEAD/);
  assert.doesNotMatch(renderPrompt(assembleWorkerPrompt(ctx({ since: null }))), /git diff/);
});

test('push mode toggles the branch vs detached push line', () => {
  assert.match(renderPrompt(assembleWorkerPrompt(ctx({ detached: false }))), /Push mode: on branch feat — commit then `git push`\./);
  assert.match(renderPrompt(assembleWorkerPrompt(ctx({ detached: true, pushRefspec: 'HEAD:feat' }))), /Push mode: DETACHED HEAD — commit then `git push origin HEAD:feat`/);
});

test('branch-health block: omitted when absent; rebase YES/NO + failing checks when present', () => {
  assert.equal(assembleWorkerPrompt(ctx()).find((s) => s.id === 'branch-health')!.body, '');

  const rebase = renderPrompt(assembleWorkerPrompt(ctx({
    health: { present: true, mergeable: 'CONFLICTING', mergeState: 'DIRTY', checkState: 'C', failingChecks: '', rebase: true, base: 'main' },
  })));
  assert.match(rebase, /## Branch health\nmergeable=CONFLICTING mergeState=DIRTY checks=C/);
  assert.match(rebase, /REBASE this run: YES/);

  const ci = renderPrompt(assembleWorkerPrompt(ctx({
    health: { present: true, mergeable: 'M', mergeState: 'S', checkState: 'FAILURE', failingChecks: '- unit [FAILURE] x', rebase: false, base: 'main' },
  })));
  assert.match(ci, /REBASE this run: NO/);
  assert.match(ci, /failing checks:\n- unit \[FAILURE] x/);
});

test('no threads this run yields the branch-health-only message', () => {
  const body = assembleWorkerPrompt(ctx({ threadsSlot: null })).find((s) => s.id === 'threads')!.body;
  assert.match(body, /## No new review threads this run — you were dispatched for branch health only\./);
});

test('renderFailingChecks parses the Actions run id into a rerun hint (and omits it otherwise)', () => {
  const out = renderFailingChecks([
    { name: 'unit', state: 'FAILURE', url: 'https://gh/o/r/actions/runs/98765/job/1' },
    { name: 'cla', state: 'FAILURE', url: 'https://example.com/cla' },
    { name: 'noUrl', state: 'ERROR', url: null },
  ]);
  assert.match(out, /- unit \[FAILURE] https:\/\/gh\/o\/r\/actions\/runs\/98765\/job\/1 — rerun: gh run rerun 98765 --failed/);
  assert.match(out, /- cla \[FAILURE] https:\/\/example.com\/cla$/m);  // no rerun hint
  assert.match(out, /- noUrl \[ERROR] $/m);                            // empty url, no hint
});

// ── tracer situations ──────────────────────────────────────────────────────────────

test('buildPromptTraces returns the named situations, templated (no live PR data leaks)', () => {
  const traces = buildPromptTraces({ rules: RULES, sensitivity: 2 });
  assert.deepEqual(traces.map((t) => t.key), ['first', 'resume', 'applyApproved', 'rebase', 'ciFailing', 'recovered']);
  for (const t of traces) {
    assert.ok(t.label && t.sub, `${t.key} needs a label + sub`);
    assert.ok(t.segments.length > 0, `${t.key} has segments`);
    // no empty cards shipped to the UI
    for (const s of t.segments) assert.notEqual(s.body.trim(), '');
  }
  const first = traces.find((t) => t.key === 'first')!;
  const rendered = renderPrompt(first.segments);
  assert.match(rendered, /<pr-diff>/);          // templated diff slot, not a real diff
  assert.match(rendered, /<owner\/repo#123 — PR title>/);
  assert.ok(rendered.includes(RULES), 'first-run trace embeds the real house-rules doc');
});

test('the sensitivity segment carries the REAL policy text for the requested level', () => {
  const traces = buildPromptTraces({ rules: RULES, sensitivity: 4 });
  const sens = traces[0].segments.find((s) => s.id === 'sensitivity')!;
  assert.equal(sens.src, 'settings');
  assert.ok(sens.body.includes(SENSITIVITY_LEVELS[4].prompt), 'autonomous policy text present');
  assert.match(sens.body, /FLOOR/);
});

test('rebase situation is branch-health-only (no threads) and shows the rebase YES block', () => {
  const traces = buildPromptTraces({ rules: RULES, sensitivity: 2 });
  const rendered = renderPrompt(traces.find((t) => t.key === 'rebase')!.segments);
  assert.match(rendered, /REBASE this run: YES/);
  assert.match(rendered, /## No new review threads this run/);
});
