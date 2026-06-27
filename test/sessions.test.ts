// Locks the shared sessions.json store (sessions.mjs): the locked read-modify-write
// primitives every worker writer + cleanup share. The lock is what prevents the cross-PR
// lost-update race (a cleanup or worker write clobbering an unrelated PR's freshly-minted
// session). Uses a temp file via the injectable path param so it never touches real data/.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadSessions, updateSessions, removeSessionEntry } from '../sessions.ts';
import type { Session } from '../types.ts';

async function tmpFile() {
  const dir = await mkdtemp(join(tmpdir(), 'prc-sessions-'));
  return join(dir, 'sessions.json');
}
const read = async (p: string) => JSON.parse(await readFile(p, 'utf8'));

test('loadSessions returns {} for an absent file', async () => {
  assert.deepEqual(await loadSessions(join(tmpdir(), 'prc-nope-does-not-exist.json')), {});
});

test('updateSessions writes the mutated map; a mutate returning false skips the write', async () => {
  const p = await tmpFile();
  // minimal test fixture; cast past the full Session shape (createdAt unneeded here)
  await updateSessions((m) => { m['a#1'] = { id: 'x' } as Session; }, p);
  assert.deepEqual(await read(p), { 'a#1': { id: 'x' } });
  // returning false must NOT rewrite the file
  await writeFile(p, JSON.stringify({ sentinel: true }));
  await updateSessions(() => false, p);
  assert.deepEqual(await read(p), { sentinel: true });
});

test('removeSessionEntry deletes one key and no-ops on a missing key', async () => {
  const p = await tmpFile();
  await writeFile(p, JSON.stringify({ 'a#1': { id: 'x' }, 'b#2': { id: 'y' } }));
  await removeSessionEntry('a#1', p);
  assert.deepEqual(Object.keys(await read(p)), ['b#2']);
  await removeSessionEntry('z#9', p);   // missing key: no throw, unchanged
  assert.deepEqual(Object.keys(await read(p)), ['b#2']);
});

// The race the lock exists to prevent: two concurrent read-modify-writes that each add a
// DIFFERENT key must BOTH survive. Without serialization the second load reads the pre-first
// map and the later write clobbers the first key (lost update).
test('concurrent updateSessions calls serialize — neither update is lost', async () => {
  const p = await tmpFile();
  await writeFile(p, JSON.stringify({}));
  await Promise.all([
    updateSessions((m) => { m['a#1'] = { id: 'x' } as Session; }, p),
    updateSessions((m) => { m['b#2'] = { id: 'y' } as Session; }, p),
  ]);
  assert.deepEqual(Object.keys(await read(p)).sort(), ['a#1', 'b#2']);
});
