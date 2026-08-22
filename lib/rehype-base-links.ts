/**
 * rehype-base-links — rewrite root-absolute links in note prose onto the
 * mount prefix.
 *
 * Content is written as if mounted at the site root (`/getting-started/#s2`,
 * `/topic/file.pdf`, `/inbox/<slug>/x.png`); with the notes mounted under a
 * subpath (siteMarkdown({ base })) every such reference gets the prefix.
 * A reference that already starts with the base, or with one of the `exempt`
 * mount points, is left as it is. `base` and `exempt` entries accept any
 * spelling ('/docs', 'docs/', …) — both are normalized here. Prefixes match
 * whole path segments: base `/docs` owns `/docs` and `/docs/...`, not
 * `/docs-old`.
 * Applies to hast elements and to MDX JSX attributes alike (href / src /
 * poster on lowercase native tags; component props are the component's).
 */
import type { Element, Root } from 'hast';

import { normalizeBase } from './base.ts';

const URL_ATTRS = ['href', 'src', 'poster'] as const;

type AnyNode = { type: string; children?: AnyNode[] } & Record<string, unknown>;

interface JsxAttr {
  type: string;
  name?: string;
  value?: unknown;
}

export function rehypeBaseLinks(options: { base: string; exempt?: string[] }) {
  const base = normalizeBase(options.base);
  // '' normalizes out: an empty exempt prefix would own every root-absolute path
  const exempt = (options.exempt ?? []).map(normalizeBase).filter((p) => p !== '');
  return function transform(tree: Root): void {
    if (!base) return;
    /** `prefix` owns `path` when they are equal or `path` continues past a `/` */
    const owns = (prefix: string, path: string): boolean =>
      path === prefix || path.startsWith(`${prefix}/`) || path.startsWith(`${prefix}?`) || path.startsWith(`${prefix}#`);
    const rewrite = (value: unknown): string | null => {
      if (
        typeof value === 'string' &&
        value.startsWith('/') &&
        !value.startsWith('//') &&
        !owns(base, value) &&
        !exempt.some((p) => owns(p, value))
      ) {
        return base + value;
      }
      return null;
    };
    const walk = (node: AnyNode): void => {
      if (node.type === 'element') {
        const el = node as unknown as Element;
        const props = el.properties ?? {};
        for (const attr of URL_ATTRS) {
          const next = rewrite(props[attr]);
          if (next !== null) props[attr] = next;
        }
      }
      // Hand-written <a>/<img> in MDX prose are JSX nodes, not hast elements —
      // they need the prefix too. Only standard URL attributes on lowercase
      // native tags; prop semantics of components (uppercase) are their own.
      if (
        (node.type === 'mdxJsxTextElement' || node.type === 'mdxJsxFlowElement') &&
        typeof node['name'] === 'string' &&
        /^[a-z]/.test(node['name'] as string)
      ) {
        for (const attr of (node['attributes'] as JsxAttr[] | undefined) ?? []) {
          if (attr.type !== 'mdxJsxAttribute' || !URL_ATTRS.includes(attr.name as (typeof URL_ATTRS)[number])) continue;
          const next = rewrite(attr.value);
          if (next !== null) attr.value = next;
        }
      }
      for (const child of node.children ?? []) walk(child);
    };
    walk(tree as unknown as AnyNode);
  };
}
