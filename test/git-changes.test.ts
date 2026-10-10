import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import { _internal, fileChanges } from '../lib/git-changes.ts';

const git = (dir: string, args: string[], env: Record<string, string> = {}) =>
  execFileSync('git', ['-C', dir, ...args], { env: { ...process.env, ...env }, stdio: 'pipe' }).toString();

function repo(): string {
  const dir = mkdtempSync(join(tmpdir(), 'inkstone-git-'));
  git(dir, ['init', '-q', '-b', 'main']);
  git(dir, ['config', 'user.email', 't@test']);
  git(dir, ['config', 'user.name', 'Tester']);
  return dir;
}

function commit(dir: string, files: Record<string, string>, when: string, author = 'Tester', email = 'a@test'): void {
  for (const [rel, body] of Object.entries(files)) {
    mkdirSync(join(dir, rel, '..'), { recursive: true });
    writeFileSync(join(dir, rel), body);
  }
  git(dir, ['add', '-A']);
  git(dir, ['commit', '-q', '-m', 'c', '--author', `${author} <${email}>`], { GIT_COMMITTER_DATE: when, GIT_AUTHOR_DATE: when });
}

test('every path reports its latest commit time and the author who created it; uncommitted work reports its mtime', async () => {
  const dir = repo();
  commit(dir, { 'a/index.mdx': '1', 'en/a/index.mdx': '1', 'b/index.mdx': '1' }, '2026-01-01T10:00:00Z');
  commit(dir, { 'a/index.mdx': '2' }, '2026-02-01T10:00:00Z', 'Later Author');
  const changes = await fileChanges(dir);
  assert.equal(changes.get('a/index.mdx')?.at.toISOString(), '2026-02-01T10:00:00.000Z');
  assert.equal(changes.get('a/index.mdx')?.createdBy, 'Tester');
  assert.equal(changes.get('b/index.mdx')?.at.toISOString(), '2026-01-01T10:00:00.000Z');
  assert.equal(changes.get('en/a/index.mdx')?.createdBy, 'Tester');

  writeFileSync(join(dir, 'b/index.mdx'), 'dirty');
  writeFileSync(join(dir, 'c.txt'), 'new');
  const dirty = await fileChanges(dir);
  assert.ok((dirty.get('b/index.mdx')?.at.getTime() ?? 0) > Date.now() - 60_000);
  assert.equal(dirty.get('b/index.mdx')?.createdBy, 'Tester');
  assert.equal(dirty.get('c.txt')?.createdBy, undefined);
});

test('commits by excluded authors do not count: the path keeps the last change a person made and its first person', async () => {
  const dir = repo();
  commit(dir, { 'a/index.mdx': '1' }, '2026-01-01T10:00:00Z', 'Person');
  commit(dir, { 'en/a/index.mdx': 'translated', 'a/index.mdx': 'touched' }, '2026-02-01T10:00:00Z', 'Sync Bot', 'bot@test');
  const all = await fileChanges(dir);
  assert.equal(all.get('a/index.mdx')?.at.toISOString(), '2026-02-01T10:00:00.000Z');
  assert.equal(all.get('en/a/index.mdx')?.createdBy, 'Sync Bot');
  const people = await fileChanges(dir, { excludeAuthors: ['bot@test'] });
  assert.equal(people.get('a/index.mdx')?.at.toISOString(), '2026-01-01T10:00:00.000Z');
  assert.equal(people.get('a/index.mdx')?.createdBy, 'Person');
  assert.equal(people.has('en/a/index.mdx'), false);
  assert.equal((await fileChanges(dir, { excludeAuthors: ['Sync Bot'] })).has('en/a/index.mdx'), false);
});

test('a moved file keeps the person who created it; the move dates both paths', async () => {
  const dir = repo();
  commit(dir, { 'inbox/draft/index.md': 'a long note body that stays the same\n'.repeat(20) }, '2026-01-01T10:00:00Z', 'Writer');
  git(dir, ['mv', 'inbox/draft', 'topic']);
  git(dir, ['commit', '-q', '-m', 'move', '--author', 'Mover <m@test>'], { GIT_COMMITTER_DATE: '2026-02-01T10:00:00Z' });
  const changes = await fileChanges(dir);
  assert.equal(changes.get('topic/index.md')?.createdBy, 'Writer');
  assert.equal(changes.get('topic/index.md')?.at.toISOString(), '2026-02-01T10:00:00.000Z');
  assert.equal(changes.get('inbox/draft/index.md')?.at.toISOString(), '2026-02-01T10:00:00.000Z');
});

test('the mailmap folds one person\'s identities into one name; non-ASCII paths are keyed unquoted', async () => {
  const dir = repo();
  commit(dir, { '笔记/index.mdx': '1' }, '2026-01-01T10:00:00Z', 'jane.doe', 'jane@wiki.local');
  writeFileSync(join(dir, '.mailmap'), 'Jane Doe <jane@corp.test> jane.doe <jane@wiki.local>\n');
  git(dir, ['add', '.mailmap']);
  git(dir, ['commit', '-q', '-m', 'mailmap']);
  const changes = await fileChanges(dir);
  assert.equal(changes.get('笔记/index.mdx')?.createdBy, 'Jane Doe');
  assert.equal((await fileChanges(dir, { excludeAuthors: ['jane@corp.test'] })).has('笔记/index.mdx'), false);
});

test('a root below the repo top keys paths relative to itself and ignores the rest of the repo', async () => {
  const dir = repo();
  commit(dir, { 'site/notes/a/index.mdx': '1', 'site/other.txt': '1' }, '2026-01-01T10:00:00Z');
  const changes = await fileChanges(join(dir, 'site/notes'));
  assert.deepEqual([...changes.keys()], ['a/index.mdx']);
});

test('a directory outside any git work tree yields no changes', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'inkstone-nogit-'));
  assert.equal((await fileChanges(dir)).size, 0);
});

test('log parsing reads status groups, renames included, and skips excluded authors', () => {
  const R = '\u0001';
  const F = '\u001f';
  const out = `${R}2026-02-01T00:00:00Z${F}B${F}b@t\0\nR100\0old.md\0new.md\0D\0gone.md\0${R}2026-01-01T00:00:00Z${F}A${F}a@t\0\nA\0old.md\0A\0gone.md\0`;
  const commits = _internal.parseCommits(out, new Set());
  assert.deepEqual(commits.map((c) => c.by), ['B', 'A']);
  assert.deepEqual(commits[0]!.touches, [{ from: 'old.md', path: 'new.md', deleted: false }, { path: 'gone.md', deleted: true }]);
  const changes = _internal.changesOf(commits);
  assert.deepEqual([...changes.keys()], ['new.md', 'old.md', 'gone.md']);
  assert.equal(changes.get('new.md')?.createdBy, 'A');
  assert.equal(changes.get('gone.md')?.at.toISOString(), '2026-02-01T00:00:00.000Z');
  assert.deepEqual(_internal.parseCommits(out, new Set(['b@t'])).map((c) => c.by), ['A']);
});

test('status parsing skips deletions and the source path of a rename', () => {
  const out = ['R  new.md\0old.md', ' M kept.md', 'D  gone.md', '?? fresh.md', ''].join('\0');
  assert.deepEqual(_internal.parseStatus(out), ['new.md', 'kept.md', 'fresh.md']);
});
