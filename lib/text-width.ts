/**
 * Whether a character is drawn full width (about one em) rather than half:
 * Han, kana, Hangul and the full-width forms — the East Asian Wide and
 * Fullwidth ranges a label's width estimate has to count double.
 */
const WIDE = /[ᄀ-ᅟ⺀-〾ぁ-㏿㐀-䶿一-鿿ꥠ-꥿가-힣豈-﫿︰-﹏＀-｠￠-￦]/;

export const isWide = (ch: string): boolean => WIDE.test(ch);
