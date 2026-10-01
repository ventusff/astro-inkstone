import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { Element, Root } from 'hast';
import { h } from 'hastscript';

import { transformerCodeFrame } from '../lib/code-frame.ts';
import { pageLabelScript, pageLabelStyle } from '../lib/page-labels.ts';

test('the markers become their custom properties; omitted ones are left to the defaults', () => {
  assert.equal(pageLabelStyle({ speak: 'Kurz gesagt →', diff: 'ggü. Vorgänger →' }), ':root{--speak-label:"Kurz gesagt →";--diff-label:"ggü. Vorgänger →"}');
  assert.equal(pageLabelStyle({ diff: 'vs prior →' }), ':root{--diff-label:"vs prior →"}');
  assert.equal(pageLabelStyle({ codeFrame: { copy: 'kopieren' } }), ':root{}');
});

test('quotes, backslashes, line breaks and markup cannot escape the declaration or the style element', () => {
  const css = pageLabelStyle({ speak: 'a"b\\c\nd</style><script>' });
  assert.equal(css, ':root{--speak-label:"a\\"b\\\\c\\a d\\3c /style>\\3c script>"}');
  assert.ok(!css.includes('</'));
  assert.equal(pageLabelStyle({ diff: 'a\r\nb\rc\fd' }), ':root{--diff-label:"a\\a b\\a c\\a d"}');
});

/** a document holding the hast tree, with the selectors the script uses */
function fakeDocument(tree: Element, readyState = 'complete') {
  const all: Element[] = [];
  const walk = (el: Element, parent: Element | undefined) => {
    parentOf.set(el, parent);
    all.push(el);
    for (const c of el.children) if (c.type === 'element') walk(c, el);
  };
  const parentOf = new Map<Element, Element | undefined>();
  walk(tree, undefined);
  const has = (el: Element | undefined, cls: string) =>
    !!el && ((el.properties?.['className'] as string[] | undefined) ?? []).includes(cls);
  const wrap = (el: Element) => ({
    set textContent(text: string) {
      el.children = [{ type: 'text', value: text }];
    },
    setAttribute(name: string, value: string) {
      (el.properties ??= {})[name] = value;
    },
  });
  const listeners: (() => void)[] = [];
  return {
    readyState,
    listeners,
    addEventListener: (_type: string, fn: () => void) => listeners.push(fn),
    querySelectorAll(selector: string) {
      const [parent, child] = selector.split(' > ').map((s) => s.slice(1));
      return all.filter((el) => (child === undefined ? has(el, parent!) : has(el, child) && has(parentOf.get(el), parent!))).map(wrap);
    },
  };
}

const frame = (): Element => {
  const root: Root = { type: 'root', children: [h('pre', [h('code', 'x = 1')])] };
  const t = transformerCodeFrame({ copyLabel: '复制代码', expandLabel: '展开 · expand' });
  const ctx = { options: { meta: { __raw: 'collapse' }, lang: 'py' } };
  return (t.root as (this: typeof ctx, r: Root) => Root).call(ctx, root).children[0] as Element;
};

const find = (el: Element, cls: string): Element | undefined => {
  if (((el.properties?.['className'] as string[] | undefined) ?? []).includes(cls)) return el;
  for (const c of el.children) {
    if (c.type !== 'element') continue;
    const hit = find(c, cls);
    if (hit) return hit;
  }
  return undefined;
};
const text = (el: Element | undefined) => (el?.children[0] as { value: string } | undefined)?.value;

const run = (script: string, doc: ReturnType<typeof fakeDocument>) => new Function('document', script)(doc);

test('the script relabels every code frame: visible words, accessible name and tooltip', () => {
  const tree = frame();
  run(
    pageLabelScript({
      codeFrame: { copy: 'kopieren', copied: '✓ kopiert', copyLabel: 'Code kopieren', expandLabel: 'Aufklappen', collapseLabel: 'Zuklappen' },
    }),
    fakeDocument(tree),
  );
  assert.equal(text(find(tree, 'code-copy-idle')), 'kopieren');
  assert.equal(text(find(tree, 'code-copy-done')), '✓ kopiert');
  assert.equal(text(find(tree, 'code-fold-closed')), 'Aufklappen');
  assert.equal(text(find(tree, 'code-fold-open')), 'Zuklappen');
  const btn = find(tree, 'code-copy')!;
  assert.equal(btn.properties['aria-label'], 'Code kopieren');
  assert.equal(btn.properties['title'], 'Code kopieren');
});

test('labels left out keep the words the build gave the frame', () => {
  const tree = frame();
  run(pageLabelScript({ codeFrame: { expandLabel: 'Expand' } }), fakeDocument(tree));
  assert.equal(text(find(tree, 'code-fold-closed')), 'Expand');
  assert.equal(text(find(tree, 'code-copy-idle')), 'copy');
  const btn = find(tree, 'code-copy')!;
  assert.equal(btn.properties['ariaLabel'], '复制代码');
  assert.equal(btn.properties['aria-label'], undefined);
});

test('while the document is still parsing, the script waits for it', () => {
  const tree = frame();
  const doc = fakeDocument(tree, 'loading');
  run(pageLabelScript({ codeFrame: { copy: 'kopieren' } }), doc);
  assert.equal(text(find(tree, 'code-copy-idle')), 'copy');
  assert.equal(doc.listeners.length, 1);
  doc.listeners[0]!();
  assert.equal(text(find(tree, 'code-copy-idle')), 'kopieren');
});

test('markup in a label cannot close the script element', () => {
  const script = pageLabelScript({ codeFrame: { copy: '</script><b>' } });
  assert.ok(!script.includes('</'));
  const tree = frame();
  run(script, fakeDocument(tree));
  assert.equal(text(find(tree, 'code-copy-idle')), '</script><b>');
});
