#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const UPDATE_HINT = "npm run test:snapshots:update";
const HAXE_VERSION = "4.3.7";
const CASES = [
  {
    id: "next-stable-generated",
    build: "tests/fixtures/next-stable/build.hxml",
    generated: "tests/fixtures/next-stable/src-gen",
    snapshots: "tests/snapshots/next-stable-generated",
    extensions: new Set([".css", ".ts", ".tsx", ".manifest"]),
  },
];

class SnapshotFailure extends Error {}

function bytewise(left, right) {
  return Buffer.compare(Buffer.from(left), Buffer.from(right));
}

function normalizeText(source) {
  return `${source.replace(/\r\n?/g, "\n").replace(/[ \t]+$/gm, "").replace(/\n*$/, "")}\n`;
}

function relativeFiles(root) {
  if (!fs.existsSync(root)) {
    return [];
  }
  const files = [];
  function walk(directory) {
    const entries = fs.readdirSync(directory, { withFileTypes: true }).sort((left, right) =>
      bytewise(left.name, right.name),
    );
    for (const entry of entries) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        walk(absolute);
      } else if (entry.isFile()) {
        files.push(path.relative(root, absolute).split(path.sep).join("/"));
      } else {
        throw new SnapshotFailure(`snapshot trees cannot contain links or special files: ${absolute}`);
      }
    }
  }
  walk(root);
  return files.sort(bytewise);
}

function runHaxe(build) {
  const result = spawnSync("haxe", [build], { cwd: ROOT, stdio: "inherit" });
  if (result.error !== undefined) {
    throw result.error;
  }
  assert.equal(result.status, 0, `${build} failed`);
}

function prepareCssModules() {
  const result = spawnSync(process.execPath, ["scripts/fixtures/next-stable-css-modules.mjs"], {
    cwd: ROOT,
    stdio: "inherit",
  });
  if (result.error !== undefined) {
    throw result.error;
  }
  assert.equal(result.status, 0, "CSS Module preparation failed");
}

function verifyHaxeVersion() {
  const result = spawnSync("haxe", ["--version"], { cwd: ROOT, encoding: "utf8" });
  if (result.error !== undefined) {
    throw result.error;
  }
  assert.equal(result.status, 0, "haxe --version failed");
  assert.equal(result.stdout.trim(), HAXE_VERSION, `expected Haxe ${HAXE_VERSION}`);
}

function selectedFiles(testCase, root) {
  const files = relativeFiles(root);
  const unsupported = files.filter(
    (relative) => !testCase.extensions.has(path.posix.extname(relative)),
  );
  assert.deepEqual(unsupported, [], `${testCase.id} emitted unsupported files`);
  assert(files.length > 0, `${testCase.id} generated no snapshot files`);
  return files;
}

function writeSnapshots(testCase, generatedRoot, snapshotRoot) {
  fs.rmSync(snapshotRoot, { recursive: true, force: true });
  const files = selectedFiles(testCase, generatedRoot);
  for (const relative of files) {
    const destination = path.join(snapshotRoot, relative);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(
      destination,
      normalizeText(fs.readFileSync(path.join(generatedRoot, relative), "utf8")),
      "utf8",
    );
  }
  console.log(`[snapshots] updated ${testCase.id}: ${files.length} file(s)`);
}

function showDiff(snapshot, generated) {
  spawnSync("git", ["--no-pager", "diff", "--no-index", "--", snapshot, generated], {
    cwd: ROOT,
    stdio: "inherit",
  });
}

function verifySnapshots(testCase, generatedRoot, snapshotRoot) {
  const generatedFiles = selectedFiles(testCase, generatedRoot);
  const snapshotFiles = relativeFiles(snapshotRoot);
  const missing = generatedFiles.filter((relative) => !snapshotFiles.includes(relative));
  const extra = snapshotFiles.filter((relative) => !generatedFiles.includes(relative));
  const mismatched = generatedFiles.filter((relative) => {
    if (!snapshotFiles.includes(relative)) {
      return false;
    }
    return (
      normalizeText(fs.readFileSync(path.join(generatedRoot, relative), "utf8")) !==
      normalizeText(fs.readFileSync(path.join(snapshotRoot, relative), "utf8"))
    );
  });
  if (missing.length === 0 && extra.length === 0 && mismatched.length === 0) {
    console.log(`[snapshots] verified ${testCase.id}: ${generatedFiles.length} file(s)`);
    return;
  }

  for (const relative of missing) {
    console.error(`[snapshots] missing: ${relative}`);
  }
  for (const relative of extra) {
    console.error(`[snapshots] extra: ${relative}`);
  }
  for (const relative of mismatched.slice(0, 3)) {
    console.error(`[snapshots] mismatch: ${relative}`);
    showDiff(path.join(snapshotRoot, relative), path.join(generatedRoot, relative));
  }
  throw new SnapshotFailure(`snapshot drift detected; review and run ${UPDATE_HINT}`);
}

try {
  verifyHaxeVersion();
  const mode = process.argv[2] ?? "verify";
  if (!new Set(["verify", "update"]).has(mode)) {
    throw new SnapshotFailure(`unknown mode ${mode}; expected verify or update`);
  }
  if (mode === "update" && /^(?:1|true)$/i.test(process.env.CI ?? "")) {
    throw new SnapshotFailure("snapshot updates are disabled in CI");
  }

  for (const testCase of CASES) {
    const generatedRoot = path.join(ROOT, testCase.generated);
    const snapshotRoot = path.join(ROOT, testCase.snapshots);
    fs.rmSync(generatedRoot, { recursive: true, force: true });
    prepareCssModules();
    runHaxe(testCase.build);
    if (mode === "update") {
      writeSnapshots(testCase, generatedRoot, snapshotRoot);
    } else {
      verifySnapshots(testCase, generatedRoot, snapshotRoot);
    }
  }
  console.log(`[snapshots] ${mode}: OK`);
} catch (error) {
  console.error(`[snapshots] ERROR: ${error.message}`);
  process.exitCode = 1;
}
