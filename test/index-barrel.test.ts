/**
 * The root barrel is engine-free: importing anything from 'astro-inkstone'
 * must not load astro-inkbrush. Proven two ways — a module-hook trace in a
 * child process records every specifier the barrel actually resolves, and a
 * textual walk over the source catches engine imports even in modules that
 * fail to load.
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { test } from 'node:test';

import * as barrel from '../lib/index.ts';

const libDir = resolve(dirname(fileURLToPath(import.meta.url)), '../lib');

test('the barrel carries the engine-free surface and no engine-coupled values', () => {
  assert.equal(typeof barrel.normalizeBase, 'function');
  assert.equal(typeof barrel.rehypeChapters, 'function');
  assert.equal(typeof barrel.localTocRows, 'function');
  // engine-coupled values live on their subpaths only
  assert.equal('siteMarkdown' in barrel, false);
  assert.equal('createBacklinks' in barrel, false);
});

test('loading the barrel resolves no astro-inkbrush specifier (module-hook trace)', () => {
  const script = `
    import { registerHooks } from 'node:module';
    const hits = [];
    registerHooks({
      resolve(specifier, context, next) {
        if (specifier.startsWith('astro-inkbrush')) hits.push(specifier);
        return next(specifier, context);
      },
    });
    await import(${JSON.stringify(pathToFileURL(resolve(libDir, 'index.ts')).href)});
    if (hits.length > 0) {
      console.error('engine specifiers resolved: ' + hits.join(', '));
      process.exit(1);
    }
  `;
  execFileSync(process.execPath, ['--input-type=module', '-e', script], { stdio: ['ignore', 'pipe', 'inherit'] });
});

/** every import/export specifier in a module's source, all syntactic forms */
export function importSpecifiers(source: string): { spec: string; typeOnly: boolean }[] {
  const noComments = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const out: { spec: string; typeOnly: boolean }[] = [];
  const patterns = [
    // import ... from '...' / export ... from '...' / side-effect import '...'
    /(?<kw>import|export)\s+(?<type>type\s+)?(?:[\w$*{},\s]*?\s+from\s+)?(?<q>["'])(?<spec>[^"']+)\k<q>/g,
    // dynamic import('...') and require('...')
    /(?:import|require)\s*\(\s*(?<q>["'])(?<spec>[^"']+)\k<q>\s*\)/g,
  ];
  for (const re of patterns) {
    for (const m of noComments.matchAll(re)) {
      out.push({ spec: m.groups!['spec']!, typeOnly: Boolean(m.groups?.['type']) });
    }
  }
  return out;
}

test('no module value-reachable from the barrel imports astro-inkbrush (source walk)', () => {
  const engineImports: string[] = [];
  const seen = new Set<string>();
  const queue = [resolve(libDir, 'index.ts')];
  while (queue.length > 0) {
    const path = queue.pop()!;
    if (seen.has(path)) continue;
    seen.add(path);
    for (const { spec, typeOnly } of importSpecifiers(readFileSync(path, 'utf8'))) {
      if (typeOnly) continue; // erased, loads nothing
      if (spec.startsWith('astro-inkbrush')) engineImports.push(`${path} → ${spec}`);
      if (spec.startsWith('.')) queue.push(resolve(dirname(path), spec));
    }
  }
  assert.deepEqual(engineImports, []);
});

test('the specifier scanner sees every syntactic import form', () => {
  const fixture = `
    import a from './a.ts';
    import { b } from "./b.ts";
    import './side-effect.ts';
    import type { T } from './types-only.ts';
    export { c } from './c.ts';
    export * from "./d.ts";
    const e = await import('./e.ts');
    const f = require('./f.ts');
  `;
  const specs = importSpecifiers(fixture);
  const value = specs.filter((s) => !s.typeOnly).map((s) => s.spec).sort();
  assert.deepEqual(value, ['./a.ts', './b.ts', './c.ts', './d.ts', './e.ts', './f.ts', './side-effect.ts']);
  assert.deepEqual(specs.filter((s) => s.typeOnly).map((s) => s.spec), ['./types-only.ts']);
});
