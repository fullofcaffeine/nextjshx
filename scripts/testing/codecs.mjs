#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const FIXTURE = path.join(ROOT, "tests/codecs");
const OUTPUT = path.join(FIXTURE, ".tmp");
const TYPESCRIPT_OUTPUT = path.join(OUTPUT, "typescript");
const CLASSIC_ENTRY = path.join(OUTPUT, "classic/index.js");
const TSC = path.join(ROOT, "node_modules/typescript/bin/tsc6");
const HAXE_VERSION = "4.3.7";
const ANSI_ESCAPE = /\x1b\[[0-?]*[ -/]*[@-~]/g;

class CodecFailure extends Error {}

function run(command, args, expectedStatus = 0) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    encoding: "utf8",
    env: { ...process.env, CI: "1", NO_COLOR: "1", NEXT_TELEMETRY_DISABLED: "1" },
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.error !== undefined) {
    throw result.error;
  }
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  if (result.status !== expectedStatus) {
    throw new CodecFailure(
      `${path.basename(command)} ${args.join(" ")} exited ${result.status}; expected ${expectedStatus}:\n${output}`,
    );
  }
  return output;
}

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return walk(absolute);
    }
    if (!entry.isFile()) {
      throw new CodecFailure(`generated codec output contains a link: ${absolute}`);
    }
    return [absolute];
  });
}

function clean() {
  fs.rmSync(OUTPUT, { recursive: true, force: true });
}

function normalize(output) {
  return output
    .replace(ANSI_ESCAPE, "")
    .replaceAll("\\", "/")
    .replaceAll(`${ROOT.replaceAll("\\", "/")}/`, "")
    .trim();
}

function verifyGeneratedOutput() {
  const owned = walk(TYPESCRIPT_OUTPUT).filter((file) => {
    const relative = path.relative(TYPESCRIPT_OUTPUT, file).replaceAll("\\", "/");
    return relative.startsWith("nextjs/codec/") || relative === "codecs/CodecFixture.ts";
  });
  assert(owned.length >= 10, "codec fixture did not retain the semantic modules");
  for (const file of owned) {
    const source = fs.readFileSync(file, "utf8");
    const relative = path.relative(ROOT, file);
    assert(!/\bany\b/.test(source), `${relative} contains TypeScript any`);
    assert(!source.includes("Register.unsafeCast"), `${relative} contains an unchecked cast`);
    assert(!/@ts-(?:ignore|nocheck)/.test(source), `${relative} suppresses TypeScript`);
    assert(!source.includes("next/dist/"), `${relative} imports private Next code`);
    assert(!source.includes(ROOT), `${relative} leaked the compiler host path`);
  }

  const fixture = fs.readFileSync(path.join(TYPESCRIPT_OUTPUT, "codecs/CodecFixture.ts"), "utf8");
  for (const evidence of [
    "RequestDecoder.json",
    "RequestDecoder.form",
    "FormDataDecoder.object",
    "QueryDecoder.object",
    "ResponseJson.invalid",
    "NextResponse.json",
    "invalid_json",
    'decodePriority(value: string): DecodeResult<"P0" | "P1">',
    "Decode.accept",
  ]) {
    assert(fixture.includes(evidence), `generated fixture lost ${evidence}`);
  }
  assert.match(
    fixture,
    /const responseBody: \{[\s\S]*completed: boolean,[\s\S]*ok: boolean,[\s\S]*title: string[\s\S]*\}/,
    "checked success response lost its precise body type",
  );
}

try {
  clean();
  assert.equal(run("haxe", ["--version"]).trim(), HAXE_VERSION);
  run("haxe", ["tests/codecs/build-typescript.hxml"]);
  run(process.execPath, [TSC, "--project", "tests/codecs/tsconfig.json", "--pretty", "false"]);
  run("haxe", ["tests/codecs/build-classic.hxml"]);
  verifyGeneratedOutput();

  const runtime = run(process.execPath, [CLASSIC_ENTRY]);
  assert.equal(
    runtime.trim(),
    "codecs-runtime: OK: JSON, form, and query boundaries",
  );

  const responseFailure = normalize(
    run("haxe", ["tests/codecs/build-negative-response.hxml"], 1),
  );
  assert(
    responseFailure.includes("Json.value expects a JSON-compatible value"),
    `checked response diagnostic drifted:\n${responseFailure}`,
  );

  const boundaryFailure = normalize(
    run("haxe", ["tests/codecs/build-negative-boundary.hxml"], 1),
  );
  assert(
    boundaryFailure.includes("genes.ts.Unknown should be String"),
    `unknown boundary diagnostic drifted:\n${boundaryFailure}`,
  );

  console.log(
    "codecs: OK: exact JSON/form/query decoding, typed response bodies, 9 malformed runtime controls, signed 32-bit edges, and 2 compile failures",
  );
} catch (error) {
  console.error(`[codecs] ERROR: ${error.message}`);
  process.exitCode = 1;
} finally {
  clean();
}
