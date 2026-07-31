#!/usr/bin/env node

import { spawn, spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import Ajv2020 from "ajv/dist/2020.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const MANIFEST_PATH = path.join(ROOT, "config/test-lanes.json");
const SCHEMA_PATH = path.join(ROOT, "schemas/test-lanes.schema.json");
const RESULTS_ROOT = path.join(ROOT, ".nextjshx/testing");
const PACKAGE_PATH = path.join(ROOT, "package.json");
const SUPPORT_PATH = path.join(ROOT, "support_matrix.json");
const SELF = fileURLToPath(import.meta.url);

class TestLaneFailure extends Error {}

function portable(value) {
  return value.split(path.sep).join("/");
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    throw new TestLaneFailure(`cannot read ${portable(path.relative(ROOT, file))}: ${error.message}`);
  }
}

function formatAjvErrors(errors) {
  return (errors ?? [])
    .map((error) => `${error.instancePath || "/"} ${error.message}`)
    .join("; ");
}

export function validateManifestValue(manifest, packageValue = readJson(PACKAGE_PATH)) {
  const schema = readJson(SCHEMA_PATH);
  const validate = new Ajv2020({ allErrors: true, strict: true }).compile(schema);
  if (!validate(manifest)) {
    throw new TestLaneFailure(`test-lane manifest violates its schema: ${formatAjvErrors(validate.errors)}`);
  }

  const ids = manifest.lanes.map((lane) => lane.id);
  if (new Set(ids).size !== ids.length) {
    throw new TestLaneFailure("test-lane IDs must be unique");
  }
  const idSet = new Set(ids);
  const scripts = packageValue.scripts ?? {};
  for (const lane of manifest.lanes) {
    if (!(lane.npmScript in scripts)) {
      throw new TestLaneFailure(`${lane.id} references missing npm script ${lane.npmScript}`);
    }
    if (!lane.reproduction.startsWith(`npm run ${lane.npmScript}`)) {
      throw new TestLaneFailure(`${lane.id} reproduction must invoke npm run ${lane.npmScript}`);
    }
    for (const dependent of lane.reverseDependencies) {
      if (!idSet.has(dependent)) {
        throw new TestLaneFailure(`${lane.id} references unknown reverse dependency ${dependent}`);
      }
    }
    for (const pattern of lane.paths) {
      compilePattern(pattern);
    }
    if (lane.quarantine !== null && lane.claimStatus === "required") {
      throw new TestLaneFailure(`${lane.id} is quarantined and cannot supply a required claim`);
    }
  }

  const requiredGroups = ["main", "nightly", "release"];
  for (const group of requiredGroups) {
    if (!manifest.lanes.some((lane) => lane.groups.includes(group))) {
      throw new TestLaneFailure(`test-lane manifest has no ${group} backstop`);
    }
  }

  const support = readJson(SUPPORT_PATH);
  const stable = support.lanes.find((lane) => lane.id === "stable-package");
  const matrixLane = manifest.lanes.find((lane) => lane.id === "fixture.stable.matrix");
  if (stable === undefined || matrixLane === undefined) {
    throw new TestLaneFailure("stable support claim requires fixture.stable.matrix");
  }
  const stableEnvironment = matrixLane.environments[0];
  if (
    JSON.stringify([...stable.versions.node].sort()) !==
      JSON.stringify([...stableEnvironment.node].sort()) ||
    JSON.stringify([...stable.versions.bundlers].sort()) !==
      JSON.stringify([...stableEnvironment.bundler].sort())
  ) {
    throw new TestLaneFailure("fixture.stable.matrix must match support_matrix.json Node and bundler cells");
  }
  if (matrixLane.claimStatus !== "required" || !matrixLane.groups.includes("release")) {
    throw new TestLaneFailure("fixture.stable.matrix must remain required release evidence");
  }

  for (const workspace of packageValue.workspaces ?? []) {
    if (!workspace.startsWith("examples/")) {
      continue;
    }
    if (!manifest.lanes.some((lane) => lane.paths.some((pattern) => pattern.startsWith(`${workspace}/`)))) {
      throw new TestLaneFailure(`maintained workspace ${workspace} has no test-lane owner`);
    }
  }
  return manifest;
}

export function loadManifest() {
  return validateManifestValue(readJson(MANIFEST_PATH));
}

function escapeRegex(character) {
  return /[\\^$.*+?()[\]{}|]/.test(character) ? `\\${character}` : character;
}

