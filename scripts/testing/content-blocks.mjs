#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const FIXTURE = path.join(ROOT, "tests/content-blocks");
const TEMP = path.join(FIXTURE, ".tmp");
const TYPESCRIPT = path.join(TEMP, "typescript");
const RUNTIME = path.join(TEMP, "runtime");

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} failed (${result.status})\n${result.stdout}${result.stderr}`,
    );
  }
  return `${result.stdout}${result.stderr}`;
}

function treeDigest(root) {
  const hash = crypto.createHash("sha256");
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort(
      (left, right) => left.name.localeCompare(right.name),
    )) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        visit(file);
      } else {
        hash.update(path.relative(root, file));
        hash.update(fs.readFileSync(file));
      }
    }
  };
  visit(root);
  return hash.digest("hex");
}

function main() {
  fs.rmSync(TEMP, { recursive: true, force: true });
  run("haxe", ["tests/content-blocks/build-typescript.hxml"]);
  const first = treeDigest(TYPESCRIPT);
  run("haxe", ["tests/content-blocks/build-typescript.hxml"]);
  assert.equal(treeDigest(TYPESCRIPT), first, "portable content output drifted");

  run("tsc6", [
    "--project",
    "tests/content-blocks/tsconfig.json",
    "--noEmit",
  ]);

  const decoder = fs.readFileSync(
    path.join(TYPESCRIPT, "nextjs/content/PortableContentDecoder.tsx"),
    "utf8",
  );
  const renderer = fs.readFileSync(
    path.join(TYPESCRIPT, "nextjs/content/ContentBlockRenderer.tsx"),
    "utf8",
  );
  assert(decoder.includes("executable MDX and JSX are never accepted"));
  assert(renderer.includes('className="content-data-series"'));
  assert(renderer.includes('className="content-code"'));
  assert(!/\sas\s|@ts-(?:ignore|nocheck)|Register\\.unsafeCast/.test(decoder));
  assert(!/\sas\s|@ts-(?:ignore|nocheck)|Register\\.unsafeCast/.test(renderer));

  const negative = spawnSync(
    "haxe",
    ["tests/content-blocks/build-negative.hxml"],
    { cwd: ROOT, encoding: "utf8" },
  );
  const negativeOutput = `${negative.stdout}${negative.stderr}`.trim();
  assert.notEqual(negative.status, 0, "incomplete content renderer compiled");
  assert(
    negativeOutput.includes("Unmatched patterns: Metric"),
    `incomplete renderer lost the exhaustive Haxe diagnostic\n${negativeOutput}`,
  );

  run("tsc6", [
    "--target",
    "ES2020",
    "--module",
    "commonjs",
    "--moduleResolution",
    "node",
    "--ignoreDeprecations",
    "6.0",
    "--jsx",
    "react-jsx",
    "--strict",
    "--skipLibCheck",
    "false",
    "--rootDir",
    TYPESCRIPT,
    "--outDir",
    RUNTIME,
    path.join(TYPESCRIPT, "index.tsx"),
  ]);
  fs.writeFileSync(
    path.join(RUNTIME, "package.json"),
    '{"type":"commonjs"}\n',
    "utf8",
  );
  const output = run(process.execPath, [
    path.join(RUNTIME, "index.js"),
  ]);
  assert(output.includes("content-blocks-runtime: OK"));
  fs.rmSync(TEMP, { recursive: true, force: true });
  process.stdout.write(
    "content-blocks: OK: deterministic strict output, 8 closed variants, exhaustive-switch failure, escaped executable text, and 7 malformed controls\n",
  );
}

try {
  main();
} catch (error) {
  fs.rmSync(TEMP, { recursive: true, force: true });
  process.stderr.write(`${error.stack ?? error}\n`);
  process.exitCode = 1;
}
