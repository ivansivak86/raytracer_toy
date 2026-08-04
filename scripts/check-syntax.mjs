import { readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

async function collect(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collect(path));
    else if (/\.(?:js|mjs)$/.test(entry.name)) files.push(path);
  }
  return files;
}

const roots = ['src', 'tests', 'scripts'];
const files = [
  ...(await Promise.all(roots.map(collect))).flat(),
  'vite.config.js',
].sort();
for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) {
    process.stderr.write(result.stderr || result.stdout);
    process.exit(result.status ?? 1);
  }
}
console.log(`Syntax OK: ${files.length} JavaScript modules.`);