export function compilePattern(pattern) {
  if (
    pattern.startsWith("/") ||
    pattern.includes("\\") ||
    pattern.split("/").includes("..") ||
    pattern.length === 0
  ) {
    throw new TestLaneFailure(`unsafe test-lane path pattern ${JSON.stringify(pattern)}`);
  }
  let source = "^";
  for (let index = 0; index < pattern.length; index += 1) {
    const character = pattern[index];
    if (character === "*" && pattern[index + 1] === "*") {
      if (pattern[index + 2] === "/") {
        source += "(?:.*/)?";
        index += 2;
      } else {
        source += ".*";
        index += 1;
      }
    } else if (character === "*") {
      source += "[^/]*";
    } else if (character === "?") {
      source += "[^/]";
    } else {
      source += escapeRegex(character);
    }
  }
  return new RegExp(`${source}$`);
}

function laneMatchesPath(lane, changedPath) {
  return lane.paths.some((pattern) => compilePattern(pattern).test(changedPath));
}

export function selectLanes(manifest, changedPaths) {
  const normalizedPaths = [...new Set(changedPaths.map(portable).filter(Boolean))].sort();
  const selected = new Map();
  const unmatched = [];
  let fullExpansion = false;

  for (const lane of manifest.lanes) {
    if (lane.alwaysRun) {
      selected.set(lane.id, [`always-run sentinel for ${lane.owners.join(", ")}`]);
    }
  }

  for (const changedPath of normalizedPaths) {
    const matches = manifest.lanes.filter((lane) => laneMatchesPath(lane, changedPath));
    if (matches.length === 0) {
      unmatched.push(changedPath);
      fullExpansion = true;
      continue;
    }
    for (const lane of matches) {
      const reasons = selected.get(lane.id) ?? [];
      reasons.push(`${changedPath} matches ${lane.paths.find((pattern) => compilePattern(pattern).test(changedPath))}`);
      selected.set(lane.id, reasons);
      fullExpansion ||= lane.expansion === "full";
    }
  }

  if (fullExpansion) {
    const reason =
      unmatched.length > 0
        ? `fail-safe full expansion for unowned path(s): ${unmatched.join(", ")}`
        : "fail-safe full expansion requested by a cross-cutting owner";
    for (const lane of manifest.lanes) {
      const reasons = selected.get(lane.id) ?? [];
      reasons.push(reason);
      selected.set(lane.id, reasons);
    }
  }

  const lanesById = new Map(manifest.lanes.map((lane) => [lane.id, lane]));
  const pending = [...selected.keys()];
  while (pending.length > 0) {
    const id = pending.shift();
    const lane = lanesById.get(id);
    for (const dependent of lane.reverseDependencies) {
      if (!selected.has(dependent)) {
        selected.set(dependent, [`reverse dependency of ${id}`]);
        pending.push(dependent);
      } else {
        selected.get(dependent).push(`reverse dependency of ${id}`);
      }
    }
  }

  const selectedLanes = manifest.lanes
    .filter((lane) => selected.has(lane.id))
    .map((lane) => ({ lane, reasons: [...new Set(selected.get(lane.id))] }));
  const omittedLanes = manifest.lanes
    .filter((lane) => !selected.has(lane.id))
    .map((lane) => ({
      lane,
      reason: "no changed path, always-run rule, full expansion, or reverse dependency selected this owner",
    }));
  return { changedPaths: normalizedPaths, selectedLanes, omittedLanes, unmatched, fullExpansion };
}

function git(args) {
  const result = spawnSync("git", args, { cwd: ROOT, encoding: "utf8" });
  if (result.error !== undefined) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new TestLaneFailure(`git ${args.join(" ")} failed:\n${result.stderr ?? result.stdout}`);
  }
  return result.stdout.trim();
}

function hasUnstagedChanges(repositoryPath) {
  const result = spawnSync("git", ["diff", "--quiet", "--", repositoryPath], {
    cwd: ROOT,
    encoding: "utf8",
  });
  if (result.error !== undefined) {
    throw result.error;
  }
  if (result.status === 0) {
    return false;
  }
  if (result.status === 1) {
    return true;
  }
  throw new TestLaneFailure(
    `git diff --quiet -- ${repositoryPath} failed:\n${result.stderr ?? result.stdout}`,
  );
}

