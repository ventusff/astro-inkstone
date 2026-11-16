/**
 * A slide's speaker notes, written as an MDX comment: an expression block that
 * holds only a block comment and ends its slide (the last block before a
 * thematic break, or the last block of the document or of a `<Deck>`) becomes
 * a hidden notes block,
 *
 *   <aside class="deck-marker deck-notes" data-deck-marker="notes" hidden>
 *
 * with one paragraph per paragraph of the comment (paragraphs are separated by
 * a blank line). The page never shows it; the deck's presenter view shows the
 * notes of the slide being presented (lib/deck.ts). The block keeps the
 * comment's source position, so an editor binds it like any other block. A
 * comment anywhere else stays a comment and renders nothing.
 */
import type { Blockquote, Node, Paragraph, Parent, Root } from 'mdast';
import { visit } from 'unist-util-visit';

/** an MDX expression block, `{…}` on lines of its own */
interface FlowExpression extends Node {
  type: 'mdxFlowExpression';
  value: string;
}

/** an MDX element written as a block, such as `<Deck>…</Deck>` */
interface JsxFlowElement extends Parent {
  type: 'mdxJsxFlowElement';
  name: string | null;
}

/** the text of an expression that holds one block comment and nothing else, or null */
function commentText(value: string): string | null {
  const m = /^\s*\/\*([\s\S]*)\*\/\s*$/.exec(value);
  if (!m || m[1]!.includes('*/')) return null;
  return m[1]!.trim();
}

function notesBlock(position: Node['position'], text: string): Blockquote {
  const paragraphs = text
    .split(/\n[ \t]*\n/)
    .map((p) => p.trim())
    .filter((p) => p !== '');
  return {
    type: 'blockquote',
    children: paragraphs.map((p): Paragraph => ({ type: 'paragraph', children: [{ type: 'text', value: p }] })),
    ...(position ? { position } : {}),
    data: {
      hName: 'aside',
      hProperties: { className: ['deck-marker', 'deck-notes'], dataDeckMarker: 'notes', hidden: true },
    },
  };
}

export function remarkDeckNotes() {
  return (tree: Root): void => {
    const turn = (children: Node[], endsSlide: boolean) => {
      children.forEach((node, i) => {
        if (node.type !== 'mdxFlowExpression') return;
        const next = children[i + 1];
        if (next === undefined ? !endsSlide : next.type !== 'thematicBreak') return;
        const text = commentText((node as FlowExpression).value);
        if (text) children[i] = notesBlock(node.position, text);
      });
    };
    turn(tree.children, true);
    visit(tree, 'mdxJsxFlowElement', (node) => {
      const element = node as unknown as JsxFlowElement;
      turn(element.children, element.name === 'Deck');
    });
  };
}
