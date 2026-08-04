import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { mountLayout } from '../src/ui/layout.js';

test('every DOM id requested by main.js is present exactly once in the layout', async () => {
  const host = { innerHTML: '' };
  mountLayout(host);
  const mainSource = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
  const requestedIds = [...mainSource.matchAll(/\$\('#([^']+)'\)/g)].map((match) => match[1]);
  const layoutIds = [...host.innerHTML.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
  const occurrences = new Map();
  for (const id of layoutIds) occurrences.set(id, (occurrences.get(id) ?? 0) + 1);

  assert.equal(new Set(layoutIds).size, layoutIds.length, 'layout contains duplicate ids');
  for (const id of requestedIds) {
    assert.equal(occurrences.get(id), 1, `#${id} is missing or duplicated`);
  }
});
