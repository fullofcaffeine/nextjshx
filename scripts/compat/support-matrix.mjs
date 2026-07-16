#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import Ajv2020 from "ajv/dist/2020.js";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, "../..");
const MATRIX_PATH = path.join(ROOT, "support_matrix.json");
const SCHEMA_PATH = path.join(ROOT, "schemas/support-matrix.schema.json");
const DOC_PATH = path.join(ROOT, "docs/compatibility.md");
const RUNTIME_ROOTS = ["src", "runtime", "packages", "lib"];
const SOURCE_EXTENSIONS = new Set([
  ".hx",
  ".hxml",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".ts",
  ".tsx"
]);

class MatrixFailure extends Error {}

function relativeLabel(filePath) {
  return path.relative(ROOT, filePath).split(path.sep).join("/");
}

function readText(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch (error) {
    throw new MatrixFailure(`cannot read ${relativeLabel(filePath)}: ${error.message}`);
  }
}

function readJson(filePath) {
  try {
    return JSON.parse(readText(filePath));
  } catch (error) {
    if (error instanceof MatrixFailure) {
      throw error;
    }
    throw new MatrixFailure(`invalid JSON in ${relativeLabel(filePath)}: ${error.message}`);
  }
}

function formatAjvErrors(errors) {
  return (errors ?? [])
    .map((error) => `${error.instancePath || "/"} ${error.message}`)
    .join("; ");
}

function npmScriptName(command) {
  const match = /^npm run ([a-z0-9:-]+)$/.exec(command);
  return match?.[1] ?? null;
}

function stableRangeContains(range, version) {
  const match = /^([0-9]+)\.([0-9]+)\.x$/.exec(range);
  if (match === null) {
    return false;
  }
  const [major, minor] = version.split(".");
  return major === match[1] && minor === match[2];
}

function listSourceFiles(directory) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...listSourceFiles(entryPath));
    } else if (entry.isFile() && SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
      files.push(entryPath);
    }
  }
  return files;
}

function assertNoRuntimeSiblingPaths(matrix) {
  const forbidden = new Set(
    Object.values(matrix.sourceOracles).flatMap((oracle) => oracle.candidates)
  );
  const leaks = [];
  for (const rootName of RUNTIME_ROOTS) {
    const runtimeRoot = path.join(ROOT, rootName);
    if (!fs.existsSync(runtimeRoot)) {
      continue;
    }
    for (const filePath of listSourceFiles(runtimeRoot)) {
      const source = readText(filePath);
      for (const candidate of forbidden) {
        if (source.includes(candidate)) {
          leaks.push(`${relativeLabel(filePath)} contains ${candidate}`);
        }
      }
    }
  }
  if (leaks.length > 0) {
    throw new MatrixFailure(
      `sibling checkout paths are tooling-only and cannot appear in runtime/library code: ${leaks.join(", ")}`
    );
  }
}

