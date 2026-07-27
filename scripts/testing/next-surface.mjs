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
const GENERATOR = path.join(ROOT, "scripts/bindings/next-surface.mjs");
const CONFIG = path.join(ROOT, "config/next-public-entrypoints.json");
const MANIFEST = path.join(ROOT, "surface/next-public-surface.json");
const EXPECTED_MODULES = {
  P0: [
    "globalThis",
    "next",
    "next/cache",
    "next/form",
    "next/headers",
    "next/image",
    "next/link",
    "next/navigation",
    "next/server",
    "next/types",
  ],
  P1: ["next/dynamic", "next/font/google", "next/font/local", "next/script"],
  P2: ["next/compat/router", "next/og", "next/web-vitals"],
};

function run(args, expectedStatus = 0) {
  const result = spawnSync(process.execPath, [GENERATOR, ...args], {
    cwd: ROOT,
    encoding: "utf8",
    env: { ...process.env },
    maxBuffer: 4 * 1024 * 1024,
  });
  if (result.error !== undefined) {
    throw result.error;
  }
  assert.equal(
    result.status,
    expectedStatus,
    `next-surface ${args.join(" ")} exited ${result.status}:\n${result.stdout}${result.stderr}`,
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

function entrypoint(value, module) {
  const match = value.entrypoints.find((candidate) => candidate.module === module);
  assert(match !== undefined, `missing ${module}`);
  return match;
}

function manifestEntrypoint(value, module) {
  const match = value.publicEntrypoints.find((candidate) => candidate.module === module);
  assert(match !== undefined, `manifest missing ${module}`);
  return match;
}

function expectFailure(tempRoot, id, mutate, expected) {
  const config = JSON.parse(fs.readFileSync(CONFIG, "utf8"));
  mutate(config);
  const configPath = path.join(tempRoot, `${id}.json`);
  writeJson(configPath, config);
  const result = run(["render", "--config", configPath], 1);
  assert.match(result.stderr, expected, `${id} did not fail for the expected reason`);
}

const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "nextjshx-next-surface-"));
try {
  const config = JSON.parse(fs.readFileSync(CONFIG, "utf8"));
  const checkedBytes = fs.readFileSync(MANIFEST, "utf8");
  const firstRender = run(["render"]).stdout;
  const secondRender = run(["render"]).stdout;
  assert.equal(firstRender, secondRender, "repeated surface generation changed bytes");
  assert.equal(firstRender, checkedBytes, "checked manifest is not the exact generated output");

  const reordered = structuredClone(config);
  reordered.entrypoints.reverse();
  for (const candidate of reordered.entrypoints) {
    candidate.exports.reverse();
  }
  reordered.excludedEntrypoints.reverse();
  const reorderedPath = path.join(temporaryRoot, "reordered.json");
  writeJson(reorderedPath, reordered);
  assert.equal(
    run(["render", "--config", reorderedPath]).stdout,
    checkedBytes,
    "normalized output depends on allowlist array order",
  );

  const manifest = JSON.parse(checkedBytes);
  const withoutSurfaceHash = { ...manifest };
  delete withoutSurfaceHash.surfaceHash;
  assert.equal(manifest.surfaceHash, sha256(withoutSurfaceHash), "surfaceHash is not canonical");
  assert.equal(manifest.publicEntrypoints.length, 17, "PRD entrypoint count drifted");
  assert.equal(
    manifest.publicEntrypoints.reduce((total, candidate) => total + candidate.exports.length, 0),
    68,
    "reviewed export count drifted",
  );
  for (const [priority, modules] of Object.entries(EXPECTED_MODULES)) {
    assert.deepEqual(
      manifest.publicEntrypoints
        .filter((candidate) => candidate.priority === priority)
        .map((candidate) => candidate.module),
      modules,
      `${priority} classification drifted from PRD 10.1`,
    );
  }

  assert(!checkedBytes.includes("node_modules"), "manifest leaked an install-tree path");
  assert(!checkedBytes.includes("\\\\"), "manifest contains a host-specific path separator");
  for (const configuredEntrypoint of config.entrypoints) {
    const generatedEntrypoint = manifestEntrypoint(manifest, configuredEntrypoint.module);
    for (const configuredExport of configuredEntrypoint.exports) {
      const generatedExport = generatedEntrypoint.exports.find(
        (candidate) => candidate.name === configuredExport.name,
      );
      assert(generatedExport !== undefined, `${configuredEntrypoint.module} lost ${configuredExport.name}`);
      assert.equal(
        generatedExport.signatureHash,
        configuredExport.signatureHash,
        `${configuredEntrypoint.module}.${configuredExport.name} hash disagrees with the allowlist`,
      );
      assert.match(generatedExport.signatureHash, /^sha256:[0-9a-f]{64}$/);
      assert(generatedExport.declarations.length > 0, "public export has no declaration origin");
    }
  }

  assert(manifest.internalSupportingDeclarations.length > 0, "internal origins were not separated");
  for (const declaration of manifest.internalSupportingDeclarations) {
    assert.equal(declaration.package, "next");
    assert.match(declaration.path, /^dist\/.+\.d\.(?:ts|mts|cts)$/);
    assert.equal(declaration.compatibilityPromise, false);
    assert.equal(declaration.runtimeImportAllowed, false);
    assert(declaration.supports.length > 0);
  }
  for (const generatedEntrypoint of manifest.publicEntrypoints) {
    for (const generatedExport of generatedEntrypoint.exports) {
      for (const declaration of generatedExport.declarations.filter((candidate) => candidate.internal)) {
        assert(
          manifest.internalSupportingDeclarations.some(
            (candidate) =>
              candidate.path === declaration.path &&
              candidate.syntaxKind === declaration.syntaxKind &&
              candidate.declaredName === declaration.declaredName &&
              candidate.declarationHash === declaration.declarationHash &&
              candidate.supports.some(
                (reference) =>
                  reference.module === generatedEntrypoint.module &&
                  reference.export === generatedExport.name,
              ),
          ),
          `${generatedEntrypoint.module}.${generatedExport.name} internal origin was not indexed`,
        );
      }
    }
  }

  const webRequest = manifestEntrypoint(manifest, "globalThis").exports.find(
    (candidate) => candidate.name === "Request",
  );
  assert.deepEqual(
    webRequest.declarations.map((declaration) => [
      declaration.package,
      declaration.path,
      declaration.syntaxKind,
      declaration.internal,
    ]),
    [
      ["@typescript/typescript6", "lib/lib.dom.d.ts", "InterfaceDeclaration", false],
      ["@typescript/typescript6", "lib/lib.dom.d.ts", "VariableDeclaration", false],
    ],
    "Request must remain the pinned DOM contract rather than a Node augmentation",
  );
  const cacheLife = manifestEntrypoint(manifest, "next/cache").exports.find(
    (candidate) => candidate.name === "cacheLife",
  );
  assert(cacheLife.declarations.every((declaration) => declaration.path === "cache.d.ts"));
  assert(cacheLife.declarations.every((declaration) => declaration.internal === false));

  expectFailure(
    temporaryRoot,
    "missing-export",
    (value) => {
      const selected = entrypoint(value, "next/link").exports[0];
      selected.name = "DefinitelyMissing";
    },
    /next\/link does not export DefinitelyMissing/,
  );
  expectFailure(
    temporaryRoot,
    "wrong-kind",
    (value) => {
      const selected = entrypoint(value, "next/link").exports.find(
        (candidate) => candidate.name === "LinkProps",
      );
      selected.kind = "function";
    },
    /next\/link\.LinkProps is configured as function but resolves as InterfaceDeclaration/,
  );
  expectFailure(
    temporaryRoot,
    "wrong-version",
    (value) => {
      value.packages.next.version = "16.2.9";
    },
    /allowlist requires next@16\.2\.9/,
  );
  expectFailure(
    temporaryRoot,
    "signature-drift",
    (value) => {
      entrypoint(value, "next").exports[0].signatureHash =
        "sha256:0000000000000000000000000000000000000000000000000000000000000000";
    },
    /signature drifted: expected sha256:0{64}, found sha256:[0-9a-f]{64}/,
  );
  expectFailure(
    temporaryRoot,
    "unknown-fixture",
    (value) => {
      entrypoint(value, "next/form").fixture =
        "tests/next-surface/fixtures.json#missing-fixture";
    },
    /next\/form references unknown fixture missing-fixture/,
  );

  run(["check"]);
  console.log(
    `[next-surface-test] OK: 17 entrypoints, 68 exports, ${manifest.internalSupportingDeclarations.length} separated internal origins, deterministic and fail-closed`,
  );
} catch (error) {
  console.error(`[next-surface-test] ERROR: ${error.message}`);
  process.exitCode = 1;
} finally {
  fs.rmSync(temporaryRoot, { recursive: true, force: true });
}
