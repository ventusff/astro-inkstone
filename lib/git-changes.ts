/**
 * When each file of a content repo last changed, and who brought it into
 * being — read from the repo's git history, so a note's "recently updated"
 * reflects what people actually committed (an in-place save on the site, a
 * push from a workstation, an import) instead of a frontmatter date someone
 * has to remember to bump, and its author is whoever wrote it first, not
 * whoever touched it last.
 *
 * One `git log --name-status` over the whole history yields every path's
 * latest commit and its first one; a rename carries the path's author along,
 * so a moved note keeps the person who wrote it. Names and emails go through
 * the repo's `.mailmap`, which folds one person's several identities into
 * one. A path modified or added in the working tree but not yet committed is
 * reported with its file mtime and keeps its committed creator. Commits by excluded authors — services that
 * derive content from what people wrote, a translation sync for one — are
 * skipped entirely: they neither date a path nor author it. The result is
 * cached per repo and reused while HEAD and the working-tree status are
 * unchanged (an edited `.mailmap` changes one of them), so a page render
 * costs two cheap git calls, not a log walk.
 */
import { execFile } from 'node:child_process';
import { statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileP = promisify(execFile);

/** a commit author as git records it (after the mailmap) */
export interface Author {
  name: string;
  email: string;
}

export interface FileChange {
  /** committer time of the latest commit touching the path; mtime for uncommitted work */
  at: Date;
  /** author (name and email) of the first commit that created the path, followed across renames; absent for a path never committed or a service's */
  createdBy?: Author | undefined;
}

/** repo-relative path (posix) → latest change and creator */
export type FileChanges = Map<string, FileChange>;

export interface FileChangesOptions {
  /** author names or emails (after the mailmap) whose commits do not count */
  excludeAuthors?: readonly string[] | undefined;
}

interface CacheEntry {
  key: string;
  changes: FileChanges;
}

const cache = new Map<string, CacheEntry>();

const RECORD = '\u0001';
const FIELD = '\u001f';

async function git(dir: string, args: string[]): Promise<string> {
  const { stdout } = await execFileP('git', ['-C', dir, '-c', 'core.quotePath=false', ...args], {
    maxBuffer: 256 * 1024 * 1024,
  });
  return stdout;
}

/** `path` → relative to `base`, or undefined when it is not under it (both posix, no leading ./) */
function under(path: string, base: string): string | undefined {
  if (base === '') return path;
  return path.startsWith(`${base}/`) ? path.slice(base.length + 1) : undefined;
}

interface Touch {
  /** git's status letter: A added, M modified, T type changed, D deleted, R renamed, C copied */
  kind: string;
  /** the path after the commit */
  path: string;
  /** the path before a rename or copy */
  from?: string | undefined;
}

interface Commit {
  at: Date;
  by: Author;
  /** made by a person; an excluded author's commit is kept only to know which files a service created or moved */
  counted: boolean;
  touches: Touch[];
}

/**
 * `git log -z --name-status` output, newest first. Each record is the
 * header, a NUL, then NUL-separated status/path groups: `M path`,
 * `R100 old new`, `C75 old new`.
 */
function parseCommits(out: string, excluded: ReadonlySet<string>): Commit[] {
  const commits: Commit[] = [];
  for (const record of out.split(RECORD)) {
    if (record.trim() === '') continue;
    const [header = '', ...rest] = record.split('\0');
    const [iso, by = '', email = ''] = header.split(FIELD);
    if (!iso) continue;
    const touches: Touch[] = [];
    const tokens = rest.map((t) => t.replace(/^\n/, ''));
    for (let i = 0; i < tokens.length; i += 1) {
      const status = tokens[i]!;
      if (status === '') continue;
      const kind = status[0]!;
      if (kind === 'R' || kind === 'C') {
        touches.push({ kind, from: tokens[i + 1]!, path: tokens[i + 2]! });
        i += 2;
      } else {
        touches.push({ kind, path: tokens[i + 1]! });
        i += 1;
      }
    }
    commits.push({ at: new Date(iso), by: { name: by, email }, counted: !excluded.has(by) && !excluded.has(email), touches });
  }
  return commits;
}

/**
 * Latest change and creator of every path under `base`.
 *
 * The latest change is the newest counted commit that touched the path — a
 * deletion or a move away counts, since it changes the note the path
 * belonged to.
 *
 * The creator is settled oldest first: an add makes its author the creator
 * (a path deleted and added again belongs to whoever added it again), a
 * rename hands the old path's creator to the new path, a modification
 * claims only a path nobody created yet. A file an excluded author created
 * or moved has no person as creator, and a later edit does not claim it.
 */
function changesOf(commits: readonly Commit[], base = ''): FileChanges {
  /** live path → its creator; null when a service created it */
  const creators = new Map<string, Author | null>();
  /** live path → the latest counted change to its content, carried along renames */
  const lastCounted = new Map<string, Date>();
  for (let i = commits.length - 1; i >= 0; i -= 1) {
    const commit = commits[i]!;
    const author = commit.counted ? commit.by : null;
    for (const { kind, path, from } of commit.touches) {
      if (kind === 'D') {
        creators.delete(path);
        lastCounted.delete(path);
        continue;
      }
      if (kind === 'R') {
        creators.set(path, creators.has(from!) ? creators.get(from!)! : author);
        const carried = lastCounted.get(from!);
        if (carried) lastCounted.set(path, carried);
        creators.delete(from!);
        lastCounted.delete(from!);
      } else if (kind === 'A' || kind === 'C' || !creators.has(path)) {
        creators.set(path, author);
      }
      if (commit.counted) lastCounted.set(path, commit.at);
    }
  }
  const changes: FileChanges = new Map();
  for (const commit of commits) {
    if (!commit.counted) continue;
    for (const { path: to, from } of commit.touches) {
      for (const full of from !== undefined ? [to, from] : [to]) {
        const path = under(full, base);
        if (!path || changes.has(path)) continue;
        const createdBy = creators.get(full);
        changes.set(path, { at: commit.at, ...(createdBy ? { createdBy } : {}) });
      }
    }
  }
  // a file only a service touched under its current path (moved it, say): its last counted change, carried over
  for (const [full, at] of lastCounted) {
    const path = under(full, base);
    if (!path || changes.has(path)) continue;
    const createdBy = creators.get(full);
    changes.set(path, { at, ...(createdBy ? { createdBy } : {}) });
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
 * Latest change and creator of every path under `root` (a directory inside a git work
 * tree, as a path or file URL), keyed relative to `root`. A directory that
 * is not inside a git work tree yields an empty map — callers fall back to
 * frontmatter dates.
 */
export async function fileChanges(root: string | URL, options: FileChangesOptions = {}): Promise<FileChanges> {
  const dir = resolve(typeof root === 'string' ? root : fileURLToPath(root));
  const excluded = new Set(options.excludeAuthors ?? []);
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
  // uncommitted files (a `.mailmap` edit among them), keyed with their mtimes so a second edit is seen too
  const repoTop = top.trim();
  const dirty = parseStatus(status).map((path) => {
    try {
      return { path, mtime: statSync(join(repoTop, path)).mtime };
    } catch {
      return undefined; // raced deletion: the next render sees the committed state
    }
  }).filter((d) => d !== undefined);
  const key = [head.trim(), [...excluded].sort().join(','), ...dirty.map((d) => `${d.path}@${d.mtime.getTime()}`)].join('\n');
  const hit = cache.get(dir);
  if (hit && hit.key === key) return hit.changes;

  const base = relative(repoTop, dir).split('\\').join('/');
  const log = await git(dir, ['log', '--topo-order', '--use-mailmap', '-z', `--format=${RECORD}%cI${FIELD}%aN${FIELD}%aE`, '--name-status', '-M']);
  const changes = changesOf(parseCommits(log, excluded), base);
  for (const { path: full, mtime } of dirty) {
    const path = under(full, base);
    if (!path) continue;
    const createdBy = changes.get(path)?.createdBy;
    changes.set(path, { at: mtime, ...(createdBy ? { createdBy } : {}) });
  }
  cache.set(dir, { key, changes });
  return changes;
}

export const _internal = { parseCommits, changesOf, parseStatus };