function assertSemanticContract(matrix) {
  const packageJson = readJson(path.join(ROOT, "package.json"));
  const haxerc = readJson(path.join(ROOT, ".haxerc"));
  const { node, haxe, typescript } = matrix.toolchain;
  const { next, react, genesTs } = matrix.framework;

  if (packageJson.engines?.node !== node.engine) {
    throw new MatrixFailure(
      `package.json engines.node must match support_matrix.json (${node.engine})`
    );
  }
  if (haxerc.version !== haxe.version) {
    throw new MatrixFailure(
      `.haxerc version must match support_matrix.json (${haxe.version})`
    );
  }
  if (node.engine !== `>=${node.minimumVersion}`) {
    throw new MatrixFailure("Node engine and minimumVersion disagree");
  }
  if (!node.ciVersions.includes(node.baselineVersion)) {
    throw new MatrixFailure("Node CI versions must include baselineVersion");
  }
  if (!node.ciVersions.includes(node.currentLts.version)) {
    throw new MatrixFailure("Node CI versions must include currentLts.version");
  }
  if (!stableRangeContains(next.stable.range, next.stable.version)) {
    throw new MatrixFailure("Next stable exact version is outside its declared range");
  }
  if (next.stable.nodeEngine !== node.engine) {
    throw new MatrixFailure("Next stable Node engine and project Node engine disagree");
  }
  if (react.version !== react.domVersion) {
    throw new MatrixFailure("React and React DOM exact versions must remain aligned");
  }
  if (genesTs.haxeVersion !== haxe.version) {
    throw new MatrixFailure("genes-ts and project Haxe versions disagree");
  }
  if (!genesTs.typescriptSpec.endsWith(`@${typescript.version}`)) {
    throw new MatrixFailure("genes-ts TypeScript spec and workspace TypeScript pin disagree");
  }

  const lanes = new Map(matrix.lanes.map((lane) => [lane.id, lane]));
  if (lanes.size !== matrix.lanes.length) {
    throw new MatrixFailure("support lane ids must be unique");
  }
  const stableLane = lanes.get("stable-package");
  const upstreamLane = lanes.get("source-upstream");
  if (stableLane?.required !== true || upstreamLane?.required !== false) {
    throw new MatrixFailure("stable-package must be required and source-upstream optional");
  }

  const expectedCommon = {
    react: react.version,
    reactDom: react.domVersion,
    typescript: typescript.version,
    haxe: haxe.version,
    genesTs: genesTs.version
  };
  for (const [laneName, lane] of lanes) {
    for (const [field, expected] of Object.entries(expectedCommon)) {
      if (lane.versions[field] !== expected) {
        throw new MatrixFailure(`${laneName} ${field} must be ${expected}`);
      }
    }
    for (const command of lane.commands.implemented) {
      const script = npmScriptName(command);
      if (script === null || typeof packageJson.scripts?.[script] !== "string") {
        throw new MatrixFailure(`${laneName} implemented command does not exist: ${command}`);
      }
    }
  }
  if (stableLane.versions.next !== next.stable.version) {
    throw new MatrixFailure("stable-package lane and Next stable version disagree");
  }
  if (upstreamLane.versions.next !== next.upstream.version) {
    throw new MatrixFailure("source-upstream lane and Next upstream version disagree");
  }

  if (stableLane.status === "verified") {
    const requiredEvidence = [
      "npm run test:fixture:next-stable",
      "npm run test:fixture:next-stable:smoke"
    ];
    for (const command of requiredEvidence) {
      if (!stableLane.commands.implemented.includes(command)) {
        throw new MatrixFailure(`verified stable-package lane lost evidence: ${command}`);
      }
      if (stableLane.commands.planned.includes(command)) {
        throw new MatrixFailure(`verified stable-package evidence remains planned: ${command}`);
      }
    }
  }

  const genesIdentity = matrix.sourceOracles.genesTs.identity;
  for (const field of ["name", "version", "commit", "haxeVersion", "typescriptSpec"]) {
    if (genesIdentity[field] !== genesTs[field]) {
      throw new MatrixFailure(`genes-ts oracle identity disagrees on ${field}`);
    }
  }
  const nextIdentity = matrix.sourceOracles.nextUpstream.identity;
  if (
    nextIdentity.version !== next.upstream.version ||
    nextIdentity.commit !== next.upstream.commit ||
    nextIdentity.nodeEngine !== node.engine ||
    nextIdentity.typescriptVersion !== typescript.version
  ) {
    throw new MatrixFailure("Next upstream oracle identity disagrees with the matrix");
  }

  for (const [name, oracle] of Object.entries(matrix.sourceOracles)) {
    for (const candidate of oracle.candidates) {
      if (path.isAbsolute(candidate) || !candidate.startsWith("../")) {
        throw new MatrixFailure(`${name} candidate must be a repository-relative sibling path`);
      }
    }
  }
  assertNoRuntimeSiblingPaths(matrix);
}

function markdownCell(value) {
  return String(value).replaceAll("|", "\\|");
}

