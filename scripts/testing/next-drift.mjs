#!/usr/bin/env node

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import ts from "typescript";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const COMPATIBILITY = path.join(ROOT, "scripts/bindings/next-compatibility.mjs");
const SURFACE = path.join(ROOT, "scripts/bindings/next-surface.mjs");
const BINDINGS = path.join(ROOT, "scripts/bindings/sync-next-bindings.mjs");
const CONFIG = path.join(ROOT, "config/next-public-entrypoints.json");
const CHECKED_SURFACE = path.join(ROOT, "surface/next-public-surface.json");
const CHECKED_IR = path.join(ROOT, "surface/next-binding-ir.json");
const NEXT_ROOT = path.dirname(fileURLToPath(import.meta.resolve("next/package.json")));

function run(script, args, expectedStatus = 0, environment = {}) {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd: ROOT,
    encoding: "utf8",
    env: { ...process.env, ...environment },
    maxBuffer: 16 * 1024 * 1024,
    timeout: 120_000,
  });
  if (result.error !== undefined) {
    throw result.error;
  }
  assert.equal(
    result.status,
    expectedStatus,
    `${path.basename(script)} ${args.join(" ")} exited ${result.status}:\n${result.stdout}${result.stderr}`,
  );
  return result;
}

function bytewise(left, right) {
  return Buffer.compare(Buffer.from(left), Buffer.from(right));
}

function canonicalValue(value) {
  if (Array.isArray(value)) {
    return value.map(canonicalValue);
  }
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort(bytewise)
        .map((key) => [key, canonicalValue(value[key])]),
    );
  }
  return value;
}

