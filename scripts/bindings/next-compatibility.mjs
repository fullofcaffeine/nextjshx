#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(SCRIPT_PATH), "../..");
const MATRIX_PATH = path.join(ROOT, "support_matrix.json");
const SUPPORT_SCRIPT = path.join(ROOT, "scripts/compat/support-matrix.mjs");
const SURFACE_SCRIPT = path.join(ROOT, "scripts/bindings/next-surface.mjs");
const BINDING_SCRIPT = path.join(ROOT, "scripts/bindings/sync-next-bindings.mjs");
const REQUIRE = createRequire(import.meta.url);
const MAX_OUTPUT = 16 * 1024 * 1024;

class CompatibilityFailure extends Error {}

function relativeLabel(filePath) {
  const relative = path.relative(ROOT, filePath).split(path.sep).join("/");
  return relative.startsWith("../") ? path.basename(filePath) : relative;
}

function readJson(filePath, label) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    throw new CompatibilityFailure(`cannot read ${label}: ${error.message}`);
  }
}

function parseArguments(argv) {
  const lane = argv[0];
  if (!new Set(["stable", "upstream"]).has(lane)) {
    throw new CompatibilityFailure(
      "usage: next-compatibility.mjs stable|upstream [--output-dir <directory>]",
    );
  }
  let outputDir = path.join(ROOT, ".nextjshx/next-drift");
  for (let index = 1; index < argv.length; index += 1) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (flag !== "--output-dir" || value === undefined) {
      throw new CompatibilityFailure(`unknown or incomplete option ${flag}`);
    }
    outputDir = path.isAbsolute(value) ? value : path.resolve(ROOT, value);
    index += 1;
  }
  return { lane, outputDir };
}

function runNode(script, args, acceptedStatuses = new Set([0])) {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd: ROOT,
    encoding: "utf8",
    env: { ...process.env },
    maxBuffer: MAX_OUTPUT,
    timeout: 120_000,
  });
  if (result.error !== undefined) {
    throw new CompatibilityFailure(`${path.basename(script)} could not run: ${result.error.message}`);
  }
  if (!acceptedStatuses.has(result.status)) {
    const detail = `${result.stdout}${result.stderr}`.trim();
    throw new CompatibilityFailure(
      `${path.basename(script)} exited ${result.status}${detail === "" ? "" : `:\n${detail}`}`,
    );
  }
  return result;
}

function ensureOutputDirectory(outputDir) {
  if (fs.existsSync(outputDir)) {
    const stat = fs.lstatSync(outputDir);
    if (!stat.isDirectory() || stat.isSymbolicLink()) {
      throw new CompatibilityFailure("report output path must be a real directory");
    }
    return;
  }
  fs.mkdirSync(outputDir, { recursive: true, mode: 0o700 });
}

function atomicWrite(filePath, bytes) {
  const temporary = `${filePath}.tmp-${process.pid}`;
  try {
    fs.writeFileSync(temporary, bytes, { encoding: "utf8", flag: "wx", mode: 0o600 });
    fs.renameSync(temporary, filePath);
  } finally {
    fs.rmSync(temporary, { force: true });
  }
}

function followUpKey(change) {
  return `${change.code}\0${change.module}\0${change.export ?? ""}`;
}

function renderUpstreamFollowUps(report, configuredFollowUps) {
  const configured = new Map(
    configuredFollowUps.map((followUp) => [
      `${followUp.code}\0${followUp.module}\0${followUp.export}`,
      followUp,
    ]),
  );
  const actionable = report.changes.filter(
    (change) =>
      change.classification === "breaking" ||
      change.classification === "unsupported-construct" ||
      (change.classification === "behavioral-review-required" &&
        change.code !== "NXHX-DRIFT-PACKAGE-VERSION-CHANGED"),
  );
  const lines = ["", "## Actionable Beads", ""];
  for (const change of actionable) {
    const followUp = configured.get(followUpKey(change));
    if (followUp === undefined) {
      throw new CompatibilityFailure(
        `pinned upstream drift ${change.code} for ${change.module}.${change.export ?? "<module>"} has no actionable Bead in support_matrix.json`,
      );
    }
    lines.push(
      `- \`${change.code}\` for \`${change.module}.${change.export}\` → \`${followUp.issue}\``,
    );
  }
  if (
    report.changes.some(
      (change) => change.code === "NXHX-DRIFT-PACKAGE-VERSION-CHANGED",
    )
  ) {
    lines.push(
      "- `NXHX-DRIFT-PACKAGE-VERSION-CHANGED` records the expected pinned canary lane identity; product-surface changes above own the actionable reviews.",
    );
  }
  if (actionable.length === 0) {
    lines.push("- No actionable upstream drift is present.");
  }
  lines.push("");
  return lines.join("\n");
}

function resolveSourceCheckout(matrix) {
  const oracle = matrix.sourceOracles.nextUpstream;
  const override = process.env[oracle.environmentVariable];
  if (override !== undefined && override.trim() !== "") {
    return {
      root: path.resolve(ROOT, override),
      label: `<${oracle.environmentVariable}>`,
    };
  }
  for (const candidate of oracle.candidates) {
    const root = path.resolve(ROOT, candidate);
    if (fs.existsSync(root)) {
      return { root, label: candidate };
    }
  }
  throw new CompatibilityFailure(
    `Next upstream checkout not found; set ${oracle.environmentVariable}, provide ` +
      "NEXTJSHX_NEXT_PACKAGE_DIR, or create one of the configured read-only sibling checkouts",
  );
}