function renderCompatibilityDoc(matrix) {
  const { node, haxe, typescript } = matrix.toolchain;
  const { next, react, genesTs } = matrix.framework;
  const lines = [
    "<!-- Generated by scripts/compat/support-matrix.mjs. Edit support_matrix.json, then run npm run support:docs. -->",
    "",
    "# Compatibility baseline",
    "",
    `This document is derived from [support_matrix.json](../support_matrix.json), schema version ${matrix.schemaVersion}. The machine-readable matrix is the source of truth.`,
    "",
    `Repository status: **${matrix.releaseStatus}**. ${matrix.evidencePolicy.supportMeaning}`,
    "",
    "## Exact baseline",
    "",
    "| Component | Exact baseline | Notes |",
    "| --- | --- | --- |",
    `| Next.js stable | ${next.stable.version} (${next.stable.range}) | Required package lane; Node ${next.stable.nodeEngine}. |`,
    `| React / React DOM | ${react.version} / ${react.domVersion} | React ${react.majorLane} primary lane. |`,
    `| TypeScript | ${typescript.version} | ${markdownCell(typescript.selection)} |`,
    `| Haxe | ${haxe.version} | Pinned by \`${haxe.config}\`. |`,
    `| genes-ts | ${genesTs.version} at \`${genesTs.commit}\` | ${markdownCell(genesTs.baselineReason)} |`,
    `| Node.js | floor ${node.minimumVersion}; baseline ${node.baselineVersion}; current LTS ${node.currentLts.version} (${node.currentLts.codename}) | CI contract: ${node.ciVersions.join(", ")}. |`,
    "",
    "## Evidence lanes",
    "",
    "| Lane | Required | Status | Next.js | Node.js | Implemented evidence | Owning bead |",
    "| --- | --- | --- | --- | --- | --- | --- |"
  ];
  for (const lane of matrix.lanes) {
    lines.push(
      `| ${lane.id} | ${lane.required ? "yes" : "no"} | ${lane.status} | ${lane.versions.next} | ${lane.versions.node.join(", ")} | ${lane.commands.implemented.map((command) => `\`${command}\``).join(", ")} | \`${lane.completionIssue}\` |`
    );
  }
  lines.push(
    "",
    "A `declared` lane has reproducible identities and contract checks but no framework support claim. An `observed` source lane has a matching local oracle identity but remains non-blocking. A lane becomes `verified` only after its real Next build and smoke evidence pass.",
    "",
    "Planned fixture commands:",
    ""
  );
  for (const lane of matrix.lanes) {
    for (const command of lane.commands.planned) {
      lines.push(`- \`${command}\` (${lane.id}, owned by \`${lane.completionIssue}\`)`);
    }
  }

  lines.push(
    "",
    "## Read-only source discovery",
    "",
    "Sibling repositories are optional tooling oracles. They are never runtime dependencies and their paths may not be hardcoded in library code.",
    ""
  );
  for (const [name, oracle] of Object.entries(matrix.sourceOracles)) {
    lines.push(
      `- **${name}:** set \`${oracle.environmentVariable}\`, or use ${oracle.candidates.map((candidate) => `\`${candidate}\``).join(" then ")}. Expected commit: \`${oracle.identity.commit}\`.`
    );
  }
  lines.push(
    "",
    "Commands:",
    "",
    "```sh",
    "npm run test:support-matrix",
    "npm run support:discover",
    "npm run support:require-genes",
    "npm run support:require-upstream",
    "```",
    "",
    "The baseline check is deterministic and requires no sibling checkout. Discovery reports missing checkouts as actionable, non-fatal diagnostics. The two `require` commands opt into fail-closed source-oracle lanes. Explicit environment overrides take precedence over default candidates.",
    "",
    "## Runtime and bundler scope",
    "",
    "| Kind | Name | Status | Reason |",
    "| --- | --- | --- | --- |"
  );
  for (const item of matrix.scope.runtimes) {
    lines.push(`| Runtime | ${item.name} | ${item.status} | ${markdownCell(item.reason)} |`);
  }
  for (const item of matrix.scope.bundlers) {
    lines.push(`| Bundler | ${item.name} | ${item.status} | ${markdownCell(item.reason)} |`);
  }
  lines.push("", "Included in the initial product boundary:", "");
  for (const item of matrix.scope.included) {
    lines.push(`- ${item}`);
  }
  lines.push("", "Explicit exclusions:", "");
  for (const item of matrix.scope.exclusions) {
    lines.push(`- ${item}`);
  }
  lines.push("");
  return lines.join("\n");
}

function loadValidatedMatrix({ checkDocs = true } = {}) {
  const schema = readJson(SCHEMA_PATH);
  const matrix = readJson(MATRIX_PATH);
  const ajv = new Ajv2020({
    allErrors: true,
    strict: true,
    validateFormats: false
  });
  const validate = ajv.compile(schema);
  if (!validate(matrix)) {
    throw new MatrixFailure(`support_matrix.json violates its schema: ${formatAjvErrors(validate.errors)}`);
  }
  assertSemanticContract(matrix);
  if (checkDocs) {
    const expected = renderCompatibilityDoc(matrix);
    const actual = readText(DOC_PATH);
    if (actual !== expected) {
      throw new MatrixFailure(
        "docs/compatibility.md is stale; run npm run support:docs and review the generated diff"
      );
    }
  }
  return matrix;
}

