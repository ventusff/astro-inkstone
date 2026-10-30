import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const PROBE = fileURLToPath(new URL('../scripts/ui_probe.mjs', import.meta.url));
const CHROME = process.env.CHROME_PATH || '/usr/bin/google-chrome';

/** A page with one chart: a vertical axis title turned a quarter turn, its centre `x` units from the svg's left edge. */
const chart = (x: number) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>chart</title>
<style>body { margin: 0; padding: 40px; font: 12px sans-serif; } svg { display: block; }</style></head>
<body><h1>chart</h1>
<svg width="200" height="120" viewBox="0 0 200 120" role="img" aria-label="chart">
<line x1="30" y1="10" x2="30" y2="110" stroke="black" />
<text transform="translate(${x} 60) rotate(-90)" text-anchor="middle" font-size="12">frames counted</text>
</svg></body></html>`;

test(
  'ui_probe judges a rotated axis title by the box it paints: inside its svg it is no finding, moved out it is one',
  { skip: existsSync(CHROME) ? false : `no Chrome at ${CHROME} (CHROME_PATH)` },
  () => {
    const dist = mkdtempSync(join(tmpdir(), 'ui-probe-test-'));
    try {
      // inside: the turned title is about 12 units wide around x = 12, while its unturned box would reach x < 0
      mkdirSync(join(dist, 'inside'));
      writeFileSync(join(dist, 'inside', 'index.html'), chart(12));
      // outside: the same title moved left of the svg's edge
      mkdirSync(join(dist, 'outside'));
      writeFileSync(join(dist, 'outside', 'index.html'), chart(-14));
      const shots = join(dist, 'shots');
      const report = join(dist, 'report.txt');
      const run = spawnSync(process.execPath, [PROBE, dist, '', report, '--only', '^/(inside|outside)/$', '--shots', shots], {
        encoding: 'utf8',
        timeout: 120_000,
        env: { ...process.env, CHROME_PATH: CHROME, PROBE_WORKERS: '2' },
      });
      assert.equal(run.error, undefined);
      const text = readFileSync(report, 'utf8');
      // the report is one block per route and width, each opening with `<route> @<width>`
      const block = (route: string) => text.split(/\n(?=\/)/).filter((b) => b.startsWith(`${route} @`)).join('\n');
      assert.match(block('/outside/'), /words outside their svg: svg "frames counted"/);
      assert.doesNotMatch(block('/inside/'), /words outside their svg/);
      // every probed route at every width, light and dark
      assert.equal(readdirSync(shots).filter((f) => f.endsWith('.png')).length, 2 * 4 * 2);
    } finally {
      rmSync(dist, { recursive: true, force: true });
    }
  },
);
