#!/usr/bin/env node

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { generateCssModuleCompanion } from "@genes-ts/tooling/css-modules";
import { transform } from "lightningcss";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const FIXTURE = path.join(ROOT, "tests/fixtures/next-stable");
const SOURCE_RELATIVE = "styles/haxe-page.module.css";
const SOURCE = path.join(FIXTURE, SOURCE_RELATIVE);
const EXPECTED = path.join(FIXTURE, "styles/haxe-page.exports.json");
const GENERATED_CSS = path.join(FIXTURE, "src-gen/app/haxe-page.module.css");
const GENERATED_ROOT = path.join(FIXTURE, ".nextjshx/css-modules");

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

/**
 * Creates the exact Haxe type that describes this fixture's CSS Module.
 *
 * Lightning CSS reports the keys. A reviewed JSON file supplies an independent
 * expected list. Next.js must later expose the same keys and apply the style.
 */
export async function prepareStableCssModule() {
  const [css, expected, lock] = await Promise.all([
    fs.readFile(SOURCE),
    fs.readFile(EXPECTED, "utf8").then(JSON.parse),
    fs.readFile(path.join(ROOT, "package-lock.json"), "utf8").then(JSON.parse),
  ]);
  const processorConfig = {
    cssModules: {
      pattern: "nextjshx_[name]__[local]__[hash]",
    },
  };
  const processed = transform({
    filename: path.basename(SOURCE),
    code: css,
    ...processorConfig,
  });
  const processorKeys = Object.keys(processed.exports ?? {}).sort();
  const expectedKeys = expected.keys.map((entry) => entry.name).sort();
  assert.deepEqual(
    processorKeys,
    expectedKeys,
    "the real CSS Modules processor disagrees with the reviewed export list",
  );

  const lightningCss = lock.packages["node_modules/lightningcss"];
  assert.equal(typeof lightningCss?.version, "string", "package-lock lost lightningcss");
  assert.equal(typeof lightningCss?.integrity, "string", "package-lock lost lightningcss integrity");
  const manifest = {
    protocol: "genes.css-module-exports",
    version: 1,
    namingPolicy: "genes-haxe-css-fields-v1",
    binding: {
      haxeOwner: "app.HaxePage",
      generatedModule: "app/HaxePage",
      request: "./haxe-page.module.css",
      hostModulePath: "src-gen/app/haxe-page.module.css",
      companionType: "app.styles.HaxePageStyles",
    },
    source: {
      entry: SOURCE_RELATIVE,
      inputs: [{ path: SOURCE_RELATIVE, sha256: sha256(css) }],
    },
    producer: {
      providerId: "nextjshx.next-stable.lightningcss",
      providerVersion: "1",
      processorId: "lightningcss",
      processorVersion: lightningCss.version,
      processorIntegrity: lightningCss.integrity,
      configurationSha256: sha256(JSON.stringify(processorConfig)),
    },
    exports: expected.keys.map((entry) => ({
      name: entry.name,
      source: {
        path: SOURCE_RELATIVE,
        line: entry.line,
        column: entry.column,
      },
    })),
  };
  const companion = generateCssModuleCompanion({ projectRoot: FIXTURE, manifest });
  const companionPath = path.join(GENERATED_ROOT, "haxe", companion.relativePath);
  const declarationPath = path.join(FIXTURE, companion.typescriptDeclarationRelativePath);
  const manifestPath = path.join(GENERATED_ROOT, "haxe-page.exports.json");

  await Promise.all([
    fs.mkdir(path.dirname(companionPath), { recursive: true }),
    fs.mkdir(path.dirname(declarationPath), { recursive: true }),
    fs.mkdir(path.dirname(GENERATED_CSS), { recursive: true }),
    fs.mkdir(path.dirname(manifestPath), { recursive: true }),
  ]);
  await Promise.all([
    fs.writeFile(companionPath, companion.content),
    fs.writeFile(declarationPath, companion.typescriptDeclarationContent),
    fs.copyFile(SOURCE, GENERATED_CSS),
    fs.writeFile(manifestPath, `${JSON.stringify(companion.manifest, null, 2)}\n`),
  ]);
  const outputDigests = await Promise.all(
    [companionPath, declarationPath, GENERATED_CSS, manifestPath].map(async (file) => ({
      path: path.relative(FIXTURE, file).split(path.sep).join("/"),
      sha256: sha256(await fs.readFile(file)),
    })),
  );

  return Object.freeze({
    expectedKeys,
    manifestSha256: companion.manifestSha256,
    outputDigests: Object.freeze(outputDigests),
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = await prepareStableCssModule();
  console.log(
    `[next-stable-css-modules] prepared ${result.expectedKeys.length} closed class names (${result.manifestSha256})`,
  );
}