function runGit(directory, args) {
  const result = spawnSync("git", args, {
    cwd: directory,
    encoding: "utf8",
    timeout: 30_000
  });
  if (result.error !== undefined || result.status !== 0) {
    const detail =
      result.error?.message ?? (result.stderr.trim() || `exit ${result.status}`);
    throw new MatrixFailure(`cannot inspect source oracle Git identity: ${detail}`);
  }
  return result.stdout.trim();
}

function resolveOracle(name, oracle) {
  const override = process.env[oracle.environmentVariable];
  if (override !== undefined && override.trim() !== "") {
    const absolutePath = path.resolve(ROOT, override);
    if (!fs.existsSync(absolutePath)) {
      throw new MatrixFailure(
        `${oracle.environmentVariable} is set but does not name an existing checkout`
      );
    }
    return {
      name,
      absolutePath,
      displayPath: `<${oracle.environmentVariable}>`,
      source: `environment:${oracle.environmentVariable}`,
      preferredMissing: false
    };
  }

  for (const [index, candidate] of oracle.candidates.entries()) {
    const absolutePath = path.resolve(ROOT, candidate);
    if (fs.existsSync(absolutePath)) {
      return {
        name,
        absolutePath,
        displayPath: candidate,
        source: `candidate:${candidate}`,
        preferredMissing: index > 0
      };
    }
  }
  return null;
}

function assertRequiredFiles(resolved, oracle) {
  if (!fs.statSync(resolved.absolutePath).isDirectory()) {
    throw new MatrixFailure(`${resolved.displayPath} is not a directory`);
  }
  const missing = oracle.requiredFiles.filter(
    (relative) => !fs.existsSync(path.join(resolved.absolutePath, relative))
  );
  if (missing.length > 0) {
    throw new MatrixFailure(
      `${resolved.displayPath} is missing oracle files: ${missing.join(", ")}`
    );
  }
}

function assertCleanTrackedCheckout(resolved) {
  const status = runGit(resolved.absolutePath, [
    "status",
    "--porcelain",
    "--untracked-files=no"
  ]);
  if (status !== "") {
    throw new MatrixFailure(
      `${resolved.displayPath} has tracked changes; source-oracle evidence must come from an exact read-only commit`
    );
  }
}

function inspectGenesTs(resolved, oracle) {
  assertRequiredFiles(resolved, oracle);
  assertCleanTrackedCheckout(resolved);
  const haxelib = readJson(path.join(resolved.absolutePath, "haxelib.json"));
  const packageJson = readJson(path.join(resolved.absolutePath, "package.json"));
  const haxerc = readJson(path.join(resolved.absolutePath, ".haxerc"));
  const actual = {
    name: haxelib.name,
    version: haxelib.version,
    commit: runGit(resolved.absolutePath, ["rev-parse", "HEAD"]),
    haxeVersion: haxerc.version,
    typescriptSpec: packageJson.devDependencies?.typescript
  };
  for (const [field, expected] of Object.entries(oracle.identity)) {
    if (actual[field] !== expected) {
      throw new MatrixFailure(
        `${resolved.displayPath} genes-ts ${field} is ${actual[field] ?? "<missing>"}, expected ${expected}`
      );
    }
  }
  return actual;
}

function inspectNextUpstream(resolved, oracle) {
  assertRequiredFiles(resolved, oracle);
  assertCleanTrackedCheckout(resolved);
  const packageJson = readJson(
    path.join(resolved.absolutePath, "packages/next/package.json")
  );
  const actual = {
    version: packageJson.version,
    commit: runGit(resolved.absolutePath, ["rev-parse", "HEAD"]),
    nodeEngine: packageJson.engines?.node,
    typescriptVersion: packageJson.devDependencies?.typescript
  };
  for (const [field, expected] of Object.entries(oracle.identity)) {
    if (actual[field] !== expected) {
      throw new MatrixFailure(
        `${resolved.displayPath} Next upstream ${field} is ${actual[field] ?? "<missing>"}, expected ${expected}`
      );
    }
  }
  return actual;
}

