/**
 * rehype-task-lists — an accessible name for every task-list checkbox.
 *
 * GFM renders `- [x] item` as a disabled checkbox followed by bare text: an
 * `<input>` with no label, which accessibility checkers flag and screen
 * readers announce as an unnamed checkbox. The item's own text becomes the
 * checkbox's `aria-label`, so the control reads as "item, checkbox, checked".
 * An input that already carries an accessible name is left alone.
 */
import type { Root } from 'hast';

type AnyNode = {
  type: string;
  tagName?: string;
  value?: unknown;
  properties?: Record<string, unknown>;
  children?: AnyNode[];
};

const isCheckbox = (node: AnyNode): boolean =>
  node.type === 'element' && node.tagName === 'input' && node.properties?.['type'] === 'checkbox';

/** plain text of a subtree, checkboxes excluded */
function textOf(node: AnyNode): string {
  if (node.type === 'text') return String(node.value ?? '');
  if (isCheckbox(node)) return '';
  let s = '';
  for (const c of node.children ?? []) s += textOf(c);
  return s;
}

export function rehypeTaskLists() {
  return function transform(tree: Root): void {
    const walk = (node: AnyNode): void => {
      if (node.type === 'element' && node.tagName === 'li') {
        for (const child of node.children ?? []) {
          if (!isCheckbox(child)) continue;
          const props = (child.properties ??= {});
          if (props['ariaLabel'] !== undefined || props['ariaLabelledBy'] !== undefined) continue;
          const label = textOf(node).replace(/\s+/g, ' ').trim();
          if (label) props['ariaLabel'] = label;
        }
      }
      for (const c of node.children ?? []) walk(c);
    };
    walk(tree as unknown as AnyNode);
  };
}
