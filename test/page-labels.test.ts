import assert from 'node:assert/strict';
import { test } from 'node:test';

import { pageLabelStyle } from '../lib/page-labels.ts';

test('every given label becomes its custom property; omitted ones are left to the defaults', () => {
  assert.equal(pageLabelStyle({ codeCopy: 'kopieren', speak: 'Kurz gesagt →' }), ':root{--code-copy:"kopieren";--speak-label:"Kurz gesagt →"}');
  assert.equal(pageLabelStyle({}), ':root{}');
});

test('quotes, backslashes, line breaks and markup cannot escape the declaration or the style element', () => {
  const css = pageLabelStyle({ codeCopy: 'a"b\\c\nd</style><script>' });
  assert.equal(css, ':root{--code-copy:"a\\"b\\\\c\\a d\\3c /style>\\3c script>"}');
  assert.ok(!css.includes('</'));
});