function missingDiagnostic(name, oracle) {
  const candidates = oracle.candidates.map((candidate) => `\`${candidate}\``);
  const preferred = candidates[0];
  const alternatives =
    candidates.length > 1 ? `; recognized fallback: ${candidates.slice(1).join(", ")}` : "";
  return `${name} checkout not found. Set ${oracle.environmentVariable} or place a read-only checkout at ${preferred}${alternatives}. Stable-package checks remain available.`;
}

function discover(matrix, { requireGenes, requireUpstream, json }) {
  const diagnostics = [];
  const results = {};
  const definitions = [
    ["genesTs", matrix.sourceOracles.genesTs, requireGenes, inspectGenesTs],
    [
      "nextUpstream",
      matrix.sourceOracles.nextUpstream,
      requireUpstream,
      inspectNextUpstream
    ]
  ];

  for (const [name, oracle, required, inspect] of definitions) {
    const resolved = resolveOracle(name, oracle);
    if (resolved === null) {
      const diagnostic = missingDiagnostic(name, oracle);
      diagnostics.push({ level: required ? "error" : "info", message: diagnostic });
      results[name] = {
        available: false,
        required
      };
      continue;
    }
    if (resolved.preferredMissing) {
      diagnostics.push({
        level: "info",
        message: `${name} preferred checkout ${oracle.candidates[0]} is absent; using recognized fallback ${resolved.displayPath}.`
      });
    }
    const identity = inspect(resolved, oracle);
    results[name] = {
      available: true,
      required,
      path: resolved.displayPath,
      source: resolved.source,
      trackedWorktree: "clean",
      identity
    };
  }

  const output = {
    matrix: "support_matrix.json",
    stablePackageLane: {
      available: true,
      required: true,
      nextVersion: matrix.framework.next.stable.version
    },
    sourceOracles: results,
    diagnostics
  };
  if (json) {
    process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
  } else {
    console.log(
      `[support] stable-package: declared Next.js ${matrix.framework.next.stable.version}`
    );
    for (const [name, result] of Object.entries(results)) {
      if (result.available) {
        console.log(
          `[support] ${name}: matched ${result.path} at ${result.identity.commit}`
        );
      }
    }
    for (const diagnostic of diagnostics) {
      const stream = diagnostic.level === "error" ? console.error : console.log;
      stream(`[support] ${diagnostic.level.toUpperCase()}: ${diagnostic.message}`);
    }
  }

  if (diagnostics.some((diagnostic) => diagnostic.level === "error")) {
    throw new MatrixFailure("one or more required source oracles are unavailable");
  }
}

function parseOptions(args) {
  const options = {
    requireGenes: false,
    requireUpstream: false,
    json: false
  };
  for (const arg of args) {
    if (arg === "--require-genes") {
      options.requireGenes = true;
    } else if (arg === "--require-upstream") {
      options.requireUpstream = true;
    } else if (arg === "--json") {
      options.json = true;
    } else {
      throw new MatrixFailure(`unknown option: ${arg}`);
    }
  }
  return options;
}

function main() {
  const [command = "check", ...args] = process.argv.slice(2);
  if (command === "check") {
    if (args.length > 0) {
      throw new MatrixFailure("check does not accept options");
    }
    const matrix = loadValidatedMatrix();
    console.log(
      `support-matrix: OK: schema v${matrix.schemaVersion}, Next.js ${matrix.framework.next.stable.version}, Node ${matrix.toolchain.node.ciVersions.join("/")}, Haxe ${matrix.toolchain.haxe.version}, genes-ts ${matrix.framework.genesTs.version}`
    );
    return;
  }
  if (command === "docs") {
    if (args.length !== 1 || args[0] !== "--write") {
      throw new MatrixFailure("docs requires --write");
    }
    const matrix = loadValidatedMatrix({ checkDocs: false });
    fs.writeFileSync(DOC_PATH, renderCompatibilityDoc(matrix), "utf8");
    console.log("support-matrix: wrote docs/compatibility.md");
    return;
  }
  if (command === "discover") {
    const options = parseOptions(args);
    const matrix = loadValidatedMatrix();
    discover(matrix, options);
    return;
  }
  throw new MatrixFailure(
    "usage: support-matrix.mjs check | docs --write | discover [--require-genes] [--require-upstream] [--json]"
  );
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`support-matrix: ERROR: ${message}`);
  process.exitCode = 1;
}
