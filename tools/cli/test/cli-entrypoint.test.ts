import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const TEST_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const COMPILED_ENTRYPOINT = path.resolve(TEST_DIRECTORY, "../src/cli.js");

test(
  "the compiled npm bin remains executable after a TypeScript rebuild",
  { skip: process.platform === "win32" },
  () => {
    assert.notEqual(fs.statSync(COMPILED_ENTRYPOINT).mode & 0o111, 0);
  },
);

test("the CLI runs when Node receives an npm-style bin symlink", () => {
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "nextjshx-bin-"));
  const binPath = path.join(temporaryDirectory, "nextjshx");
  try {
    fs.symlinkSync(COMPILED_ENTRYPOINT, binPath);
    const result = spawnSync(process.execPath, [binPath, "--help"], {
      encoding: "utf8",
    });

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /^NextJsHx 0\.0\.0-development$/m);
    assert.match(result.stdout, /^Usage:$/m);
    assert.match(result.stdout, /^  nextjshx build/m);
  } finally {
    fs.rmSync(temporaryDirectory, { force: true, recursive: true });
  }
});
