#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

import Ajv2020 from "ajv/dist/2020.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const FIXTURE_ROOT = path.join(ROOT, "tests/metadata-segment");
const OUTPUT_ROOT = path.join(FIXTURE_ROOT, ".tmp");
const PLAN_PATH = path.join(OUTPUT_ROOT, "plan.json");
const TYPESCRIPT_PLAN_PATH = path.join(OUTPUT_ROOT, "typescript-plan.json");
const REJECTED_PATH = path.join(OUTPUT_ROOT, "rejected.json");
const APPLICATION_PATH = path.join(OUTPUT_ROOT, "application.js");
const SNAPSHOT_PATH = path.join(ROOT, "tests/snapshots/metadata-segment-plan-v1.json");
const SCHEMA_PATH = path.join(ROOT, "schemas/adapter-plan.schema.json");
const TYPESCRIPT_ROOT = path.join(OUTPUT_ROOT, "typescript");
const ADAPTER_ROOT = path.join(OUTPUT_ROOT, "app");
const CLI_INDEX = path.join(ROOT, "tools/cli/.tmp/src/index.js");
const TSC_BIN = path.join(ROOT, "node_modules/typescript/bin/tsc6");
const ANSI_ESCAPE = /\x1b\[[0-?]*[ -/]*[@-~]/g;
const CHARACTER_DIAGNOSTIC =
  /^(.*):(\d+): characters (\d+)-(\d+) : \[([A-Z0-9-]+)\] (.+)$/;
const LINE_DIAGNOSTIC = /^(.*):(\d+): lines (\d+)-(\d+) : \[([A-Z0-9-]+)\] (.+)$/;

const NEGATIVE_CASES = [
  {
    id: "static-type",
    file: "tests/metadata-segment/src/metadata_segment/negative/WrongStaticMetadata.hx",
    line: 10,
    range: { kind: "characters", start: 2, end: 60 },
    code: "NXHX-PAGE-LAYOUT-METADATA-0008",
    message:
      "metadata_segment.negative.WrongStaticMetadata.metadata must use nextjs.raw.metadata.Metadata so Next remains the metadata type oracle; found String.",
  },
  {
    id: "metadata-conflict",
    file: "tests/metadata-segment/src/metadata_segment/negative/ConflictingMetadata.hx",
    line: 14,
    range: { kind: "lines", start: 14, end: 16 },
    code: "NXHX-PAGE-LAYOUT-METADATA-0008",
    message:
      "metadata_segment.negative.ConflictingMetadata cannot export both metadata and generateMetadata; Next.js requires exactly one metadata source.",
  },
  {
    id: "metadata-props",
    file: "tests/metadata-segment/src/metadata_segment/negative/WrongMetadataProps.hx",
    line: 19,
    range: { kind: "lines", start: 19, end: 21 },
    code: "NXHX-PAGE-LAYOUT-METADATA-0008",
    message:
      "Page generateMetadata props must be nextjs.app.MetadataProps<Params> or PageMetadataProps<Params, SearchParams> so params remain Promise-shaped and layout-only values stay honest; found metadata_segment.negative.MetadataPropsLookalike.",
  },
  {
    id: "metadata-parent",
    file: "tests/metadata-segment/src/metadata_segment/negative/WrongMetadataParent.hx",
    line: 13,
    range: { kind: "lines", start: 13, end: 15 },
    code: "NXHX-PAGE-LAYOUT-METADATA-0008",
    message:
      "generateMetadata parent must be nextjs.raw.metadata.ResolvingMetadata; found js.lib.Promise<nextjs.raw.metadata.Metadata>.",
  },
  {
    id: "static-params",
    file: "tests/metadata-segment/src/metadata_segment/negative/WrongStaticParams.hx",
    line: 17,
    range: { kind: "lines", start: 17, end: 19 },
    code: "NXHX-ROUTE-PARAM-MISSING-0001",
    message:
      'Params for route "negative/params/[id]" are missing required field "id" for segment 3.',
  },
  {
    id: "static-route-params",
    file: "tests/metadata-segment/src/metadata_segment/negative/StaticRouteParams.hx",
    line: 10,
    range: { kind: "lines", start: 10, end: 12 },
    code: "NXHX-PAGE-LAYOUT-STATIC-PARAMS-0009",
    message:
      'metadata_segment.negative.StaticRouteParams.generateStaticParams requires at least one dynamic route segment; route "/negative/static-route" has none.',
  },
  {
    id: "runtime",
    file: "tests/metadata-segment/src/metadata_segment/negative/ExperimentalRuntime.hx",
    line: 11,
    range: { kind: "characters", start: 63, end: 82 },
    code: "NXHX-SEGMENT-CONFIG-0001",
    message:
      'segment.runtime "experimental-edge" is not stable in Next 16.2.12; use "nodejs" or "edge".',
  },
  {
    id: "revalidate",
    file: "tests/metadata-segment/src/metadata_segment/negative/TrueRevalidate.hx",
    line: 11,
    range: { kind: "characters", start: 66, end: 70 },
    code: "NXHX-SEGMENT-CONFIG-0001",
    message:
      "segment.revalidate accepts false or a non-negative integer number of seconds; true has no Next.js meaning.",
  },
  {
    id: "max-duration",
    file: "tests/metadata-segment/src/metadata_segment/negative/ZeroMaxDuration.hx",
    line: 11,
    range: { kind: "characters", start: 67, end: 68 },
    code: "NXHX-SEGMENT-CONFIG-0001",
    message: "segment.maxDuration must be a positive integer number of seconds.",
  },
  {
    id: "region",
    file: "tests/metadata-segment/src/metadata_segment/negative/EmptyRegions.hx",
    line: 11,
    range: { kind: "characters", start: 71, end: 73 },
    code: "NXHX-SEGMENT-CONFIG-0001",
    message: "segment.preferredRegion must not be an empty array.",
  },
  {
    id: "unknown-config",
    file: "tests/metadata-segment/src/metadata_segment/negative/UnknownConfig.hx",
    line: 11,
    range: { kind: "characters", start: 74, end: 78 },
    code: "NXHX-SEGMENT-CONFIG-0001",
    message:
      'Unsupported segment config field "experimentalOption"; supported stable Next 16.2.12 fields are runtime, preferredRegion, dynamicParams, revalidate, maxDuration.',
  },
  {
    id: "runtime-config",
    file: "tests/metadata-segment/src/metadata_segment/negative/RuntimeConfigExpression.hx",
    line: 15,
    range: { kind: "characters", start: 66, end: 75 },
    code: "NXHX-SEGMENT-CONFIG-0001",
    message: "segment.revalidate must be a compile-time decimal integer literal.",
  },
  {
    id: "lookalike-config",
    file:
      "tests/metadata-segment/src/metadata_segment/negative/LookalikeSegmentConfig.hx",
    line: 10,
    range: { kind: "characters", start: 32, end: 82 },
    code: "NXHX-SEGMENT-CONFIG-0001",
    message:
      "metadata_segment.negative.LookalikeSegmentConfig.segment must be initialized directly with SegmentConfig.create({...}); expressions and runtime builders are not evaluated.",
  },
  {
    id: "lookalike-runtime",
    file:
      "tests/metadata-segment/src/metadata_segment/negative/LookalikeSegmentRuntime.hx",
    line: 11,
    range: { kind: "characters", start: 63, end: 96 },
    code: "NXHX-SEGMENT-CONFIG-0001",
    message:
      'segment.runtime must be SegmentRuntime.NodeJs, SegmentRuntime.Edge, "nodejs", or "edge".',
  },
];

function portable(value) {
  return value.split(path.sep).join("/");
}

function repositoryRelative(file) {
  const absolute = path.isAbsolute(file) ? path.normalize(file) : path.resolve(ROOT, file);
  const relative = path.relative(ROOT, absolute);
  assert(
    relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative),
    `diagnostic path escapes the repository: ${file}`,
  );
  return portable(relative);
}