function changedPathsFromArguments(args) {
  const explicit = [];
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === "--path") {
      if (args[index + 1] === undefined) {
        throw new TestLaneFailure("--path requires a repository-relative path");
      }
      explicit.push(args[index + 1]);
      index += 1;
    }
  }
  if (explicit.length > 0) {
    return explicit;
  }
  if (args.includes("--staged")) {
    return git(["diff", "--cached", "--name-only", "--diff-filter=ACMRD"])
      .split(/\r?\n/)
      .filter(Boolean);
  }
  const baseIndex = args.indexOf("--base");
  const headIndex = args.indexOf("--head");
  if (baseIndex >= 0 || headIndex >= 0) {
    const base = baseIndex >= 0 ? args[baseIndex + 1] : undefined;
    const head = headIndex >= 0 ? args[headIndex + 1] : "HEAD";
    if (!base) {
      throw new TestLaneFailure("--base requires a Git revision");
    }
    return git(["diff", "--name-only", "--diff-filter=ACMRD", `${base}...${head}`])
      .split(/\r?\n/)
      .filter(Boolean);
  }
  throw new TestLaneFailure("select changed paths with --staged, --base REV [--head REV], or --path FILE");
}

function planValue(selection, hookOnly = false) {
  return {
    schemaVersion: 1,
    selectionMode: "observation",
    changedPaths: selection.changedPaths,
    unmatchedPaths: selection.unmatched,
    fullExpansion: selection.fullExpansion,
    selected: selection.selectedLanes.map(({ lane, reasons }) => ({
      id: lane.id,
      ring: lane.ring,
      claimStatus: lane.claimStatus,
      hookEligible: lane.hook,
      executeNow: !hookOnly || lane.hook,
      reasons,
      environments: lane.environments,
      reproduction: lane.reproduction,
    })),
    omitted: selection.omittedLanes.map(({ lane, reason }) => ({
      id: lane.id,
      reason,
      reproduction: lane.reproduction,
    })),
  };
}

function printPlan(plan) {
  console.log(`[test-loop] observation plan for ${plan.changedPaths.length} changed path(s)`);
  if (plan.changedPaths.length === 0) {
    console.log("  changed: none");
  } else {
    for (const changedPath of plan.changedPaths) {
      console.log(`  changed: ${changedPath}`);
    }
  }
  if (plan.fullExpansion) {
    console.log("  escalation: full validation (cross-cutting or unowned path)");
  }
  console.log("  selected:");
  for (const selected of plan.selected) {
    const hook = selected.executeNow ? "" : " [remote/explicit; not run by pre-commit]";
    console.log(`    - ${selected.id} (${selected.ring}, ${selected.claimStatus})${hook}`);
    for (const reason of selected.reasons) {
      console.log(`      because: ${reason}`);
    }
    console.log(`      reproduce: ${selected.reproduction}`);
  }
  console.log("  omitted:");
  for (const omitted of plan.omitted) {
    console.log(`    - ${omitted.id}: ${omitted.reason}`);
  }
}

function repositoryIdentity() {
  const head = git(["rev-parse", "HEAD"]);
  const dirty = spawnSync("git", ["diff", "--binary", "HEAD"], {
    cwd: ROOT,
    encoding: null,
  });
  if (dirty.error !== undefined || dirty.status !== 0) {
    throw dirty.error ?? new TestLaneFailure("cannot fingerprint the working tree");
  }
  const untracked = spawnSync(
    "git",
    ["ls-files", "--others", "--exclude-standard", "-z"],
    { cwd: ROOT, encoding: null },
  );
  if (untracked.error !== undefined || untracked.status !== 0) {
    throw untracked.error ?? new TestLaneFailure("cannot fingerprint untracked source files");
  }
  const digest = crypto.createHash("sha256");
  digest.update("nextjshx-dirty-patch/v1\0");
  digest.update(dirty.stdout);
  for (const relativeBuffer of untracked.stdout.toString("utf8").split("\0").filter(Boolean)) {
    const absolute = path.join(ROOT, relativeBuffer);
    const status = fs.lstatSync(absolute);
    digest.update(`untracked\0${portable(relativeBuffer)}\0`);
    if (status.isSymbolicLink()) {
      digest.update(`symlink\0${fs.readlinkSync(absolute)}\0`);
    } else if (status.isFile()) {
      digest.update("file\0");
      digest.update(fs.readFileSync(absolute));
      digest.update("\0");
    } else {
      throw new TestLaneFailure(
        `untracked source is neither a regular file nor a symbolic link: ${portable(relativeBuffer)}`,
      );
    }
  }
  return {
    commit: head,
    dirtyPatch: digest.digest("hex"),
  };
}

