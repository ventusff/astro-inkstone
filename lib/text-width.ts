/**
 * Whether a character is drawn full width (about one em) rather than half:
 * Han (supplementary planes included), kana, Hangul, Yi and the full-width
 * forms — the East Asian Wide and Fullwidth ranges a label's width estimate
 * has to count double. Pass one code point (iterate a string with `[...s]`).
 */
const WIDE = /[\u{1100}-\u{115f}\u{2e80}-\u{303e}\u{3041}-\u{33ff}\u{3400}-\u{9fff}\u{a000}-\u{a4cf}\u{a960}-\u{a97f}\u{ac00}-\u{d7a3}\u{f900}-\u{faff}\u{fe30}-\u{fe4f}\u{ff00}-\u{ff60}\u{ffe0}-\u{ffe6}\u{20000}-\u{3fffd}]/u;

export const isWide = (ch: string): boolean => WIDE.test(ch);