function runHaxe(build, expectedStatus, extraArgs = []) {
  const result = spawnSync("haxe", [build, ...extraArgs], {
    cwd: ROOT,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1" },
  });
  if (result.error !== undefined) {
    throw result.error;
  }
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  assert.equal(result.status, expectedStatus, `${build} exited ${result.status}:\n${output}`);
  return output;
}

function run(command, args, expectedStatus = 0) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    encoding: "utf8",
    env: { ...process.env, CI: "1", NO_COLOR: "1" },
  });
  if (result.error !== undefined) {
    throw result.error;
  }
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  assert.equal(
    result.status,
    expectedStatus,
    `${path.basename(command)} exited ${result.status}; expected ${expectedStatus}:\n${output}`,
  );
  return output;
}

function parseDiagnostic(output, fixtureId) {
  const normalized = output.replace(ANSI_ESCAPE, "").replaceAll("\\", "/");
  const customLines = normalized
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.includes("[NXHX-"));
  assert.equal(
    customLines.length,
    1,
    `${fixtureId} must emit exactly one NextJsHx diagnostic:\n${normalized}`,
  );
  const characters = CHARACTER_DIAGNOSTIC.exec(customLines[0]);
  if (characters !== null) {
    return {
      file: repositoryRelative(characters[1]),
      line: Number(characters[2]),
      range: {
        kind: "characters",
        start: Number(characters[3]),
        end: Number(characters[4]),
      },
      code: characters[5],
      message: characters[6],
    };
  }
  const lines = LINE_DIAGNOSTIC.exec(customLines[0]);
  assert(lines !== null, `${fixtureId} emitted an unparseable diagnostic:\n${customLines[0]}`);
  return {
    file: repositoryRelative(lines[1]),
    line: Number(lines[2]),
    range: { kind: "lines", start: Number(lines[3]), end: Number(lines[4]) },
    code: lines[5],
    message: lines[6],
  };
}

