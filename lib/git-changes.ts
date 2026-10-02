/**
 * When each file of a content repo last changed, and by whom — read from the
 * repo's git history, so a note's "recently updated" reflects what people
 * actually committed (an in-place save on the site, a push from a
 * workstation, an import) instead of a frontmatter date someone has to
 * remember to bump.
 *
 * One `git log --name-only` over the whole history yields every path's
 * latest commit; a path modified or added in the working tree but not yet
 * committed is reported with its file mtime and no author. The result is
 * cached per repo and reused while HEAD and the working-tree status are
 * unchanged, so a page render costs two cheap git calls, not a log walk.
 */
import { execFile } from 'node:child_process';
import { statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileP = promisify(execFile);

export interface FileChange {
  /** committer time of the latest commit touching the path; mtime for uncommitted work */
  at: Date;
  /** author name of that commit; absent for uncommitted work */
  by?: string | undefined;
}

/** repo-relative path (posix) → latest change */
export type FileChanges = Map<string, FileChange>;

interface CacheEntry {
  key: string;
  changes: FileChanges;
}

const cache = new Map<string, CacheEntry>();

const RECORD = '\u0001';
const FIELD = '\u001f';

async function git(dir: string, args: string[]): Promise<string> {
  const { stdout } = await execFileP('git', ['-C', dir, ...args], { maxBuffer: 64 * 1024 * 1024 });
  return stdout;
}

/** `path` → relative to `base`, or undefined when it is not under it (both posix, no leading ./) */
function under(path: string, base: string): string | undefined {
  if (base === '') return path;
  return path.startsWith(`${base}/`) ? path.slice(base.length + 1) : undefined;
}

/** latest change per path across the whole history: newest commit first, first sighting of a path wins */
function parseLog(out: string, base = ''): FileChanges {
  const changes: FileChanges = new Map();
  for (const record of out.split(RECORD)) {
    if (record.trim() === '') continue;
    const [header, ...paths] = record.split('\n');
    const [iso, by] = (header ?? '').split(FIELD);
    if (!iso) continue;
    const at = new Date(iso);
    for (const raw of paths) {
      const path = under(raw.trim(), base);
      if (!path || changes.has(path)) continue;
      changes.set(path, { at, by: by || undefined });
    }
  }
  return changes;
}

/** paths with uncommitted changes (modified, added, untracked, renamed-to) — tracked deletions excluded */
function parseStatus(out: string, base = ''): string[] {
  const paths: string[] = [];
  const entries = out.split('\0');
  for (let i = 0; i < entries.length; i += 1) {
    const line = entries[i]!;
    if (line.length < 4) continue;
    const code = line.slice(0, 2);
    // a rename or copy carries its source path as the following entry
    if (code.startsWith('R') || code.startsWith('C')) i += 1;
    if (code.includes('D')) continue;
    const path = under(line.slice(3), base);
    if (path) paths.push(path);
  }
  return paths;
}

/**
 * Latest change of every path under `root` (a directory inside a git work
 * tree, as a path or file URL), keyed relative to `root`. A directory that
 * is not inside a git work tree yields an empty map — callers fall back to
 * frontmatter dates.
 */
export async function fileChanges(root: string | URL): Promise<FileChanges> {
  const dir = resolve(typeof root === 'string' ? root : fileURLToPath(root));
  let top: string;
  let head: string;
  let status: string;
  try {
    [top, head, status] = await Promise.all([
      git(dir, ['rev-parse', '--show-toplevel']),
      git(dir, ['rev-parse', 'HEAD']),
      git(dir, ['status', '--porcelain', '-z', '--untracked-files=all']),
    ]);
  } catch {
    return new Map();
  }
  const key = `${head.trim()}\n${status}`;
  const hit = cache.get(dir);
  if (hit && hit.key === key) return hit.changes;

  const base = relative(top.trim(), dir).split('\\').join('/');
  const log = await git(dir, ['log', `--format=${RECORD}%cI${FIELD}%an`, '--name-only', '--no-renames']);
  const changes = parseLog(log, base);
  for (const path of parseStatus(status, base)) {
    try {
      changes.set(path, { at: statSync(join(dir, path)).mtime });
    } catch {
      // raced deletion: the next render sees the committed state
    }
  }
  cache.set(dir, { key, changes });
  return changes;
}

export const _internal = { parseLog, parseStatus };
