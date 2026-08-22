import assert from 'node:assert/strict';
import { test } from 'node:test';

import { siteMarkdown } from '../lib/markdown-preset.ts';

type Plugin = ((...args: never[]) => unknown) | [{ name: string }, Record<string, unknown>];
interface ProcessorShape {
  options: { remarkPlugins?: Plugin[]; rehypePlugins?: Plugin[] };
}
const nameOf = (p: Plugin): string => (Array.isArray(p) ? p[0].name : (p as { name: string }).name);
const optionsOf = (p: Plugin): Record<string, unknown> | undefined => (Array.isArray(p) ? p[1] : undefined);

test('the preset assembles the contracted pipeline order', () => {
  const cfg = siteMarkdown({
    numbering: 'chapters',
    math: true,
    callouts: true,
    readingTime: true,
    mermaid: true,
    codeFrame: true,
    wikiBlocks: true,
    base: 'docs/',
    baseExempt: ['/api'],
  }) as { processor: ProcessorShape; syntaxHighlight?: unknown; shikiConfig: { transformers?: { name: string }[] } };

  const remark = (cfg.processor.options.remarkPlugins ?? []).map(nameOf);
  // remark contract: headingAttrs → callouts → readingTime, in this order
  const order = ['remarkHeadingAttrs', 'remarkCallouts', 'remarkReadingTime'].map((n) => remark.indexOf(n));
  assert.ok(order.every((i) => i >= 0) && order[0]! < order[1]! && order[1]! < order[2]!, `remark order broken: ${remark}`);

  const rehype = (cfg.processor.options.rehypePlugins ?? []).map(nameOf);
  // rehype contract: numbering before katex, baseLinks after the rest, wikiBlocks last
  assert.ok(rehype.indexOf('rehypeChapters') < rehype.indexOf('rehypeKatex'), `rehype order broken: ${rehype}`);
  assert.ok(rehype.indexOf('rehypeBaseLinks') < rehype.indexOf('rehypeWikiBlocks'));
  assert.equal(rehype.at(-1), 'rehypeWikiBlocks');

  const baseLinks = (cfg.processor.options.rehypePlugins ?? []).find((p) => nameOf(p) === 'rehypeBaseLinks');
  assert.deepEqual(optionsOf(baseLinks!), { base: '/docs', exempt: ['/api'] });

  // mermaid fences stay out of shiki
  assert.deepEqual(cfg.syntaxHighlight, { type: 'shiki', excludeLangs: ['math', 'mermaid'] });
  assert.ok((cfg.shikiConfig.transformers ?? []).some((t) => t.name === 'code-frame'));
});

test('switches: sections numbering, no base, no wiki blocks, callout labels pass through', () => {
  const cfg = siteMarkdown({
    numbering: 'sections',
    callouts: true,
    calloutLabels: { warn: '注意' },
  }) as { processor: ProcessorShape };
  const rehype = (cfg.processor.options.rehypePlugins ?? []).map(nameOf);
  assert.ok(rehype.includes('rehypeSections'));
  assert.ok(!rehype.includes('rehypeChapters'));
  assert.ok(!rehype.includes('rehypeBaseLinks'));
  assert.ok(!rehype.includes('rehypeWikiBlocks'));
  const callouts = (cfg.processor.options.remarkPlugins ?? []).find((p) => nameOf(p) === 'remarkCallouts');
  assert.deepEqual(optionsOf(callouts!), { labels: { warn: '注意' } });
});
