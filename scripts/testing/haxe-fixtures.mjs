#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import Ajv2020 from "ajv/dist/2020.js";

import { prepareStableCssModule } from "../fixtures/next-stable-css-modules.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const CONTRACT_PATH = path.join(ROOT, "tests/haxe/fixtures.json");
const SCHEMA_PATH = path.join(ROOT, "schemas/haxe-fixtures.schema.json");
const HAXE_VERSION = "4.3.7";
const ANSI_ESCAPE = /\x1b\[[0-?]*[ -/]*[@-~]/g;
const DIAGNOSTIC_LINE =
  /^(.*):(\d+): characters (\d+)-(\d+) : \[([A-Z0-9-]+)\] (.+)$/;

class FixtureFailure extends Error {}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    throw new FixtureFailure(`cannot read ${path.relative(ROOT, filePath)}: ${error.message}`);
  }
}

function formatAjvErrors(errors) {
  return (errors ?? [])
    .map((error) => `${error.instancePath || "/"} ${error.message}`)
    .join("; ");
}

function repositoryPath(relative, label) {
  const absolute = path.resolve(ROOT, relative);
  const fromRoot = path.relative(ROOT, absolute);
  if (fromRoot.startsWith("..") || path.isAbsolute(fromRoot)) {
    throw new FixtureFailure(`${label} escapes the repository: ${relative}`);
  }
  return absolute;
}

function validateContract() {
  const schema = readJson(SCHEMA_PATH);
  const contract = readJson(CONTRACT_PATH);
  const validate = new Ajv2020({ allErrors: true, strict: true }).compile(schema);
  if (!validate(contract)) {
    throw new FixtureFailure(`invalid Haxe fixture contract: ${formatAjvErrors(validate.errors)}`);
  }

  const ids = [...contract.positive, ...contract.negative].map((fixture) => fixture.id);
  assert.equal(new Set(ids).size, ids.length, "Haxe fixture ids must be unique");
  for (const fixture of [...contract.positive, ...contract.negative]) {
    const build = repositoryPath(fixture.build, `${fixture.id} build`);
    assert(fs.statSync(build).isFile(), `${fixture.build} must be a regular file`);
  }
  for (const fixture of contract.negative) {
    repositoryPath(fixture.expected.file, `${fixture.id} diagnostic file`);
    assert(
      fixture.expected.characterEnd > fixture.expected.characterStart,
      `${fixture.id} diagnostic character range must be non-empty`,
    );
  }
  return contract;
}

function runHaxe(build, stdio) {
  const result = spawnSync("haxe", [build], {
    cwd: ROOT,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1" },
    stdio,
  });
  if (result.error !== undefined) {
    throw result.error;
  }
  return result;
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

async function runPositive(fixtures) {
  for (const fixture of fixtures) {
    console.log(`[haxe-fixtures] positive ${fixture.id}`);
    if (fixture.id === "next-stable-app-router") {
      await prepareStableCssModule();
    }
    const result = runHaxe(fixture.build, "inherit");
    assert.equal(result.status, 0, `${fixture.id} failed to compile`);
  }
  console.log(`[haxe-fixtures] positive: OK: ${fixtures.length} fixture(s)`);
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
    `${fixtureId} must emit exactly one NXHX diagnostic:\n${normalized}`,
  );
  const match = DIAGNOSTIC_LINE.exec(customLines[0]);
  assert(match !== null, `${fixtureId} emitted an unparseable diagnostic:\n${customLines[0]}`);
  return {
    file: match[1],
    line: Number(match[2]),
    characterStart: Number(match[3]),
    characterEnd: Number(match[4]),
    code: match[5],
    message: match[6],
  };
}

function runNegative(fixtures) {
  for (const fixture of fixtures) {
    console.log(`[haxe-fixtures] negative ${fixture.id}`);
    const result = runHaxe(fixture.build, ["ignore", "pipe", "pipe"]);
    const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
    assert.equal(
      result.status,
      fixture.expected.exitCode,
      `${fixture.id} exit code drifted; output:\n${output}`,
    );
    const actual = parseDiagnostic(output, fixture.id);
    const expectedFile = repositoryPath(fixture.expected.file, `${fixture.id} expected file`);
    const actualFile = path.isAbsolute(actual.file)
      ? path.normalize(actual.file)
      : path.resolve(ROOT, actual.file);
    assert.equal(actualFile, expectedFile, `${fixture.id} diagnostic file drifted`);
    for (const field of ["line", "characterStart", "characterEnd", "code", "message"]) {
      assert.equal(
        actual[field],
        fixture.expected[field],
        `${fixture.id} diagnostic ${field} drifted`,
      );
    }
  }
  console.log(`[haxe-fixtures] negative: OK: ${fixtures.length} fixture(s)`);
}

try {
  verifyHaxeVersion();
  const contract = validateContract();
  const mode = process.argv[2] ?? "all";
  switch (mode) {
    case "positive":
      await runPositive(contract.positive);
      break;
    case "negative":
      runNegative(contract.negative);
      break;
    case "all":
      await runPositive(contract.positive);
      runNegative(contract.negative);
      break;
    default:
      throw new FixtureFailure(`unknown mode ${mode}; expected positive, negative, or all`);
  }
} catch (error) {
  console.error(`[haxe-fixtures] ERROR: ${error.message}`);
  process.exitCode = 1;
}
