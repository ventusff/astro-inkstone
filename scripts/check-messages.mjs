#!/usr/bin/env node
/**
 * check-messages — text catalogs agree across languages.
 *
 *   node vendor/astro-inkstone/scripts/check-messages.mjs src/i18n [--complete]
 *
 * The directory holds one `<locale>.json` per language (lib/messages.ts).
 * Every value must be a well-formed ICU message, and a key's messages must
 * take the same arguments in every language — a caller's values fit every
 * translation. A key some catalogs carry and others do not yet is text still
 * being translated: text is written in one language and the others are
 * filled in behind it, and until then the reader sees their language's
 * pending text. Such keys are listed, not failed; `--complete` fails them
 * too, for a site whose every language is written by hand. A blank value is
 * written text: that language shows nothing there. Exits non-zero, naming
 * each problem.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { IntlMessageFormat } from 'intl-messageformat';

/** ICU AST element types (the parser's TYPE enum): literal and `#` carry no argument */
const LITERAL = 0;
const POUND = 7;

/** `[--complete] [--] [dir]`: options first; `--` ends them, so a directory may start with `--` */
let complete = false;
let given;
for (let i = 2, options = true; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (options && a === '--') options = false;
  else if (options && a === '--complete') complete = true;
  else if (options && a.startsWith('--')) {
    console.error(`✗ unknown option ${a}; usage: check-messages.mjs [--complete] [--] [dir]`);
    process.exit(2);
  } else if (given === undefined) given = a;
  else {
    console.error(`✗ one catalog directory at a time; got ${given} and ${a}`);
    process.exit(2);
  }
}
const dir = resolve(given ?? 'src/i18n');

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
const pending = [];
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
  const absent = [...keys].filter((key) => !messages.has(key));
  if (complete) for (const key of absent) problems.push(`${locale}.json: missing "${key}"`);
  else if (absent.length > 0) pending.push(`${locale}.json: ${absent.length} key(s) still being translated: ${absent.map((k) => `"${k}"`).join(', ')}`);
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

for (const line of pending) console.log(`· ${line}`);
if (problems.length > 0) {
  console.error(problems.join('\n'));
  console.error(`✗ ${problems.length} problem(s) in ${dir}`);
  process.exit(1);
}
console.log(`✓ ${dir}: ${catalogs.size} catalogs, ${keys.size} keys${pending.length > 0 ? ', some still being translated' : ' each'}`);
