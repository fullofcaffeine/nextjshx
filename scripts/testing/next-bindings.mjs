#!/usr/bin/env node

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const GENERATOR = path.join(ROOT, "scripts/bindings/sync-next-bindings.mjs");
const TSC = path.join(ROOT, "node_modules/typescript/bin/tsc6");
const IR = path.join(ROOT, "surface/next-binding-ir.json");
const DRIFT_JSON = path.join(ROOT, "surface/next-surface-drift.json");
const DRIFT_MARKDOWN = path.join(ROOT, "surface/next-surface-drift.md");
const OVERRIDES = path.join(ROOT, "config/next-binding-overrides.json");
const IMPLEMENTATIONS = path.join(
  ROOT,
  "config/next-binding-implementations.json",
);
const OVERRIDE_SNAPSHOT = path.join(
  ROOT,
  "tests/snapshots/next-binding-overrides-v1.json",
);
const GENERATED_EXTERN = path.join(ROOT, "src/nextjs/raw/ServerRuntime.hx");
const SUPPORTED_DECLARATION = path.join(
  ROOT,
  "tests/next-binding-pipeline/supported-literal-union.d.ts",
);
const UNSUPPORTED_DECLARATION = path.join(
  ROOT,
  "tests/next-binding-pipeline/unsupported-mapped.d.ts",
);
const EXPECTED_TYPE_CONSTRUCTS = [
  "AnyKeyword",
  "ArrayType",
  "BooleanKeyword",
  "ConditionalType",
  "ExpressionWithTypeArguments",
  "FunctionType",
  "ImportType",
  "IndexedAccessType",
  "IntersectionType",
  "LiteralType",
  "NeverKeyword",
  "NumberKeyword",
  "ParenthesizedType",
  "StringKeyword",
  "TemplateLiteralType",
  "TemplateLiteralTypeSpan",
  "TypeLiteral",
  "TypeOperator",
  "TypeQuery",
  "TypeReference",
  "UndefinedKeyword",
  "UnionType",
  "UnknownKeyword",
  "VoidKeyword",
];

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
  const bytes = typeof value === "string" ? value : JSON.stringify(canonicalValue(value));
  return `sha256:${crypto.createHash("sha256").update(bytes, "utf8").digest("hex")}`;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function runGenerator(args, expectedStatus = 0, extraEnv = {}) {
  const environment = { ...process.env, ...extraEnv };
  for (const [name, value] of Object.entries(environment)) {
    if (value === undefined) {
      delete environment[name];
    }
  }
  const result = spawnSync(process.execPath, [GENERATOR, ...args], {
    cwd: ROOT,
    encoding: "utf8",
    env: environment,
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.error !== undefined) {
    throw result.error;
  }
  assert.equal(
    result.status,
    expectedStatus,
    `next-bindings ${args.join(" ")} exited ${result.status}:\n${result.stdout}${result.stderr}`,
  );
  return result;
}

function runHaxe(build, expectedStatus) {
  const result = spawnSync("haxe", [build], {
    cwd: ROOT,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1" },
  });
  if (result.error !== undefined) {
    throw result.error;
  }
  assert.equal(
    result.status,
    expectedStatus,
    `${build} exited ${result.status}:\n${result.stdout}${result.stderr}`,
  );
  return result;
}

function runTsc(project) {
  const result = spawnSync(TSC, ["--project", project], {
    cwd: ROOT,
    encoding: "utf8",
    env: { ...process.env },
  });
  if (result.error !== undefined) {
    throw result.error;
  }
  assert.equal(
    result.status,
    0,
    `${project} failed strict TypeScript validation:\n${result.stdout}${result.stderr}`,
  );
}

function rehashIr(value) {
  const base = structuredClone(value);
  delete base.irHash;
  value.irHash = sha256(base);
  return value;
}

function assertSelfHash(value, field) {
  const base = structuredClone(value);
  const expected = base[field];
  delete base[field];
  assert.equal(expected, sha256(base), `${field} is not a canonical self-hash`);
}

function driftCandidate(tempRoot, id, baseline, mutate, expectedStatus, expectation) {
  const candidate = structuredClone(baseline);
  mutate(candidate);
  rehashIr(candidate);
  const candidatePath = path.join(tempRoot, `${id}.json`);
  writeJson(candidatePath, candidate);
  const result = runGenerator(
    ["drift", "--candidate", candidatePath, "--format", "json"],
    expectedStatus,
  );
  const report = JSON.parse(result.stdout);
  assertSelfHash(report, "reportHash");
  expectation(report);
  return { candidate, candidatePath, report };
}

const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "nextjshx-next-bindings-"));
try {
  runGenerator(["check"]);

  const firstIr = runGenerator(["render", "--artifact", "ir"]).stdout;
  const secondIr = runGenerator(["render", "--artifact", "ir"]).stdout;
  assert.equal(firstIr, secondIr, "repeated declaration ingestion changed IR bytes");
  assert.equal(firstIr, fs.readFileSync(IR, "utf8"), "checked IR differs from rendered IR");

  const firstExtern = runGenerator(["render", "--artifact", "extern"]).stdout;
  const secondExtern = runGenerator(["render", "--artifact", "extern"]).stdout;
  assert.equal(firstExtern, secondExtern, "repeated Haxe generation changed bytes");
  assert.equal(
    firstExtern,
    fs.readFileSync(GENERATED_EXTERN, "utf8"),
    "checked ServerRuntime extern differs from generated bytes",
  );
  assert.equal(
    runGenerator(["render", "--artifact", "drift-json"]).stdout,
    fs.readFileSync(DRIFT_JSON, "utf8"),
    "checked JSON drift report is stale",
  );
  assert.equal(
    runGenerator(["render", "--artifact", "drift-markdown"]).stdout,
    fs.readFileSync(DRIFT_MARKDOWN, "utf8"),
    "checked Markdown drift report is stale",
  );

  const ir = JSON.parse(firstIr);
  assertSelfHash(ir, "irHash");
  assert.equal(ir.packages.next.name, "next");
  assert.equal(ir.packages.next.version, "16.2.12");
  assert.equal(ir.packages.typescript.name, "@typescript/typescript6");
  assert.equal(ir.packages.typescript.version, "6.0.2");
  assert.equal(ir.exports.length, 68, "reviewed export count drifted");
  assert.equal(
    ir.exports.reduce((total, candidate) => total + candidate.declarations.length, 0),
    78,
    "selected declaration-node count drifted",
  );
  assert.equal(ir.generatedExterns.length, 1, "bootstrap must generate exactly one Haxe extern");
  assert.equal(ir.generatedExterns[0].output, "src/nextjs/raw/ServerRuntime.hx");
  assert.equal(ir.generatedExterns[0].sha256, sha256(firstExtern));
  assert.equal(ir.sources.implementations, "config/next-binding-implementations.json");
  const generationCounts = ir.exports.reduce((counts, candidate) => {
    counts[candidate.generation.status] = (counts[candidate.generation.status] ?? 0) + 1;
    return counts;
  }, {});
  assert.deepEqual(generationCounts, { pending: 2, curated: 65, generated: 1 });
  assert.equal(ir.curatedExterns.length, 15, "B03-B05 must record 15 curated binding groups");
  assert.equal(
    ir.curatedExterns.reduce((count, group) => count + group.outputs.length, 0),
    55,
    "B03-B05 curated output count drifted",
  );
  const fixturesByOwner = new Map([
    ["nxhx-f34.3.3", "tests/next-core-navigation"],
    ["nxhx-f34.3.4", "tests/next-components"],
    ["nxhx-f34.3.5", "tests/next-server"],
  ]);
  for (const group of ir.curatedExterns) {
    assert.match(group.owningBead, /^nxhx-f34\.3\.[345]$/);
    assert.equal(group.fixture, fixturesByOwner.get(group.owningBead));
    for (const output of group.outputs) {
      const bytes = fs.readFileSync(path.join(ROOT, ...output.path.split("/")), "utf8");
      assert.equal(output.sha256, sha256(bytes), `${output.path} digest drifted`);
      assert(!/@:jsRequire\s*\(\s*["']next\/dist/.test(bytes));
      const code = bytes.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
      assert(!/\bDynamic\b/.test(code), `${output.path} introduced unsafe Haxe Dynamic`);
    }
  }
  const b03Exports = ir.exports.filter(
    (candidate) => candidate.generation.owningBead === "nxhx-f34.3.3",
  );
  assert.equal(b03Exports.length, 21);
  assert.equal(
    b03Exports.filter((candidate) => candidate.generation.status === "pending").length,
    0,
    "a B03 export is still represented as pending",
  );
  const b04Exports = ir.exports.filter(
    (candidate) => candidate.generation.owningBead === "nxhx-f34.3.4",
  );
  assert.equal(b04Exports.length, 18);
  assert.equal(
    b04Exports.filter((candidate) => candidate.generation.status !== "curated").length,
    0,
    "a B04 export is not represented as curated",
  );
  const dynamicExport = b04Exports.find(
    (candidate) => candidate.module === "next/dynamic" && candidate.name === "default",
  );
  assert.equal(dynamicExport.haxeTypePath, "nextjs.raw.DynamicComponent");
  assert.equal(dynamicExport.haxeMember, "load");
  for (const font of ["Inter", "Roboto"]) {
    const candidate = b04Exports.find(
      (item) => item.module === "next/font/google" && item.name === font,
    );
    assert.equal(candidate.haxeMember, font.toLowerCase());
  }
  const b05Exports = ir.exports.filter(
    (candidate) => candidate.generation.owningBead === "nxhx-f34.3.5",
  );
  assert.equal(b05Exports.length, 29);
  assert.equal(
    b05Exports.filter(
      (candidate) => candidate.priority === "P0" && candidate.generation.status !== "curated",
    ).length,
    0,
    "a B05 P0 Web/server export is not represented as curated",
  );
  assert.deepEqual(
    b05Exports
      .filter((candidate) => candidate.generation.status === "pending")
      .map((candidate) => `${candidate.module}.${candidate.name}`),
    ["next/og.ImageResponse", "next/web-vitals.useReportWebVitals"],
    "only the two reviewed P2 exports may remain pending after B05",
  );
  for (const webType of ["Request", "Response"]) {
    const candidate = b05Exports.find(
      (item) => item.module === "globalThis" && item.name === webType,
    );
    assert.equal(candidate.haxeTypePath, `nextjs.raw.server.Web${webType}`);
  }
  assert(!firstIr.includes("node_modules"), "IR leaked the install-tree path");
  assert(!firstIr.includes("/Users/"), "IR leaked a machine-local path");
  assert(!firstIr.includes("\\\\"), "IR contains a host-specific path separator");

  const constructs = [
    ...new Set(
      ir.exports.flatMap((candidate) =>
        candidate.declarations.flatMap((declaration) => declaration.typeConstructs),
      ),
    ),
  ].sort(bytewise);
  assert.deepEqual(constructs, EXPECTED_TYPE_CONSTRUCTS, "type-parser coverage drifted");

  const overrides = readJson(OVERRIDES);
  const implementations = readJson(IMPLEMENTATIONS);
  assert.equal(implementations.implementations.length, 15);
  assert.equal(
    implementations.implementations.reduce(
      (count, implementation) => count + implementation.symbols.length,
      0,
    ),
    65,
  );
  const overrideSnapshot = {
    snapshotVersion: 1,
    reviewedSurfaceHash: overrides.reviewedSurfaceHash,
    safetyOverrides: overrides.safetyOverrides,
    generators: overrides.generators,
  };
  assert.deepEqual(
    overrideSnapshot,
    readJson(OVERRIDE_SNAPSHOT),
    "reviewed override snapshot drifted; inspect every exception before updating it",
  );
  assert.equal(overrides.safetyOverrides.length, 8, "the safety exception set must stay small");

  const unsafeExports = ir.exports.filter(
    (candidate) =>
      candidate.safety.anyOccurrences > 0 || candidate.safety.unknownOccurrences > 0,
  );
  assert.equal(unsafeExports.length, 8, "unsafe declaration boundary count drifted");
  for (const candidate of ir.exports) {
    const safety = candidate.safety;
    if (safety.anyOccurrences > 0) {
      assert.equal(safety.appliedOverrides.length, 1);
      assert.equal(safety.appliedOverrides[0].action, "map-any-to-genes-unknown");
      assert.equal(safety.appliedOverrides[0].target, "genes.ts.Unknown");
      assert.equal(safety.appliedOverrides[0].occurrences, safety.anyOccurrences);
    }
    if (safety.unknownOccurrences > 0) {
      assert.equal(safety.appliedOverrides.length, 1);
      assert.equal(safety.appliedOverrides[0].action, "allow-external-unknown");
      assert.equal(safety.appliedOverrides[0].target, "genes.ts.Unknown");
      assert.equal(safety.appliedOverrides[0].occurrences, safety.unknownOccurrences);
    }
  }

  const runtime = ir.exports.find(
    (candidate) => candidate.module === "next/types" && candidate.name === "ServerRuntime",
  );
  assert(runtime !== undefined, "ServerRuntime IR is missing");
  assert.equal(runtime.generation.status, "generated");
  assert.equal(runtime.generation.strategy, "string-literal-union-with-undefined");
  assert.match(runtime.declarations[0].normalizedText, /'nodejs'.*'experimental-edge'.*'edge'.*undefined/);
  assert.match(firstExtern, /typedef ServerRuntime = Undefinable<ServerRuntimeValue>;/);
  assert.match(firstExtern, /final NodeJs = "nodejs";/);
  assert.match(firstExtern, /final ExperimentalEdge = "experimental-edge";/);
  assert.match(firstExtern, /final Edge = "edge";/);
  assert.match(
    firstExtern,
    /@:ts\.type\("\\\"nodejs\\\" \| \\\"experimental-edge\\\" \| \\\"edge\\\" \| undefined"\)/,
  );
  assert(!firstExtern.includes("Dynamic"), "generated extern introduced Dynamic");

  const generatedRoot = path.join(ROOT, "tests/next-binding-pipeline/.tmp");
  fs.rmSync(generatedRoot, { recursive: true, force: true });
  fs.mkdirSync(generatedRoot, { recursive: true });
  runHaxe("tests/next-binding-pipeline/build-generated-typescript.hxml", 0);
  const emittedServerRuntime = fs.readFileSync(
    path.join(generatedRoot, "nextjs/raw/ServerRuntime.ts"),
    "utf8",
  );
  assert.match(
    emittedServerRuntime,
    /export type ServerRuntime = "nodejs" \| "experimental-edge" \| "edge" \| undefined/,
    "genes-ts widened the exact Next ServerRuntime union",
  );
  assert(!emittedServerRuntime.includes("= string | undefined"));
  const emittedConsumer = fs.readFileSync(
    path.join(generatedRoot, "next_binding_pipeline/GeneratedConsumer.ts"),
    "utf8",
  );
  assert.match(
    emittedConsumer,
    /const nodeValue: "nodejs" \| "experimental-edge" \| "edge" = "nodejs";/,
    "genes-ts widened the Haxe enum-abstract value view",
  );
  runTsc("tests/next-binding-pipeline/tsconfig.json");

  runHaxe("tests/next-binding-pipeline/build-generated.hxml", 0);
  const negative = runHaxe("tests/next-binding-pipeline/build-negative.hxml", 1);
  assert.match(
    `${negative.stdout}${negative.stderr}`,
    /String should be nextjs\.raw\.ServerRuntimeValue/,
    "an unreviewed runtime literal did not fail with the expected closed-union error",
  );

  const supported = runGenerator(["probe", "--file", SUPPORTED_DECLARATION]);
  assert.match(supported.stdout, /probe OK/);
  const unsupported = runGenerator(["probe", "--file", UNSUPPORTED_DECLARATION], 1);
  assert.match(unsupported.stderr, /UNSUPPORTED:/);
  assert.match(unsupported.stderr, /MappedType/);
  assert.match(unsupported.stderr, /stopped before emitting Haxe/);

  const badOccurrences = structuredClone(overrides);
  badOccurrences.safetyOverrides[0].expectedOccurrences += 1;
  const badOccurrencesPath = path.join(temporaryRoot, "bad-occurrences.json");
  writeJson(badOccurrencesPath, badOccurrences);
  const occurrenceFailure = runGenerator(
    ["render", "--overrides", badOccurrencesPath],
    1,
  );
  assert.match(occurrenceFailure.stderr, /expected 2 occurrence\(s\), found 1/);

  const staleImplementation = structuredClone(implementations);
  staleImplementation.implementations[0].symbols[0].expectedSignatureHash = sha256(
    "stale implementation signature",
  );
  const staleImplementationPath = path.join(temporaryRoot, "stale-implementation.json");
  writeJson(staleImplementationPath, staleImplementation);
  const staleImplementationFailure = runGenerator(
    ["render", "--implementations", staleImplementationPath],
    1,
  );
  assert.match(staleImplementationFailure.stderr, /curated implementation .* is pinned to/);

  const compatible = driftCandidate(
    temporaryRoot,
    "compatible-move",
    ir,
    (candidate) => {
      const selected = candidate.exports.find((item) =>
        item.declarations.some((declaration) => declaration.internal),
      );
      selected.declarations[0].path = `dist/moved/${path.posix.basename(
        selected.declarations[0].path,
      )}`;
    },
    0,
    (report) => {
      assert.equal(report.decision.status, "compatible");
      assert.equal(report.counts.compatible, 1);
      assert.equal(report.changes[0].code, "NXHX-DRIFT-DECLARATION-MOVED");
    },
  );
  assert.match(compatible.report.changes[0].message, /no runtime import/);

  driftCandidate(
    temporaryRoot,
    "additive-export",
    ir,
    (candidate) => {
      const addition = structuredClone(candidate.exports[0]);
      addition.name = "SyntheticAddition";
      addition.haxeTypePath = "nextjs.raw.SyntheticAddition";
      addition.signatureHash = sha256("synthetic-addition");
      addition.generation = { status: "pending", owningBead: "nxhx-f34.3.3" };
      candidate.exports.push(addition);
    },
    2,
    (report) => {
      assert.equal(report.decision.status, "review-required");
      assert.equal(report.counts.additive, 1);
      assert.equal(report.changes[0].code, "NXHX-DRIFT-EXPORT-ADDED");
    },
  );

  driftCandidate(
    temporaryRoot,
    "curated-source-change",
    ir,
    (candidate) => {
      candidate.curatedExterns[0].outputs[0].sha256 = sha256("changed curated source");
    },
    1,
    (report) => {
      assert.equal(report.decision.status, "blocked");
      assert.equal(report.counts.breaking, 1);
      assert.equal(report.changes[0].code, "NXHX-DRIFT-CURATED-EXTERN-CHANGED");
      assert.equal(report.changes[0].owner, "nxhx-f34.3.3");
      assert.equal(report.changes[0].fixture, "tests/next-surface/fixtures.json#p2-compat-router");
    },
  );

  driftCandidate(
    temporaryRoot,
    "behavioral-docs",
    ir,
    (candidate) => {
      candidate.exports[0].declarations[0].documentationHash = sha256("changed docs");
    },
    2,
    (report) => {
      assert.equal(report.decision.status, "review-required");
      assert.equal(report.counts.behavioralReviewRequired, 1);
      assert.equal(report.changes[0].code, "NXHX-DRIFT-DOCUMENTATION-CHANGED");
    },
  );

  driftCandidate(
    temporaryRoot,
    "breaking-removal",
    ir,
    (candidate) => {
      candidate.exports.shift();
    },
    1,
    (report) => {
      assert.equal(report.decision.status, "blocked");
      assert.equal(report.counts.breaking, 1);
      assert.equal(report.changes[0].code, "NXHX-DRIFT-EXPORT-REMOVED");
      assert.match(report.changes[0].owner, /^nxhx-f34\.3\.[345]$/);
      assert.match(report.changes[0].fixture, /^tests\/next-surface\/fixtures\.json#/);
      assert.match(report.decision.action, /Do not update the baseline/);
    },
  );

  const changedGenerator = structuredClone(overrides);
  changedGenerator.generators[0].values[0].haxe = "NodeRuntime";
  const changedGeneratorPath = path.join(temporaryRoot, "changed-generator.json");
  writeJson(changedGeneratorPath, changedGenerator);
  const baselineCopy = path.join(temporaryRoot, "baseline.json");
  fs.copyFileSync(IR, baselineCopy);
  const unreviewedUpdate = runGenerator(
    [
      "update",
      "--overrides",
      changedGeneratorPath,
      "--ir",
      baselineCopy,
      "--drift-json",
      path.join(temporaryRoot, "drift.json"),
      "--drift-markdown",
      path.join(temporaryRoot, "drift.md"),
    ],
    1,
    // Exercise the transition guard even when this test itself runs in CI.
    // The dedicated ciUpdate control below proves the CI update prohibition.
    { CI: undefined },
  );
  assert.match(unreviewedUpdate.stderr, /Refusing update without acceptedTransitions entry/);
  assert.match(unreviewedUpdate.stderr, /NXHX-DRIFT-GENERATED-EXTERN-CHANGED/);

  const wrongBootstrap = structuredClone(overrides);
  wrongBootstrap.bootstrapReview.initialIrHash = sha256("not-the-reviewed-bootstrap");
  const wrongBootstrapPath = path.join(temporaryRoot, "wrong-bootstrap.json");
  const missingBaselinePath = path.join(temporaryRoot, "missing-baseline.json");
  writeJson(wrongBootstrapPath, wrongBootstrap);
  const bootstrapBypass = runGenerator(
    [
      "update",
      "--overrides",
      wrongBootstrapPath,
      "--ir",
      missingBaselinePath,
      "--drift-json",
      path.join(temporaryRoot, "missing-drift.json"),
      "--drift-markdown",
      path.join(temporaryRoot, "missing-drift.md"),
    ],
    1,
    // Keep this fixture focused on bootstrap review rather than the outer
    // process's CI update prohibition.
    { CI: undefined },
  );
  assert.match(bootstrapBypass.stderr, /exact initial IR hash/);
  assert(!fs.existsSync(missingBaselinePath), "failed bootstrap bypass wrote an IR baseline");

  const ciUpdate = runGenerator(["update"], 1, { CI: "true" });
  assert.match(ciUpdate.stderr, /binding updates are disabled in CI/);

  console.log(
    "[next-bindings-test] OK: 68 exports, 78 declarations, 65 curated B03-B05 symbols, 8 reviewed safety overrides, deterministic generation, fail-closed parsing, and classified drift",
  );
} finally {
  fs.rmSync(temporaryRoot, { recursive: true, force: true });
}