function packageRootForLane(lane, matrix) {
  if (lane === "stable") {
    return {
      root: path.dirname(REQUIRE.resolve("next/package.json")),
      label: "installed stable package",
      expectedVersion: matrix.framework.next.stable.version,
    };
  }

  const packageOverride = process.env.NEXTJSHX_NEXT_PACKAGE_DIR;
  if (packageOverride !== undefined && packageOverride.trim() !== "") {
    return {
      root: path.resolve(ROOT, packageOverride),
      label: "<NEXTJSHX_NEXT_PACKAGE_DIR>",
      expectedVersion: matrix.framework.next.upstream.version,
    };
  }

  runNode(SUPPORT_SCRIPT, ["discover", "--require-upstream", "--json"]);
  const checkout = resolveSourceCheckout(matrix);
  return {
    root: path.join(checkout.root, "packages/next"),
    label: `${checkout.label}/packages/next`,
    expectedVersion: matrix.framework.next.upstream.version,
  };
}

function validatePackage(candidate) {
  let root;
  try {
    root = fs.realpathSync.native(candidate.root);
  } catch (error) {
    throw new CompatibilityFailure(`cannot resolve ${candidate.label}: ${error.message}`);
  }
  if (!fs.statSync(root).isDirectory()) {
    throw new CompatibilityFailure(`${candidate.label} is not a directory`);
  }
  const packageJson = readJson(path.join(root, "package.json"), `${candidate.label}/package.json`);
  if (packageJson.name !== "next" || packageJson.version !== candidate.expectedVersion) {
    throw new CompatibilityFailure(
      `${candidate.label} is ${packageJson.name ?? "<missing>"}@${packageJson.version ?? "<missing>"}; ` +
      `the ${candidate.expectedVersion} lane requires next@${candidate.expectedVersion}`,
    );
  }
  const distRoot = path.join(root, "dist");
  if (!fs.existsSync(distRoot) || !fs.statSync(distRoot).isDirectory()) {
    throw new CompatibilityFailure(
      `${candidate.label} has no built dist declarations; build packages/next in the exact ` +
        `${candidate.expectedVersion} checkout or set NEXTJSHX_NEXT_PACKAGE_DIR to an exact ` +
        `next@${candidate.expectedVersion} package root`,
    );
  }
  return { ...candidate, root, version: packageJson.version };
}

function run(options) {
  runNode(SUPPORT_SCRIPT, ["check"]);
  const matrix = readJson(MATRIX_PATH, "support_matrix.json");
  if (options.lane === "stable") {
    runNode(SURFACE_SCRIPT, ["check"]);
    runNode(BINDING_SCRIPT, ["check"]);
  }
  const candidate = validatePackage(packageRootForLane(options.lane, matrix));
  ensureOutputDirectory(options.outputDir);

  const prefix = `next-${options.lane}-drift`;
  const surfacePath = path.join(options.outputDir, `${prefix}-surface.json`);
  const jsonPath = path.join(options.outputDir, `${prefix}.json`);
  const markdownPath = path.join(options.outputDir, `${prefix}.md`);
  const surfaceResult = runNode(SURFACE_SCRIPT, [
    "candidate",
    "--next-package-root",
    candidate.root,
  ]);
  readJsonFromBytes(surfaceResult.stdout, "candidate surface");
  atomicWrite(surfacePath, surfaceResult.stdout);

  const classifiedStatuses = new Set([0, 1, 2]);
  const jsonResult = runNode(
    BINDING_SCRIPT,
    [
      "candidate",
      "--surface",
      surfacePath,
      "--next-package-root",
      candidate.root,
      "--format",
      "json",
    ],
    classifiedStatuses,
  );
  const report = readJsonFromBytes(jsonResult.stdout, "classified drift report");
  if (jsonResult.status !== report.decision?.exitCode) {
    throw new CompatibilityFailure(
      `classifier exited ${jsonResult.status}, but its report declares ${report.decision?.exitCode}`,
    );
  }
  const markdownResult = runNode(
    BINDING_SCRIPT,
    [
      "candidate",
      "--surface",
      surfacePath,
      "--next-package-root",
      candidate.root,
      "--format",
      "markdown",
    ],
    classifiedStatuses,
  );
  if (markdownResult.status !== report.decision.exitCode) {
    throw new CompatibilityFailure("JSON and Markdown classifiers disagreed on the exit code");
  }
  let renderedMarkdown = markdownResult.stdout;
  if (options.lane === "upstream") {
    renderedMarkdown += renderUpstreamFollowUps(
      report,
      matrix.framework.next.upstream.followUps,
    );
  }
  atomicWrite(jsonPath, jsonResult.stdout);
  atomicWrite(markdownPath, renderedMarkdown);

  console.log(
    `[next-compatibility] ${options.lane}: Next ${candidate.version}, ${report.decision.status}, ` +
      `${report.counts.breaking} breaking, ${report.counts.behavioralReviewRequired} behavioral, ` +
      `${report.counts.additive} additive, ${report.counts.compatible} compatible`,
  );
  console.log(
    `[next-compatibility] reports: ${relativeLabel(jsonPath)}, ${relativeLabel(markdownPath)}`,
  );
  process.stdout.write(`\n${renderedMarkdown}`);
  process.exitCode = report.decision.exitCode;
}

function readJsonFromBytes(bytes, label) {
  try {
    return JSON.parse(bytes);
  } catch (error) {
    throw new CompatibilityFailure(`${label} is not valid JSON: ${error.message}`);
  }
}

try {
  run(parseArguments(process.argv.slice(2)));
} catch (error) {
  console.error(`[next-compatibility] ERROR: ${error.message}`);
  process.exitCode = 1;
}