function sha256(value) {
  return `sha256:${crypto
    .createHash("sha256")
    .update(JSON.stringify(canonicalValue(value)), "utf8")
    .digest("hex")}`;
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function parseJsonOutput(result, label) {
  assert.notEqual(
    result.stdout.trim(),
    "",
    `${label} returned no JSON report:\n${result.stderr}`,
  );
  return JSON.parse(result.stdout);
}

function configuredExport(config, moduleName, exportName) {
  const entrypoint = config.entrypoints.find((candidate) => candidate.module === moduleName);
  assert(entrypoint !== undefined, `missing configured module ${moduleName}`);
  const selected = entrypoint.exports.find((candidate) => candidate.name === exportName);
  assert(selected !== undefined, `missing configured export ${moduleName}.${exportName}`);
  return selected;
}

function candidateReport(tempRoot, id, mutateConfig, expectedStatus) {
  const config = JSON.parse(fs.readFileSync(CONFIG, "utf8"));
  mutateConfig(config);
  const configPath = path.join(tempRoot, `${id}-config.json`);
  const surfacePath = path.join(tempRoot, `${id}-surface.json`);
  writeJson(configPath, config);
  const surface = run(SURFACE, [
    "candidate",
    "--config",
    configPath,
    "--next-package-root",
    NEXT_ROOT,
  ]).stdout;
  fs.writeFileSync(surfacePath, surface, "utf8");
  const result = run(
    BINDINGS,
    [
      "candidate",
      "--surface",
      surfacePath,
      "--next-package-root",
      NEXT_ROOT,
      "--format",
      "json",
    ],
    expectedStatus,
  );
  return parseJsonOutput(result, `${id} candidate`);
}

function unsupportedCandidateReport(tempRoot) {
  const packageRoot = path.join(tempRoot, "unsupported-next");
  fs.mkdirSync(packageRoot, { recursive: true });
  writeJson(path.join(packageRoot, "package.json"), { name: "next", version: "16.2.12" });
  const declarationText = 'export type ServerRuntime = { [K in "nodejs"]: string };\n';
  const declarationPath = path.join(packageRoot, "unsupported.d.ts");
  fs.writeFileSync(declarationPath, declarationText, "utf8");
  const source = ts.createSourceFile(
    declarationPath,
    declarationText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const node = source.statements[0];
  const normalized = ts
    .createPrinter({ newLine: ts.NewLineKind.LineFeed, removeComments: true })
    .printNode(ts.EmitHint.Unspecified, node, source)
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+$/gm, "")
    .trim();
  const declarationHash = sha256({
    syntaxKind: "TypeAliasDeclaration",
    declaredName: "ServerRuntime",
    text: normalized,
  });

  const surface = JSON.parse(fs.readFileSync(CHECKED_SURFACE, "utf8"));
  for (const entrypoint of surface.publicEntrypoints) {
    if (entrypoint.module !== "next/types") {
      entrypoint.exports = [];
      continue;
    }
    const selected = entrypoint.exports.find((candidate) => candidate.name === "ServerRuntime");
    assert(selected !== undefined, "missing ServerRuntime candidate fixture");
    selected.signatureHash = sha256({
      name: selected.name,
      kind: selected.kind,
      declarations: [declarationHash],
    });
    selected.declarations = [
      {
        package: "next",
        path: "unsupported.d.ts",
        syntaxKind: "TypeAliasDeclaration",
        declaredName: "ServerRuntime",
        declarationHash,
        internal: false,
      },
    ];
    entrypoint.exports = [selected];
  }
  surface.internalSupportingDeclarations = [];
  const withoutHash = { ...surface };
  delete withoutHash.surfaceHash;
  surface.surfaceHash = sha256(withoutHash);
  const surfacePath = path.join(tempRoot, "unsupported-surface.json");
  writeJson(surfacePath, surface);
  const result = run(
    BINDINGS,
    [
      "candidate",
      "--surface",
      surfacePath,
      "--next-package-root",
      packageRoot,
      "--format",
      "json",
    ],
    1,
  );
  return parseJsonOutput(result, "unsupported-construct candidate");
}

const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "nextjshx-next-drift-"));
try {
  const firstOutput = path.join(temporaryRoot, "stable-first");
  const secondOutput = path.join(temporaryRoot, "stable-second");
  run(COMPATIBILITY, ["stable", "--output-dir", firstOutput]);
  run(COMPATIBILITY, ["stable", "--output-dir", secondOutput]);
  for (const suffix of ["-surface.json", ".json", ".md"]) {
    const first = fs.readFileSync(path.join(firstOutput, `next-stable-drift${suffix}`), "utf8");
    const second = fs.readFileSync(path.join(secondOutput, `next-stable-drift${suffix}`), "utf8");
    assert.equal(first, second, `stable ${suffix} report changed across identical runs`);
  }
  assert.equal(
    fs.readFileSync(path.join(firstOutput, "next-stable-drift-surface.json"), "utf8"),
    fs.readFileSync(CHECKED_SURFACE, "utf8"),
    "explicit stable package projection differs from the checked surface",
  );
  const stableReport = JSON.parse(
    fs.readFileSync(path.join(firstOutput, "next-stable-drift.json"), "utf8"),
  );
  assert.equal(stableReport.decision.status, "clean");
  assert.equal(stableReport.decision.exitCode, 0);
  assert.deepEqual(stableReport.changes, []);
  assert.equal(stableReport.baseline.irHash, stableReport.candidate.irHash);

  const unbuiltPackageRoot = path.join(temporaryRoot, "unbuilt-next");
  fs.mkdirSync(unbuiltPackageRoot, { recursive: true });
  writeJson(path.join(unbuiltPackageRoot, "package.json"), {
    name: "next",
    version: "16.3.0-canary.87",
  });
  const unbuiltResult = run(
    COMPATIBILITY,
    ["upstream", "--output-dir", path.join(temporaryRoot, "unbuilt-report")],
    1,
    { NEXTJSHX_NEXT_PACKAGE_DIR: unbuiltPackageRoot },
  );
  assert.match(unbuiltResult.stderr, /has no built dist declarations/);
  assert.match(unbuiltResult.stderr, /NEXTJSHX_NEXT_PACKAGE_DIR/);

  const missingReport = candidateReport(
    temporaryRoot,
    "missing-export",
    (config) => {
      configuredExport(config, "next/og", "ImageResponse").name = "MissingImageResponse";
    },
    1,
  );
  const removed = missingReport.changes.find(
    (change) =>
      change.code === "NXHX-DRIFT-EXPORT-REMOVED" &&
      change.module === "next/og" &&
      change.export === "ImageResponse",
  );
  assert.deepEqual(
    { owner: removed?.owner, fixture: removed?.fixture },
    {
      owner: "nxhx-f34.3.5",
      fixture: "tests/next-surface/fixtures.json#p2-og",
    },
    "removed-export report lost its owning binding or fixture",
  );

  const kindReport = candidateReport(
    temporaryRoot,
    "kind-drift",
    (config) => {
      configuredExport(config, "next/image", "default").kind = "type";
    },
    1,
  );
  const changedKind = kindReport.changes.find(
    (change) =>
      change.code === "NXHX-DRIFT-SIGNATURE-CHANGED" &&
      change.module === "next/image" &&
      change.export === "default",
  );
  assert.deepEqual(
    { owner: changedKind?.owner, fixture: changedKind?.fixture },
    {
      owner: "nxhx-f34.3.4",
      fixture: "tests/next-surface/fixtures.json#p0-components",
    },
    "kind-drift report lost its owning binding or fixture",
  );

  const unsupportedReport = unsupportedCandidateReport(temporaryRoot);
  const unsupported = unsupportedReport.changes.find(
    (change) =>
      change.code === "NXHX-DRIFT-UNSUPPORTED-CONSTRUCT" &&
      change.module === "next/types" &&
      change.export === "ServerRuntime",
  );
  assert.deepEqual(
    {
      classification: unsupported?.classification,
      owner: unsupported?.owner,
      fixture: unsupported?.fixture,
    },
    {
      classification: "unsupported-construct",
      owner: "nxhx-f34.3.3",
      fixture: "tests/next-surface/fixtures.json#p0-core-types",
    },
    "unsupported candidate construct did not produce an actionable classified report",
  );

  const movedIr = JSON.parse(fs.readFileSync(CHECKED_IR, "utf8"));
  const movedExport = movedIr.exports.find(
    (candidate) => candidate.module === "next/navigation" && candidate.name === "redirect",
  );
  assert(movedExport !== undefined, "missing navigation redirect baseline");
  movedExport.declarations[0].path = "dist/compatible-internal-move/redirect.d.ts";
  const withoutHash = { ...movedIr };
  delete withoutHash.irHash;
  movedIr.irHash = sha256(withoutHash);
  const movedPath = path.join(temporaryRoot, "internal-move-ir.json");
  writeJson(movedPath, movedIr);
  const moveResult = run(
    BINDINGS,
    ["drift", "--candidate", movedPath, "--format", "json"],
    0,
  );
  const moveReport = JSON.parse(moveResult.stdout);
  assert.equal(moveReport.decision.status, "compatible");
  assert.equal(moveReport.counts.compatible, 1);
  assert.equal(moveReport.counts.breaking, 0);
  assert.deepEqual(
    moveReport.changes.map((change) => [change.code, change.owner, change.fixture]),
    [
      [
        "NXHX-DRIFT-DECLARATION-MOVED",
        "nxhx-f34.3.3",
        "tests/next-surface/fixtures.json#p0-navigation",
      ],
    ],
    "equivalent internal declaration move was not classified compatibly",
  );

  run(SURFACE, ["candidate"], 1);
  run(BINDINGS, ["candidate"], 1);
  console.log(
    "[next-drift] OK: blocking stable report, deterministic package projection, actionable unbuilt-checkout diagnostics, classified removal/kind/unsupported drift, owner/fixture routing, and compatible internal moves",
  );
} finally {
  fs.rmSync(temporaryRoot, { recursive: true, force: true });
}
