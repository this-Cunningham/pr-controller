// SCAN-ONLY end-to-end validation. Fetches real PRs via `gh`, runs the EXACT
// production derivation (derive.mjs) + placement model (placements.mjs) + client
// composition (adapt.buildLanes), and prints the resulting lanes. It dispatches NO
// workers and writes NOTHING to GitHub — pure read + local compute. Use it to prove
// the pipeline works against real data (and that the cross-org fix holds).
//
//   PRC_HOST=github.com PRC_OWNER=this-Cunningham PRC_LOGIN=this-Cunningham \
//   PRC_ONLY_PRS="pr-controller#1,pr-controller#2" node scripts/e2e-scan.mjs
//
// PRC_ONLY_PRS="" scans ALL your open PRs (handy to validate cross-org enrichment).
import { join } from 'node:path';
import { scanAll } from '../scanner.mjs';
import { readWorkerResult } from '../worker.mjs';
import { deriveRecord } from '../derive.mjs';
import { placementsFor, prSortRank } from '../placements.mjs';
import { buildLanes } from '../pr-controller-react/src/adapt.js';
import { config } from '../config.mjs';

const DATA = join(config.baseDir, 'data');
const outPathFor = (pr) => join(DATA, `worker-${pr.repo}-${pr.number}.json`);
const short = (id) => (id ? String(id).slice(0, 8) : '—');

console.log(`[e2e] host=${config.host} login=${config.login} scope=${JSON.stringify(config.onlyPRs)}`);
const prs = await scanAll();
console.log(`[e2e] scanned ${prs.length} PR(s)\n`);

for (const pr of prs) {
  const wr = await readWorkerResult(outPathFor(pr));
  deriveRecord(pr, { workerResult: wr, outOfSync: false });
}

console.log('=== PER-PR DERIVATION ===');
for (const pr of prs) {
  console.log(`\n# ${pr.repo}#${pr.number} — ${pr.title}`);
  console.log(`  review=${pr.reviewDecision} draft=${pr.isDraft} behindBase=${pr.behindBase} needsRebase=${pr.needsRebase} needsJira=${pr.needsJira} ci=${pr.ciFailing} threads=${pr.threads.length}`);
  for (const t of pr.threads) {
    if (t.error) { console.log(`  ! thread ERROR: ${t.error}`); continue; }
    console.log(`  - ${short(t.threadId)} ${t.path}:${t.line} (last:@${t.lastAuthor}) -> ${t.disposition}`);
  }
}

const placements = [];
for (const pr of prs) { const rows = placementsFor(pr); pr.sortRank = prSortRank(rows); placements.push(...rows); }
const lanes = buildLanes(prs, placements, {});

console.log('\n=== LANES (what the dashboard tabs would show) ===');
for (const lane of lanes) {
  console.log(`\n[${lane.key}] ${lane.title} — ${lane.prs.length} card(s)`);
  for (const card of lane.prs) {
    const items = card.items.map((i) => i.kind + (i.thread ? `:${i.thread.tag}` : i.branch ? `:${i.branch.tone}` : '')).join(', ');
    console.log(`  • ${card.pr.id}  [${items || '∅'}]`);
  }
}

const errs = prs.flatMap((p) => (p.threads || []).filter((t) => t.error).map((t) => `${p.repo}#${p.number}: ${t.error}`));
console.log(`\n[e2e] cross-org/scan errors: ${errs.length}`);
errs.forEach((e) => console.log('  ! ' + e));
console.log('[e2e] done.');
