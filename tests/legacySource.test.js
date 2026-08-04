import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const informalOrNonEnglishCommentTerms = [
  'pozadovana',
  'propocet',
  'stinu',
  'difuzni',
  'spekularni',
  'rendrovani',
  'vektorove',
  'refrakce',
  'cerny jak',
];

test('published Delphi source contains only sanitized professional commentary', async () => {
  const source = await readFile(new URL('../legacy/delphi/main.pas', import.meta.url), 'latin1');
  const lower = source.toLowerCase();

  for (const phrase of informalOrNonEnglishCommentTerms) {
    assert.equal(lower.includes(phrase), false, `legacy source still contains “${phrase}”`);
  }
  assert.equal(source.includes('RenderOutput.LineAS'), false, 'abandoned drawing experiment remains');
  assert.equal(source.includes('ProgressBar1.Refresh'), false, 'abandoned progress debug line remains');
  assert.match(source, /Experimental Snell-law refraction branch\./);
  assert.match(source, /Recursively trace mirror reflections/);
});
