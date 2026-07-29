#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import Ajv2020 from "ajv/dist/2020.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const FIXTURE_ROOT = path.join(ROOT, "tests/adapter-plan");
const OUTPUT_ROOT = path.join(FIXTURE_ROOT, ".tmp");
const FORWARD_PATH = path.join(OUTPUT_ROOT, "forward.json");
const REVERSE_PATH = path.join(OUTPUT_ROOT, "reverse.json");
const OVERRIDE_PATH = path.join(OUTPUT_ROOT, "override.json");
const DUPLICATE_PATH = path.join(OUTPUT_ROOT, "duplicate.json");
const APPLICATION_PATH = path.join(OUTPUT_ROOT, "application.js");
const SNAPSHOT_PATH = path.join(ROOT, "tests/snapshots/adapter-plan-v1.json");
const SCHEMA_PATH = path.join(ROOT, "schemas/adapter-plan.schema.json");
const HAXE_VERSION = "4.3.7";
const SENTINEL = "existing-plan-must-survive\n";
const ANSI_ESCAPE = /\x1b\[[0-?]*[ -/]*[@-~]/g;
const DIAGNOSTIC_LINE =
  /^(.*):(\d+): characters (\d+)-(\d+) : \[([A-Z0-9-]+)\] (.+)$/;

function portable(relative) {
  return relative.split(path.sep).join("/");
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

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function runHaxe(build, expectedStatus = 0, extraArgs = []) {
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

function verifyHaxeVersion() {
  const result = spawnSync("haxe", ["--version"], {
    cwd: ROOT,
    encoding: "utf8",
  });
  if (result.error !== undefined) {
    throw result.error;
  }
  assert.equal(result.status, 0, "haxe --version failed");
  assert.equal(result.stdout.trim(), HAXE_VERSION, `expected Haxe ${HAXE_VERSION}`);
}

function schemaValidator() {
  const schema = readJson(SCHEMA_PATH);
  return new Ajv2020({ allErrors: true, strict: true }).compile(schema);
}

function validateSchema(plan, validate) {
  assert(validate(plan), `adapter plan violates its JSON Schema:\n${JSON.stringify(validate.errors, null, 2)}`);
}

function validateSchemaBoundary(plan, validate) {
  const cases = [
    ["unknown schema version", (value) => {
      value.schemaVersion = 2;
    }],
    ["unknown root property", (value) => {
      value.unreviewed = true;
    }],
    ["unsupported adapter kind", (value) => {
      value.intents[0].kind = "arbitrary";
    }],
    ["absolute target", (value) => {
      value.intents[0].targetPath = "/tmp/page.tsx";
    }],
    ["traversing target", (value) => {
      value.intents[0].targetPath = "todos/../page.tsx";
    }],
    ["backslash target", (value) => {
      value.intents[0].targetPath = "todos\\page.tsx";
    }],
    ["unreviewed config value", (value) => {
      value.intents[0].config[0].value.kind = "expression";
    }],
  ];
  for (const [label, mutate] of cases) {
    const candidate = structuredClone(plan);
    mutate(candidate);
    assert.equal(validate(candidate), false, `adapter-plan schema accepted ${label}`);
  }
}

function validatePosition(position, expectedFile) {
  assert.equal(position.file, expectedFile);
  for (const key of ["startLine", "startCharacter", "endLine", "endCharacter"]) {
    assert(Number.isInteger(position[key]) && position[key] >= 1, `${expectedFile} ${key} is invalid`);
  }
  assert(
    position.endLine > position.startLine ||
      (position.endLine === position.startLine && position.endCharacter > position.startCharacter),
    `${expectedFile} source range must be non-empty`,
  );
}

function validatePlanContract(plan, encoded) {
  assert.equal(plan.$schema, "https://nextjshx.dev/schemas/adapter-plan.schema.json");
  assert.equal(plan.schemaVersion, 1);
  assert.deepEqual(plan.toolchain, {
    nextjshx: "0.0.0-development",
    haxe: "4.3.7",
    genesTs: "1.41.0+8a7f7aaf3227fdee79a3cbd25d90ef2c99975f78",
    next: "16.2.12",
  });
  assert.deepEqual(
    plan.intents.map((intent) => intent.targetPath),
    ["todos/[id]/page.tsx", "todos/_components/TodoToggle.tsx"],
    "intents must use canonical target order",
  );

  const [page, client] = plan.intents;
  assert.equal(page.kind, "page");
  assert.equal(client.kind, "client-component");
  assert.deepEqual(page.exports.map((entry) => entry.name), ["default"]);
  assert.deepEqual(
    page.config.map((entry) => entry.name),
    ["dynamicParams", "preferredRegion", "revalidate", "runtime"],
  );
  assert.deepEqual(client.directives, ["use client", "use strict"]);
  assert.deepEqual(
    page.imports.map((entry) => entry.modulePath),
    ["../../../../src-gen/adapter_plan/PageDeclaration", "next"],
  );

  const expectedFiles = new Map([
    ["adapter_plan.PageDeclaration", "tests/adapter-plan/src/adapter_plan/PageDeclaration.hx"],
    ["adapter_plan.ClientDeclaration", "tests/adapter-plan/src/adapter_plan/ClientDeclaration.hx"],
  ]);
  for (const intent of plan.intents) {
    const expectedFile = expectedFiles.get(intent.source.typeName);
    assert(expectedFile !== undefined, `unexpected source type ${intent.source.typeName}`);
    validatePosition(intent.source.typePosition, expectedFile);
    validatePosition(intent.source.fieldPosition, expectedFile);
    validatePosition(intent.source.metadataPosition, expectedFile);
  }

  assert(!encoded.includes(portable(ROOT)), "plan leaked the compiler host's absolute workspace path");
  assert(!fs.existsSync(APPLICATION_PATH), "--no-output unexpectedly published application JavaScript");
}

function parseDiagnostic(output) {
  const normalized = output.replace(ANSI_ESCAPE, "").replaceAll("\\", "/");
  const customLines = normalized
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.includes("[NXHX-"));
  assert.equal(customLines.length, 1, `expected one NextJsHx diagnostic:\n${normalized}`);
  const match = DIAGNOSTIC_LINE.exec(customLines[0]);
  assert(match !== null, `unparseable NextJsHx diagnostic:\n${customLines[0]}`);
  return {
    file: repositoryRelative(match[1]),
    line: Number(match[2]),
    characterStart: Number(match[3]),
    characterEnd: Number(match[4]),
    code: match[5],
    message: match[6],
  };
}

function validateDuplicateDiagnostic(plan, output) {
  const page = plan.intents.find((intent) => intent.source.typeName === "adapter_plan.PageDeclaration");
  const client = plan.intents.find((intent) => intent.source.typeName === "adapter_plan.ClientDeclaration");
  assert(page !== undefined && client !== undefined, "fixture plan sources are incomplete");
  const pagePosition = page.source.metadataPosition;
  const clientPosition = client.source.metadataPosition;
  const diagnostic = parseDiagnostic(output);
  assert.deepEqual(diagnostic, {
    file: pagePosition.file,
    line: pagePosition.startLine,
    characterStart: pagePosition.startCharacter,
    characterEnd: pagePosition.endCharacter,
    code: "NXHX-PLAN-DUPLICATE-0001",
    message:
      `Adapter target "todos/[id]/page.tsx" is requested by both ` +
      `adapter_plan.ClientDeclaration.render at ${clientPosition.file}:` +
      `${clientPosition.startLine}:${clientPosition.startCharacter} and ` +
      `adapter_plan.PageDeclaration.render. Choose one Haxe declaration for each generated file.`,
  });
  assert.equal(fs.readFileSync(DUPLICATE_PATH, "utf8"), SENTINEL);
}

try {
  verifyHaxeVersion();
  fs.rmSync(OUTPUT_ROOT, { recursive: true, force: true });
  fs.mkdirSync(OUTPUT_ROOT, { recursive: true });

  runHaxe("tests/adapter-plan/build-forward.hxml", 0, [
    "-D",
    "nextjshx.adapter-plan-output=tests/adapter-plan/.tmp/override.json",
  ]);
  assert(fs.existsSync(OVERRIDE_PATH), "the CLI adapter-plan output define was ignored");
  assert(!fs.existsSync(FORWARD_PATH), "the default plan path was written despite the CLI override");

  runHaxe("tests/adapter-plan/build-forward.hxml");
  runHaxe("tests/adapter-plan/build-reverse.hxml");

  const forward = fs.readFileSync(FORWARD_PATH, "utf8");
  const reverse = fs.readFileSync(REVERSE_PATH, "utf8");
  assert.equal(
    fs.readFileSync(OVERRIDE_PATH, "utf8"),
    forward,
    "the CLI-selected plan differs from the registry's default output",
  );
  assert.equal(reverse, forward, "registration order changed adapter-plan bytes");
  const plan = JSON.parse(forward);
  const validate = schemaValidator();
  validateSchema(plan, validate);
  validateSchemaBoundary(plan, validate);
  validatePlanContract(plan, forward);
  assert.equal(
    fs.readFileSync(SNAPSHOT_PATH, "utf8"),
    forward,
    "adapter-plan snapshot drifted; review the generated schema-v1 contract",
  );

  fs.writeFileSync(DUPLICATE_PATH, SENTINEL, "utf8");
  const duplicateOutput = runHaxe("tests/adapter-plan/build-duplicate.hxml", 1);
  validateDuplicateDiagnostic(plan, duplicateOutput);

  console.log(
    "adapter-plan: OK: schema v1, CLI output override, canonical bytes, portable positions, duplicate fail-closed behavior",
  );
} catch (error) {
  console.error(`[adapter-plan] ERROR: ${error.message}`);
  process.exitCode = 1;
}
