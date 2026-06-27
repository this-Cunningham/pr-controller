// SCAN-ONLY end-to-end validation. Fetches real PRs via `gh`, runs the EXACT
// production derivation (derive.mjs) + placement model (placements.mjs) + client
// composition (adapt.buildLanes), and prints the resulting lanes. It dispatches NO
// workers and writes NOTHING to GitHub — pure read + local compute. Use it to prove
// the pipeline works against real data (and that the cross-org fix holds).
//
//   PRC_HOST=github.com PRC_OWNER=this-Cunningham PRC_LOGIN=this-Cunningham \
//   PRC_ONLY_PRS="pr-controller#1,pr-controller#2" node scripts/e2e-scan.ts
//
// PRC_ONLY_PRS="" scans ALL your open PRs (handy to validate cross-org enrichment).
import { scanAll } from '../scanner.ts';
import { readWorkerResult } from '../worker.ts';
import { deriveRecord } from '../derive.ts';
import { placementsFor, prSortRank } from '../placements.ts';
import { buildLanes } from '../pr-controller-react/src/features/dashboard/adapt.js';
import { config } from '../config.ts';
import { workerFileFor } from '../paths.ts';
import type { Pr, Placement, Thread, ThreadWithDisposition } from '../types.ts';

const outPathFor = (pr: Pr) => workerFileFor(pr.repo, pr.number);
const short = (id: string | null | undefined) => (id ? String(id).slice(0, 8) : '—');

console.log(`[e2e] host=${config.host} login=${config.login} scope=${JSON.stringify(config.onlyPRs)}`);
const prs: Pr[] = await scanAll();
console.log(`[e2e] scanned ${prs.length} PR(s)\n`);

for (const pr of prs) {
  const { result: wr } = await readWorkerResult(outPathFor(pr));
  deriveRecord(pr, { workerResult: wr, outOfSync: false });
}

console.log('=== PER-PR DERIVATION ===');
for (const pr of prs) {
  // Post-deriveRecord, every PR carries its derived threads (disposition attached).
  const threads = pr.threads as ThreadWithDisposition[];
  console.log(`\n# ${pr.repo}#${pr.number} — ${pr.title}`);
  console.log(`  review=${pr.reviewDecision} draft=${pr.isDraft} behindBase=${pr.behindBase} needsRebase=${pr.needsRebase} needsJira=${pr.needsJira} ci=${pr.ciFailing} threads=${threads.length}`);
  for (const t of threads) {
    if (t.error) { console.log(`  ! thread ERROR: ${t.error}`); continue; }
    console.log(`  - ${short(t.threadId)} ${t.path}:${t.line} (last:@${t.lastAuthor}) -> ${t.disposition}`);
  }
}

const placements: Placement[] = [];
for (const pr of prs) { const rows = placementsFor(pr); pr.sortRank = prSortRank(rows); placements.push(...rows); }
const lanes = buildLanes(prs, placements, {});

console.log('\n=== LANES (what the dashboard tabs would show) ===');
for (const lane of lanes) {
  console.log(`\n[${lane.key}] ${lane.title} — ${lane.prs.length} card(s)`);
  for (const card of lane.prs) {
    const items = card.items.map((i) => i.kind + (i.kind === 'thread' ? `:${i.thread.tag}` : i.kind === 'branch' ? `:${i.branch.tone}` : '')).join(', ');
    console.log(`  • ${card.pr.id}  [${items || '∅'}]`);
  }
}

const errs = prs.flatMap((p) => (p.threads || []).filter((t) => t.error).map((t) => `${p.repo}#${p.number}: ${t.error}`));
console.log(`\n[e2e] cross-org/scan errors: ${errs.length}`);
errs.forEach((e) => console.log('  ! ' + e));
console.log('[e2e] done.');