function validatePlan() {
  const encoded = fs.readFileSync(PLAN_PATH, "utf8");
  const plan = JSON.parse(encoded);
  const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, "utf8"));
  const validate = new Ajv2020({ allErrors: true, strict: true }).compile(schema);
  assert(validate(plan), `Metadata/segment plan violates schema v1:\n${JSON.stringify(validate.errors, null, 2)}`);
  assert.equal(
    encoded,
    fs.readFileSync(SNAPSHOT_PATH, "utf8"),
    "Metadata/segment adapter-plan bytes drifted from the reviewed snapshot",
  );
  assert.deepEqual(
    plan.intents.map((intent) => [intent.kind, intent.targetPath]),
    [
      ["layout", "proof/catalog/[category]/layout.tsx"],
      ["page", "proof/products/[slug]/page.tsx"],
      ["page", "proof/static-metadata/page.tsx"],
    ],
  );
  assert.deepEqual(
    plan.intents.map((intent) => intent.exports.map((entry) => entry.name)),
    [
      ["default", "generateMetadata", "generateStaticParams"],
      ["default", "generateMetadata", "generateStaticParams"],
      ["default", "metadata"],
    ],
  );
  assert.deepEqual(
    plan.intents.map((intent) => intent.config.map((entry) => entry.name)),
    [
      ["dynamicParams", "preferredRegion", "runtime"],
      ["dynamicParams", "maxDuration", "preferredRegion", "revalidate"],
      ["maxDuration", "preferredRegion", "revalidate", "runtime"],
    ],
  );
  assert(!/\b(?:any|unknown)\b/.test(encoded), "Metadata/segment plan contains a broad type");
  assert(!encoded.includes("SegmentConfig"), "Compile-time SegmentConfig leaked into the adapter plan");
  assert(!encoded.includes("-BUSINESS"), "Metadata/page business logic leaked into the adapter plan");
  assert(!encoded.includes(portable(ROOT)), "Metadata/segment plan leaked the compiler host path");
  assert.equal(fs.existsSync(APPLICATION_PATH), false, "--no-output emitted application JavaScript");
}

function generated(relative) {
  const file = path.join(TYPESCRIPT_ROOT, relative);
  assert(fs.statSync(file).isFile(), `${relative} must be emitted by genes-ts`);
  return fs.readFileSync(file, "utf8");
}

