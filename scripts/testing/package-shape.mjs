#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ARTIFACT_SOURCE = path.join(ROOT, "tests/package-shape/npm-artifact");
const CONSUMER_SOURCE = path.join(ROOT, "tests/package-shape/consumer");
const TSC_BIN = path.join(ROOT, "node_modules/typescript/bin/tsc6");
const PACKAGE_NAME = "@nextjshx/package-shape-fixture";
const PACKAGE_VERSION = "0.0.0";
const EXPECTED_FILES = ["dist/index.d.ts", "dist/index.js", "package.json"];
const EXPECTED_TRANSCRIPT = {
  marker: "packed-local-artifact",
  label: "packed-local-artifact:consumer",
};

class PackageShapeFailure extends Error {}

function run(command, args, cwd, capture = false) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    env: { ...process.env, npm_config_audit: "false", npm_config_fund: "false" },
    stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
  });
  if (result.error !== undefined) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new PackageShapeFailure(
      `${command} exited ${result.status}:\n${result.stdout ?? ""}${result.stderr ?? ""}`,
    );
  }
  return {
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

function parseLastJsonLine(output, label) {
  const line = output
    .split(/\r?\n/)
    .map((candidate) => candidate.trim())
    .filter(Boolean)
    .at(-1);
  if (line === undefined) {
    throw new PackageShapeFailure(`${label} produced no output`);
  }
  try {
    return JSON.parse(line);
  } catch (error) {
    throw new PackageShapeFailure(`${label} produced invalid JSON: ${error.message}`);
  }
}

const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "nextjshx-package-shape-"));
try {
  const packOutput = run(
    "npm",
    ["pack", "--json", "--pack-destination", temporaryRoot, ARTIFACT_SOURCE],
    ROOT,
    true,
  );
  const packResult = JSON.parse(packOutput.stdout);
  assert(Array.isArray(packResult) && packResult.length === 1, "npm pack returned one artifact");
  const artifact = packResult[0];
  assert.equal(artifact.id, `${PACKAGE_NAME}@${PACKAGE_VERSION}`, "packed identity drifted");
  assert.deepEqual(
    artifact.files.map((entry) => entry.path).sort(),
    EXPECTED_FILES,
    "packed file allowlist drifted",
  );
  assert.match(artifact.integrity, /^sha512-[A-Za-z0-9+/]+=*$/, "artifact has no integrity");

  const tarball = path.join(temporaryRoot, artifact.filename);
  assert(fs.statSync(tarball).isFile(), "npm pack did not create its tarball");
  const consumer = path.join(temporaryRoot, "consumer");
  fs.cpSync(CONSUMER_SOURCE, consumer, { recursive: true });
  run(
    "npm",
    [
      "install",
      "--ignore-scripts",
      "--offline",
      "--no-audit",
      "--no-fund",
      "--no-package-lock",
      "--no-save",
      tarball,
    ],
    consumer,
  );

  const installedManifest = JSON.parse(
    fs.readFileSync(
      path.join(consumer, "node_modules/@nextjshx/package-shape-fixture/package.json"),
      "utf8",
    ),
  );
  assert.equal(installedManifest.name, PACKAGE_NAME, "installed package name drifted");
  assert.equal(installedManifest.version, PACKAGE_VERSION, "installed package version drifted");

  run(process.execPath, [TSC_BIN, "--project", path.join(consumer, "tsconfig.json")], ROOT);
  const transcript = parseLastJsonLine(
    run(process.execPath, [path.join(consumer, "dist/index.js")], ROOT, true).stdout,
    "packed consumer",
  );
  assert.deepEqual(transcript, EXPECTED_TRANSCRIPT, "packed consumer transcript drifted");
  console.log(
    `[package-shape] OK: packed, offline-installed, strictly typed, and ran ${artifact.filename}`,
  );
} catch (error) {
  console.error(`[package-shape] ERROR: ${error.message}`);
  process.exitCode = 1;
} finally {
  fs.rmSync(temporaryRoot, { recursive: true, force: true });
}