async function stopProcessGroup(child) {
  if (child.exitCode !== null || child.signalCode !== null) {
    return;
  }
  try {
    if (process.platform === "win32") {
      child.kill("SIGTERM");
    } else {
      process.kill(-child.pid, "SIGTERM");
    }
  } catch {}
  await new Promise((resolve) => setTimeout(resolve, 250));
  if (child.exitCode === null && child.signalCode === null) {
    try {
      if (process.platform === "win32") {
        child.kill("SIGKILL");
      } else {
        process.kill(-child.pid, "SIGKILL");
      }
    } catch {}
  }
}

export async function runProcess(command, args, timeoutSeconds, options = {}) {
  const started = performance.now();
  const child = spawn(command, args, {
    cwd: options.cwd ?? ROOT,
    env: { ...process.env, CI: process.env.CI ?? "1", NO_COLOR: process.env.NO_COLOR ?? "1" },
    stdio: options.stdio ?? "inherit",
    detached: process.platform !== "win32",
  });
  let timedOut = false;
  const timer = setTimeout(async () => {
    timedOut = true;
    await stopProcessGroup(child);
  }, timeoutSeconds * 1000);
  const result = await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code, signal) => resolve({ code, signal }));
  });
  clearTimeout(timer);
  return {
    ...result,
    timedOut,
    durationMs: Math.round(performance.now() - started),
  };
}

function runId() {
  const explicit = process.env.NEXTJSHX_TEST_RUN_ID;
  if (explicit) {
    return explicit.replace(/[^A-Za-z0-9._-]/g, "_");
  }
  return `${new Date().toISOString().replace(/[:.]/g, "-")}-${process.pid}`;
}

async function runLane(lane, reasons, currentRunId) {
  const resultDirectory = path.join(RESULTS_ROOT, "results", currentRunId);
  fs.mkdirSync(resultDirectory, { recursive: true });
  const identity = repositoryIdentity();
  const marker = path.join(ROOT, "tools/cli/.tmp/.nextjshx-cli-build.json");
  const preparedBefore = fs.existsSync(marker);
  console.log(`\n[test-loop] ${lane.id}: ${lane.reproduction}`);
  const execution = await runProcess("npm", ["run", lane.npmScript], lane.timeoutSeconds);
  const outcome = execution.timedOut
    ? "timeout"
    : execution.code === 0
      ? "passed"
      : execution.signal
        ? "signal"
        : "failed";
  const value = {
    schemaVersion: 1,
    runId: currentRunId,
    commit: identity.commit,
    dirtyPatch: identity.dirtyPatch,
    laneId: lane.id,
    selectedReason: reasons,
    environment: {
      node: process.versions.node,
      platform: process.platform,
      architecture: process.arch,
      declared: lane.environments,
    },
    profile: lane.environments.flatMap((environment) => environment.profile),
    bundler: lane.environments.flatMap((environment) => environment.bundler),
    mode: lane.mode,
    durationsMs: {
      setup: 0,
      execution: execution.durationMs,
      cleanup: 0,
    },
    outcome,
    exitCode: execution.code,
    signal: execution.signal,
    timeout: execution.timedOut,
    retryCount: 0,
    quarantine: lane.quarantine,
    preparedArtifact: {
      required: lane.preparation.includes("cli-runtime") || lane.preparation.includes("cli-test"),
      presentBefore: preparedBefore,
      presentAfter: fs.existsSync(marker),
      verificationOwner: lane.preparation.includes("cli-runtime") || lane.preparation.includes("cli-test")
        ? "tools/cli/scripts/ensure-build.mjs"
        : null,
    },
    artifacts: lane.artifacts,
    reproduction: lane.reproduction,
  };
  const resultPath = path.join(resultDirectory, `${lane.id}.json`);
  fs.writeFileSync(resultPath, `${JSON.stringify(value, null, 2)}\n`);
  console.log(`[test-loop] ${lane.id}: ${outcome} in ${(execution.durationMs / 1000).toFixed(2)}s`);
  if (process.env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      `- \`${lane.id}\`: **${outcome}** in ${(execution.durationMs / 1000).toFixed(2)}s — \`${lane.reproduction}\`\n`,
    );
  }
  if (outcome !== "passed") {
    throw new TestLaneFailure(`${lane.id} ${outcome}; reproduce with ${lane.reproduction}`);
  }
}

async function runLanes(entries) {
  const currentRunId = runId();
  for (const entry of entries) {
    await runLane(entry.lane, entry.reasons, currentRunId);
  }
}

