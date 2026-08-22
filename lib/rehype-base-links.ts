/**
 * rehype-base-links — rewrite root-absolute links in note prose onto the
 * mount prefix.
 *
 * Content is written as if mounted at the site root (cross-note links
 * `/getting-started/#s2`, co-located attachments `/topic/file.pdf`, imported
 * images `/inbox/<slug>/x.png` are all root-absolute); when the notes are
 * mounted under a subpath (base ≠ ''), every such reference gets the prefix.
 * Root-absolute references inside note prose only ever point into the note
 * system itself, so prefixing them all is the correct semantics.
 * Only enters the pipeline when base is non-empty (siteMarkdown({ base })).
 * `exempt`: prefixes of other on-site mount points, left untouched.
 * Rewrites both hast elements AND MDX JSX attributes (href/src/poster on
 * lowercase native tags) — missing the JSX side silently breaks cross-note
 * navigation in MDX-authored prose.
 */
import type { Element, Root } from 'hast';

const URL_ATTRS = ['href', 'src', 'poster'] as const;

type AnyNode = { type: string; children?: AnyNode[] } & Record<string, unknown>;

interface JsxAttr {
  type: string;
  name?: string;
  value?: unknown;
}

export function rehypeBaseLinks(options: { base: string; exempt?: string[] }) {
  const base = options.base;
  const exempt = options.exempt ?? [];
  return function transform(tree: Root): void {
    if (!base) return;
    const rewrite = (value: unknown): string | null => {
      if (
        typeof value === 'string' &&
        value.startsWith('/') &&
        !value.startsWith('//') &&
        !value.startsWith(`${base}/`) &&
        !exempt.some((p) => value.startsWith(p))
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
