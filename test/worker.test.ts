// Locks two worker-layer policies:
//  - drainWorkers: on a daemon kill, in-flight workers get a bounded grace to finish on
//    their own, then SIGTERM, then SIGKILL — so the process never exits leaving an orphan.
//    The I/O (count/kill/sleep) is injected, so no real `claude` is spawned and no real
//    timers run.
//  - readWorkerResult: a model-written verdict file that fails to JSON.parse must NOT be
//    swallowed (the old `catch { return null }` made a corrupt file indistinguishable from
//    "never ran", stranding the PR in "In progress" forever). It repairs the common
//    backslash-escaped-backtick case, and otherwise logs + returns a parseError to escalate.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { drainWorkers, readWorkerResult } from '../worker.ts';
import type { Logger } from '../log.ts';

const noopLog: Logger = { info() {}, warn() {}, error() {}, debug() {} };
const immediateSleep = async (): Promise<void> => {};

// A logger that records every level it was called at, so a test can assert the parse
// failure was logged loudly (error) or repaired (warn) instead of swallowed silently.
type LogLevel = 'info' | 'warn' | 'error' | 'debug';
function capturingLog(): Logger & { calls: Record<LogLevel, string[]> } {
  const calls: Record<LogLevel, string[]> = { info: [], warn: [], error: [], debug: [] };
  const rec = (lvl: LogLevel) => (msg: string, extra?: unknown) =>
    calls[lvl].push(extra !== undefined ? `${msg} ${extra}` : String(msg));
  return { calls, info: rec('info'), warn: rec('warn'), error: rec('error'), debug: rec('debug') };
}

// Run `fn` with a fresh temp result file containing `text`, cleaning up after.
async function withResultFile<T>(text: string, fn: (outPath: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), 'prc-result-'));
  const outPath = join(dir, 'worker-repo-1.json');
  try { await writeFile(outPath, text); return await fn(outPath); }
  finally { await rm(dir, { recursive: true, force: true }); }
}

test('drainWorkers returns drained=true when workers finish within the grace window', async () => {
  let n = 2, ticks = 0;
  const count = () => { ticks += 1; if (ticks >= 3) n = 0; return n; };  // empties after a few polls
  const kill = () => { throw new Error('kill must not be called when workers finish on their own'); };
  const r = await drainWorkers({ graceMs: 1000, pollMs: 100, count, kill, sleep: immediateSleep, log: noopLog });
  assert.deepEqual(r, { drained: true, terminated: 0, killed: 0 });
});

test('drainWorkers SIGTERMs then SIGKILLs stragglers that never finish', async () => {
  const signals: Array<NodeJS.Signals | undefined> = [];
  const count = () => 1;                                   // always one straggler
  const kill = (sig?: NodeJS.Signals) => { signals.push(sig); return 1; };
  const r = await drainWorkers({ graceMs: 300, pollMs: 100, killGraceMs: 50, count, kill, sleep: immediateSleep, log: noopLog });
  assert.deepEqual(signals, ['SIGTERM', 'SIGKILL']);      // escalates when SIGTERM is ignored
  assert.deepEqual(r, { drained: false, terminated: 1, killed: 1 });
});

test('drainWorkers does NOT SIGKILL when SIGTERM is enough', async () => {
  let alive = 1;
  const signals: Array<NodeJS.Signals | undefined> = [];
  const count = () => alive;
  const kill = (sig?: NodeJS.Signals) => { signals.push(sig); if (sig === 'SIGTERM') alive = 0; return 1; };
  const r = await drainWorkers({ graceMs: 100, pollMs: 50, killGraceMs: 10, count, kill, sleep: immediateSleep, log: noopLog });
  assert.deepEqual(signals, ['SIGTERM']);                 // straggler died on SIGTERM — no SIGKILL
  assert.equal(r.killed, 0);
});

test('drainWorkers with grace 0 kills immediately (no wait) when a worker is in flight', async () => {
  const signals: Array<NodeJS.Signals | undefined> = [];
  const count = () => 1;
  const kill = (sig?: NodeJS.Signals) => { signals.push(sig); return 1; };
  const r = await drainWorkers({ graceMs: 0, killGraceMs: 0, count, kill, sleep: immediateSleep, log: noopLog });
  assert.deepEqual(signals, ['SIGTERM', 'SIGKILL']);
  assert.equal(r.drained, false);
});

// The reported bug: the model wrote a suggestedApproach containing example code with a
// backslash-escaped backtick (`\`` — valid JS, invalid JSON), so the whole file failed to
// parse and readWorkerResult silently returned null → the PR stuck in "In progress" forever.
// `\\`` in this source string is one backslash + one backtick on disk (the real failure).
test('readWorkerResult REPAIRS a backslash-escaped backtick instead of silently losing the verdict', async () => {
  const bad = '{ "prKey": "owner/repo#24", "actions": ['
    + ' { "threadId": "T1", "response": "surface",'
    + ' "reason": "greet.mjs:3 builds the body as a template literal",'
    + ' "suggestedApproach": "wrap the body: return \\`Hello, ${name}!\\`",'
    + ' "resolved": false } ] }';
  await withResultFile(bad, async (outPath) => {
    const log = capturingLog();
    const { result, parseError } = await readWorkerResult(outPath, { log });
    assert.notEqual(result, null, 'a repairable file must not return a verdict-less null');
    assert.equal(parseError, null);
    assert.equal(result!.actions!.length, 1);
    assert.equal(result!.actions![0].threadId, 'T1');
    assert.equal(result!.actions![0].response, 'surface');
    assert.equal(log.calls.warn.length, 1, 'the repair is logged at warn');
    assert.equal(log.calls.error.length, 0, 'a repaired file is not an error');
  });
});

// A parse failure that repair can't fix must be loud + escalatable, never a silent null.
test('readWorkerResult escalates an unrepairable parse failure (logs error + returns parseError)', async () => {
  await withResultFile('{ "actions": [ { "threadId": "T1", "response": "surface"', async (outPath) => {
    const log = capturingLog();
    const { result, parseError } = await readWorkerResult(outPath, { log });
    assert.equal(result, null);
    assert.match(parseError!, /unparseable/);          // surfaces as a Needs-you agentError upstream
    assert.equal(log.calls.error.length, 1, 'the parse failure is logged at error');
  });
});

test('readWorkerResult parses valid JSON cleanly (no parseError, no noise)', async () => {
  const good = JSON.stringify({ prKey: 'owner/repo#1', actions: [{ threadId: 'T1', response: 'fix', resolved: false }] });
  await withResultFile(good, async (outPath) => {
    const log = capturingLog();
    const { result, parseError } = await readWorkerResult(outPath, { log });
    assert.equal(parseError, null);
    assert.equal(result!.actions![0].response, 'fix');
    assert.equal(log.calls.warn.length, 0);
    assert.equal(log.calls.error.length, 0);
  });
});

test('readWorkerResult distinguishes an ABSENT file (never ran) from a parse failure', async () => {
  const { result, parseError } = await readWorkerResult(join(tmpdir(), 'prc-does-not-exist-xyz.json'), { log: noopLog });
  assert.equal(result, null);
  assert.equal(parseError, null);   // no file -> genuinely never ran, NOT an error to surface
});