async function renderAndValidateTypescript() {
  const staticPage = generated("metadata_segment/positive/StaticMetadataPage.tsx");
  const generatedPage = generated("metadata_segment/positive/GeneratedMetadataPage.tsx");
  const generatedLayout = generated("metadata_segment/positive/GeneratedMetadataLayout.tsx");
  const metadataProps = generated("nextjs/app/MetadataProps.tsx");
  const pageMetadataProps = generated("nextjs/app/PageMetadataProps.tsx");

  assert(staticPage.includes("declare static metadata: import('next').Metadata"));
  assert(generatedPage.includes("static generateMetadata("));
  assert(generatedPage.includes("static generateStaticParams(): globalThis.Promise<ProductParams[]>"));
  assert(generatedLayout.includes("static generateStaticParams(): CatalogParams[]"));
  assert(metadataProps.includes("params: globalThis.Promise<Params>"));
  assert(!metadataProps.includes("searchParams"));
  assert(pageMetadataProps.includes("searchParams: globalThis.Promise<Query>"));
  for (const source of [staticPage, generatedPage, generatedLayout]) {
    assert(!source.includes("SegmentConfig"), "SegmentConfig runtime builder leaked into genes-ts output");
    assert(!/static segment\b/.test(source), "compile-time segment field leaked into genes-ts output");
    assert(!/\b(?:any|unknown)\b/.test(source), "generated metadata API contains a broad type");
    assert(!source.includes(portable(ROOT)), "generated metadata source leaked the compiler host path");
  }

  run(process.execPath, ["tools/cli/scripts/ensure-build.mjs", "runtime"]);
  const cli = await import(`${pathToFileURL(CLI_INDEX).href}?metadata-segment=${Date.now()}`);
  const plan = cli.parseAdapterPlan(JSON.parse(fs.readFileSync(TYPESCRIPT_PLAN_PATH, "utf8")));
  const outputs = cli.renderAdapterPlan("tests/metadata-segment/.tmp/app", plan);
  for (const output of outputs) {
    const destination = path.join(ROOT, output.path);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, output.content, "utf8");
  }

  const adapters = outputs.map((output) => output.content);
  assert(adapters.some((source) => source.includes("export const metadata: Metadata")));
  assert(adapters.some((source) => source.includes("export const generateMetadata:")));
  assert(adapters.some((source) => source.includes("export const generateStaticParams:")));
  assert(adapters.some((source) => source.includes('export const runtime = "nodejs";')));
  assert(adapters.some((source) => source.includes('export const preferredRegion = ["iad1","sfo1"];')));
  assert(adapters.some((source) => source.includes("export const revalidate = 60;")));
  for (const source of adapters) {
    assert(!source.includes(" as const"), "Next segment literal was obscured by an assertion");
    assert(!source.includes("SegmentConfig"), "runtime segment builder leaked into an adapter");
    assert(!/\b(?:any|unknown)\b/.test(source), "metadata adapter contains a broad type");
  }

  run(process.execPath, [
    TSC_BIN,
    "--project",
    "tests/metadata-segment/tsconfig.json",
    "--pretty",
    "false",
    "--noEmit",
  ]);
}

try {
  const version = runHaxe("--version", 0).trim();
  assert.equal(version, "4.3.7", `expected Haxe 4.3.7, found ${version}`);
  fs.rmSync(OUTPUT_ROOT, { recursive: true, force: true });
  fs.mkdirSync(OUTPUT_ROOT, { recursive: true });

  runHaxe("tests/metadata-segment/build-positive.hxml", 0);
  validatePlan();
  runHaxe("tests/metadata-segment/build-typescript.hxml", 0);
  await renderAndValidateTypescript();

  for (const fixture of NEGATIVE_CASES) {
    fs.rmSync(REJECTED_PATH, { force: true });
    const output = runHaxe(
      "tests/metadata-segment/build-negative.hxml",
      1,
      ["-D", `metadata_segment_case=${fixture.id}`],
    );
    assert.deepEqual(parseDiagnostic(output, fixture.id), {
      file: fixture.file,
      line: fixture.line,
      range: fixture.range,
      code: fixture.code,
      message: fixture.message,
    });
    assert.equal(fs.existsSync(REJECTED_PATH), false, `${fixture.id} emitted a rejected plan`);
  }

  console.log(
    `metadata-segment: OK: static/generated metadata, route-matched static params, erased literal config, strict adapters, and ${NEGATIVE_CASES.length} exact diagnostics`,
  );
} catch (error) {
  console.error(`[metadata-segment] ERROR: ${error.message}`);
  process.exitCode = 1;
}
