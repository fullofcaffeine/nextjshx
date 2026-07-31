#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const CLI_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ROOT = path.resolve(CLI_ROOT, "../..");
const OUTPUT_ROOT = path.join(CLI_ROOT, ".tmp");
const MARKER_PATH = path.join(OUTPUT_ROOT, ".nextjshx-cli-build.json");
const TSC = path.join(ROOT, "node_modules/typescript/bin/tsc6");
const MODES = new Set(["runtime", "test"]);

class CliBuildFailure extends Error {}

function portable(relative) {
  return relative.split(path.sep).join("/");
}

function walk(directory) {
  if (!fs.existsSync(directory)) {
    return [];
  }
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return walk(absolute);
    }
    if (!entry.isFile()) {
      throw new CliBuildFailure(
        `CLI build input is not a regular file: ${portable(path.relative(ROOT, absolute))}`,
      );
    }
    return [absolute];
  });
}

function fingerprint(mode) {
  const files = [
    path.join(ROOT, "package.json"),
    path.join(ROOT, "package-lock.json"),
    path.join(CLI_ROOT, "package.json"),
    path.join(CLI_ROOT, "tsconfig.json"),
    path.join(CLI_ROOT, "tsconfig.runtime.json"),
    path.join(ROOT, "node_modules/typescript/package.json"),
    ...walk(path.join(CLI_ROOT, "src")).filter((file) => file.endsWith(".ts")),
    ...(mode === "test"
      ? walk(path.join(CLI_ROOT, "test")).filter((file) => file.endsWith(".ts"))
      : []),
  ].sort((left, right) => portable(left).localeCompare(portable(right)));
  const digest = crypto.createHash("sha256");
  digest.update("nextjshx-cli-build/v1\0");
  digest.update(`${mode}\0${process.platform}\0${process.arch}\0${process.versions.node}\0`);
  for (const file of files) {
    digest.update(`${portable(path.relative(ROOT, file))}\0`);
    digest.update(fs.readFileSync(file));
    digest.update("\0");
  }
  return digest.digest("hex");
}

function readMarker() {
  try {
    const value = JSON.parse(fs.readFileSync(MARKER_PATH, "utf8"));
    return value?.schemaVersion === 1 ? value : null;
  } catch {
    return null;
  }
}

function outputsExist(mode) {
  const runtimeOutputs = [
    path.join(OUTPUT_ROOT, "src/cli.js"),
    path.join(OUTPUT_ROOT, "src/index.js"),
  ];
  if (!runtimeOutputs.every((file) => fs.existsSync(file) && fs.statSync(file).isFile())) {
    return false;
  }
  if (mode === "test") {
    const testRoot = path.join(OUTPUT_ROOT, "test");
    return fs.existsSync(testRoot) && walk(testRoot).some((file) => file.endsWith(".test.js"));
  }
  return true;
}

function outputFingerprint(mode) {
  if (!outputsExist(mode)) {
    return null;
  }
  const roots =
    mode === "test"
      ? [path.join(OUTPUT_ROOT, "src"), path.join(OUTPUT_ROOT, "test")]
      : [path.join(OUTPUT_ROOT, "src")];
  const files = roots
    .flatMap((root) => walk(root))
    .sort((left, right) => portable(left).localeCompare(portable(right)));
  const digest = crypto.createHash("sha256");
  digest.update(`nextjshx-cli-output/v1\0${mode}\0`);
  for (const file of files) {
    digest.update(`${portable(path.relative(OUTPUT_ROOT, file))}\0`);
    digest.update(fs.readFileSync(file));
    digest.update("\0");
  }
  return digest.digest("hex");
}

function writeMarker(mode, exactFingerprint) {
  const value = {
    schemaVersion: 1,
    mode,
    runtimeFingerprint: mode === "runtime" ? exactFingerprint : fingerprint("runtime"),
    testFingerprint: mode === "test" ? exactFingerprint : null,
    runtimeOutputFingerprint: outputFingerprint("runtime"),
    testOutputFingerprint: mode === "test" ? outputFingerprint("test") : null,
    node: process.versions.node,
    platform: process.platform,
    architecture: process.arch,
  };
  fs.mkdirSync(OUTPUT_ROOT, { recursive: true });
  const temporary = `${MARKER_PATH}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { flag: "wx" });
  fs.renameSync(temporary, MARKER_PATH);
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: CLI_ROOT,
    encoding: "utf8",
    env: { ...process.env, CI: process.env.CI ?? "1", NO_COLOR: process.env.NO_COLOR ?? "1" },
    maxBuffer: 32 * 1024 * 1024,
  });
  if (result.error !== undefined) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new CliBuildFailure(
      `${path.basename(command)} ${args.join(" ")} exited ${result.status}:\n${result.stdout ?? ""}${result.stderr ?? ""}`,
    );
  }
  if (result.stdout) {
    process.stdout.write(result.stdout);
  }
  if (result.stderr) {
    process.stderr.write(result.stderr);
  }
}

export function ensureCliBuild(mode) {
  if (!MODES.has(mode)) {
    throw new CliBuildFailure(`unknown CLI build mode ${JSON.stringify(mode)}; expected runtime or test`);
  }
  if (!fs.existsSync(TSC)) {
    throw new CliBuildFailure("locked TypeScript compiler is missing; run npm ci first");
  }

  const started = performance.now();
  const exactFingerprint = fingerprint(mode);
  const marker = readMarker();
  const markerFingerprint =
    mode === "runtime" ? marker?.runtimeFingerprint : marker?.testFingerprint;
  const markerOutputFingerprint =
    mode === "runtime"
      ? marker?.runtimeOutputFingerprint
      : marker?.testOutputFingerprint;
  if (
    markerFingerprint === exactFingerprint &&
    markerOutputFingerprint === outputFingerprint(mode)
  ) {
    console.log(
      `[cli-build] ${mode}: verified prepared output (${Math.round(performance.now() - started)} ms)`,
    );
    return { mode, fingerprint: exactFingerprint, prepared: true };
  }

  if (mode === "test") {
    fs.rmSync(OUTPUT_ROOT, { recursive: true, force: true });
  } else {
    fs.rmSync(path.join(OUTPUT_ROOT, "src"), { recursive: true, force: true });
    fs.rmSync(MARKER_PATH, { force: true });
  }
  const config = mode === "runtime" ? "tsconfig.runtime.json" : "tsconfig.json";
  run(process.execPath, [TSC, "--project", config]);
  run(process.execPath, [path.join(CLI_ROOT, "scripts/mark-bin.mjs")]);
  if (!outputsExist(mode)) {
    throw new CliBuildFailure(`successful ${mode} compile did not create its required output`);
  }
  writeMarker(mode, exactFingerprint);
  console.log(
    `[cli-build] ${mode}: rebuilt exact input identity (${Math.round(performance.now() - started)} ms)`,
  );
  return { mode, fingerprint: exactFingerprint, prepared: false };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    ensureCliBuild(process.argv[2] ?? "runtime");
  } catch (error) {
    console.error(`[cli-build] ERROR: ${error.message}`);
    process.exitCode = 1;
  }
}
