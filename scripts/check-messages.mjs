#!/usr/bin/env node
/**
 * check-messages — text catalogs agree across languages.
 *
 *   node vendor/astro-inkstone/scripts/check-messages.mjs src/i18n
 *
 * The directory holds one `<locale>.json` per language (lib/messages.ts).
 * Every catalog must carry the same keys — a blank value is written text: that
 * language shows nothing there — every value must be a well-formed ICU message, and a key's messages must take the same arguments in every
 * language — a reader never meets text missing from their language, and a
 * caller's values fit every translation. Exits non-zero, naming each problem.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { IntlMessageFormat } from 'intl-messageformat';

/** ICU AST element types (the parser's TYPE enum): literal and `#` carry no argument */
const LITERAL = 0;
const POUND = 7;

const dir = resolve(process.argv[2] ?? 'src/i18n');

/** dotted key path → message */
function flatten(catalog, prefix = '', out = new Map()) {
  for (const [k, v] of Object.entries(catalog)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string') out.set(path, v);
    else if (v && typeof v === 'object') flatten(v, path, out);
    else throw new Error(`${path}: a catalog leaf must be a string`);
  }
  return out;
}

/** the argument names a parsed message uses, nested branches included */
function argumentsOf(elements, out = new Set()) {
  for (const el of elements) {
    if (el.type === LITERAL || el.type === POUND) continue;
    if ('value' in el && typeof el.value === 'string') out.add(el.value);
    if ('options' in el) for (const opt of Object.values(el.options)) argumentsOf(opt.value, out);
    if ('children' in el) argumentsOf(el.children, out);
  }
  return out;
}

const files = readdirSync(dir).filter((f) => f.endsWith('.json')).sort();
if (files.length === 0) {
  console.error(`✗ ${dir}: no <locale>.json catalogs`);
  process.exit(1);
}
const problems = [];
const catalogs = new Map();
for (const f of files) {
  try {
    catalogs.set(f.slice(0, -'.json'.length), flatten(JSON.parse(readFileSync(join(dir, f), 'utf8'))));
  } catch (err) {
    problems.push(`${f}: ${err.message}`);
  }
}
const keys = new Set([...catalogs.values()].flatMap((c) => [...c.keys()]));
const argsByKey = new Map();
for (const [locale, messages] of catalogs) {
  for (const key of keys) {
    if (!messages.has(key)) problems.push(`${locale}.json: missing "${key}"`);
  }
  for (const [key, source] of messages) {
    if (source.trim() === '') continue;
    let args;
    try {
      args = [...argumentsOf(new IntlMessageFormat(source, locale).getAst())].sort().join(',');
    } catch (err) {
      problems.push(`${locale}.json: "${key}" is not a valid ICU message (${err.message})`);
      continue;
    }
    const seen = argsByKey.get(key);
    if (!seen) argsByKey.set(key, { locale, args });
    else if (seen.args !== args) {
      problems.push(`${locale}.json: "${key}" takes {${args}}, ${seen.locale}.json takes {${seen.args}}`);
    }
  }
}

if (problems.length > 0) {
  console.error(problems.join('\n'));
  console.error(`✗ ${problems.length} problem(s) in ${dir}`);
  process.exit(1);
}
console.log(`✓ ${dir}: ${catalogs.size} catalogs, ${keys.size} keys each`);
