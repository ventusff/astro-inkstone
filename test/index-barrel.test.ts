import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

import * as barrel from '../lib/index.ts';

test('the barrel carries the engine-free surface and no engine-coupled values', () => {
  assert.equal(typeof barrel.normalizeBase, 'function');
  assert.equal(typeof barrel.rehypeChapters, 'function');
  assert.equal(typeof barrel.localTocRows, 'function');
  // engine-coupled values live on their subpaths only
  assert.equal('siteMarkdown' in barrel, false);
  assert.equal('createBacklinks' in barrel, false);
});

test('no module value-reachable from the barrel imports astro-inkbrush', () => {
  const libDir = resolve(dirname(fileURLToPath(import.meta.url)), '../lib');
  const engineImports: string[] = [];
  const seen = new Set<string>();
  const queue = [resolve(libDir, 'index.ts')];
  while (queue.length > 0) {
    const path = queue.pop()!;
    if (seen.has(path)) continue;
    seen.add(path);
    // one import/export statement per ';' split is enough for this codebase's style
    for (const stmt of readFileSync(path, 'utf8').split(';')) {
      const from = /from\s+'([^']+)'/.exec(stmt);
      if (!from) continue;
      if (/(^|\n)\s*(import|export)\s+type\s/.test(stmt)) continue; // erased, loads nothing
      const spec = from[1]!;
      if (spec.startsWith('astro-inkbrush')) engineImports.push(`${path} → ${spec}`);
      if (spec.startsWith('.')) queue.push(resolve(dirname(path), spec));
    }
  }
  assert.deepEqual(engineImports, []);
});
