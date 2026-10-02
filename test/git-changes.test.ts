import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { _internal, fileChanges } from "../lib/git-changes.ts";

const git = (dir: string, args: string[], env: Record<string, string> = {}) =>
  execFileSync("git", ["-C", dir, ...args], {
    env: { ...process.env, ...env },
    stdio: "pipe",
  }).toString();

function repo(): string {
  const dir = mkdtempSync(join(tmpdir(), "inkstone-git-"));
  git(dir, ["init", "-q", "-b", "main"]);
  git(dir, ["config", "user.email", "t@test"]);
  git(dir, ["config", "user.name", "Tester"]);
  return dir;
}

function commit(
  dir: string,
  files: Record<string, string>,
  when: string,
  author = "Tester",
): void {
  for (const [rel, body] of Object.entries(files)) {
    mkdirSync(join(dir, rel, ".."), { recursive: true });
    writeFileSync(join(dir, rel), body);
  }
  git(dir, ["add", "-A"]);
  git(dir, ["commit", "-q", "-m", "c", "--author", `${author} <a@test>`], {
    GIT_COMMITTER_DATE: when,
    GIT_AUTHOR_DATE: when,
  });
}

test("every path reports its latest commit time and author; uncommitted work reports its mtime without author", async () => {
  const dir = repo();
  commit(
    dir,
    { "a/index.mdx": "1", "en/a/index.mdx": "1", "b/index.mdx": "1" },
    "2026-01-01T10:00:00Z",
  );
  commit(dir, { "a/index.mdx": "2" }, "2026-02-01T10:00:00Z", "Later Author");
  const changes = await fileChanges(dir);
  assert.equal(
    changes.get("a/index.mdx")?.at.toISOString(),
    "2026-02-01T10:00:00.000Z",
  );
  assert.equal(changes.get("a/index.mdx")?.by, "Later Author");
  assert.equal(
    changes.get("b/index.mdx")?.at.toISOString(),
    "2026-01-01T10:00:00.000Z",
  );
  assert.equal(changes.get("en/a/index.mdx")?.by, "Tester");

  writeFileSync(join(dir, "b/index.mdx"), "dirty");
  writeFileSync(join(dir, "c.txt"), "new");
  const dirty = await fileChanges(dir);
  assert.equal(dirty.get("b/index.mdx")?.by, undefined);
  assert.ok(
    (dirty.get("b/index.mdx")?.at.getTime() ?? 0) > Date.now() - 60_000,
  );
  assert.equal(dirty.get("c.txt")?.by, undefined);
  assert.equal(dirty.get("a/index.mdx")?.by, "Later Author");
});

test("a root below the repo top keys paths relative to itself and ignores the rest of the repo", async () => {
  const dir = repo();
  commit(
    dir,
    { "site/notes/a/index.mdx": "1", "site/other.txt": "1" },
    "2026-01-01T10:00:00Z",
  );
  const changes = await fileChanges(join(dir, "site/notes"));
  assert.deepEqual([...changes.keys()], ["a/index.mdx"]);
});

test("a directory outside any git work tree yields no changes", async () => {
  const dir = mkdtempSync(join(tmpdir(), "inkstone-nogit-"));
  assert.equal((await fileChanges(dir)).size, 0);
});

test("status parsing skips deletions and the source path of a rename", () => {
  const out = [
    "R  new.md\0old.md",
    " M kept.md",
    "D  gone.md",
    "?? fresh.md",
    "",
  ].join("\0");
  assert.deepEqual(_internal.parseStatus(out), [
    "new.md",
    "kept.md",
    "fresh.md",
  ]);
});