function byGroup(manifest, group) {
  return manifest.lanes
    .filter((lane) => lane.groups.includes(group))
    .map((lane) => ({ lane, reasons: [`declared ${group} group`] }));
}

async function selfTest(manifest) {
  const ordinaryDocs = selectLanes(manifest, ["docs/getting-started.md"]);
  if (ordinaryDocs.fullExpansion || ordinaryDocs.unmatched.length > 0) {
    throw new TestLaneFailure("ordinary documentation did not stay on its declared fast path");
  }
  const unknown = selectLanes(manifest, ["unowned/new-surface.bin"]);
  if (!unknown.fullExpansion || unknown.selectedLanes.length !== manifest.lanes.length) {
    throw new TestLaneFailure("unknown paths did not fail safe to full validation");
  }
  const failure = await runProcess(process.execPath, ["-e", "process.exit(7)"], 5, {
    stdio: "ignore",
  });
  if (failure.code !== 7 || failure.timedOut) {
    throw new TestLaneFailure("deliberate child failure did not propagate its nonzero status");
  }
  const timeout = await runProcess(
    process.execPath,
    ["-e", "setInterval(() => {}, 1000)"],
    0.05,
    { stdio: "ignore" },
  );
  if (!timeout.timedOut || timeout.code === 0) {
    throw new TestLaneFailure("deliberate child timeout did not terminate and classify the process");
  }
  console.log("[test-loop] self-test: selector expansion, nonzero propagation, and timeout cleanup passed");
}

function parseOption(args, name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

async function main() {
  const command = process.argv[2] ?? "validate";
  const args = process.argv.slice(3);
  const manifest = loadManifest();
  if (command === "validate") {
    console.log(
      `[test-loop] manifest: OK: ${manifest.lanes.length} stable lanes; affected execution remains ${manifest.selectionMode}`,
    );
    return;
  }
  if (command === "self-test") {
    await selfTest(manifest);
    return;
  }
  if (command === "check-staged") {
    const staged = changedPathsFromArguments(["--staged"]);
    const partial = staged.filter((changedPath) => {
      const hookOwned = manifest.lanes.some(
        (lane) => lane.hook && laneMatchesPath(lane, changedPath),
      );
      const unknown = !manifest.lanes.some((lane) => laneMatchesPath(lane, changedPath));
      return (hookOwned || unknown) && hasUnstagedChanges(changedPath);
    });
    if (partial.length > 0) {
      throw new TestLaneFailure(
        `hook-owned files are only partially staged: ${partial.join(", ")}. Stage each complete file so validation sees the bytes being committed.`,
      );
    }
    console.log(`[test-loop] staged ownership: OK: ${staged.length} staged path(s)`);
    return;
  }
  if (command === "explain" || command === "changed") {
    const selection = selectLanes(manifest, changedPathsFromArguments(args));
    const hookOnly = args.includes("--hook");
    const plan = planValue(selection, hookOnly);
    const output = parseOption(args, "--output");
    if (output) {
      const absolute = path.resolve(ROOT, output);
      if (!portable(path.relative(ROOT, absolute)).startsWith(".nextjshx/testing/")) {
        throw new TestLaneFailure("--output must stay under .nextjshx/testing/");
      }
      fs.mkdirSync(path.dirname(absolute), { recursive: true });
      fs.writeFileSync(absolute, `${JSON.stringify(plan, null, 2)}\n`);
    }
    if (args.includes("--json")) {
      console.log(JSON.stringify(plan, null, 2));
    } else {
      printPlan(plan);
    }
    if (command === "changed") {
      const executable = selection.selectedLanes.filter(({ lane }) => !hookOnly || lane.hook);
      await runLanes(executable);
    }
    return;
  }
  if (command === "focused") {
    const id = parseOption(args, "--id");
    const lane = manifest.lanes.find((candidate) => candidate.id === id);
    if (!lane) {
      throw new TestLaneFailure(`unknown focused lane ${JSON.stringify(id)}`);
    }
    await runLanes([{ lane, reasons: ["explicit focused lane"] }]);
    return;
  }
  if (command === "smoke" || command === "harness") {
    await runLanes(byGroup(manifest, command));
    return;
  }
  throw new TestLaneFailure(
    `unknown command ${JSON.stringify(command)}; expected validate, self-test, check-staged, explain, focused, changed, smoke, or harness`,
  );
}

if (process.argv[1] === SELF) {
  main().catch((error) => {
    console.error(`[test-loop] ERROR: ${error.message}`);
    process.exitCode = 1;
  });
}
