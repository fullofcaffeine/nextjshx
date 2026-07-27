#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const FIXTURE_ROOT = path.join(ROOT, "tests/route-patterns");
const OUTPUT_ROOT = path.join(FIXTURE_ROOT, ".tmp");
const FORWARD_PATH = path.join(OUTPUT_ROOT, "forward.json");
const REVERSE_PATH = path.join(OUTPUT_ROOT, "reverse.json");
const APPLICATION_PATH = path.join(OUTPUT_ROOT, "application.js");
const SNAPSHOT_PATH = path.join(ROOT, "tests/snapshots/route-patterns-v1.json");
const SOURCE_FILE = "tests/route-patterns/src/route_fixture/NegativeDeclarations.hx";
const HAXE_VERSION = "4.3.7";
const MODE = process.argv[2] ?? "verify";
const ANSI_ESCAPE = /\x1b\[[0-?]*[ -/]*[@-~]/g;
const CHARACTER_DIAGNOSTIC =
  /^(.*):(\d+): characters (\d+)-(\d+) : \[([A-Z0-9-]+)\] (.+)$/;
const LINE_DIAGNOSTIC = /^(.*):(\d+): lines (\d+)-(\d+) : \[([A-Z0-9-]+)\] (.+)$/;

const NEGATIVE_CASES = [
  {
    id: "absolute",
    line: 6,
    range: { kind: "characters", start: 14, end: 47 },
    code: "NXHX-ROUTE-PATH-0001",
    message: 'Route "/todos/[id]" must be relative to the discovered App Router root.',
  },
  {
    id: "traversal",
    line: 7,
    range: { kind: "characters", start: 14, end: 48 },
    code: "NXHX-ROUTE-PATH-0001",
    message:
      'Route "todos/../[id]" contains an empty, current-directory, or parent-directory segment.',
  },
  {
    id: "reserved",
    line: 8,
    range: { kind: "characters", start: 14, end: 47 },
    code: "NXHX-ROUTE-RESERVED-0001",
    message:
      'Segment "_private" in route "todos/_private/[id]" names a private or hidden filesystem location and cannot produce the declared public route.',
  },
  {
    id: "malformed",
    line: 9,
    range: { kind: "characters", start: 14, end: 48 },
    code: "NXHX-ROUTE-SEGMENT-0001",
    message:
      'Dynamic segment "[[id]]" in route "todos/[[id]]" must contain one non-empty Haxe field identifier.',
  },
  {
    id: "group",
    line: 10,
    range: { kind: "characters", start: 14, end: 44 },
    code: "NXHX-ROUTE-GROUP-0001",
    message:
      'Route-group segment "(marketing())" in route "(marketing())/todos" must contain one named, portable group such as (marketing).',
  },
  {
    id: "slot",
    line: 11,
    range: { kind: "characters", start: 14, end: 43 },
    code: "NXHX-ROUTE-SLOT-0001",
    message:
      'Parallel-route segment "@children" in route "todos/@children/[id]" must name one slot field such as @modal; @children is reserved by Next.',
  },
  {
    id: "interception",
    line: 12,
    range: { kind: "characters", start: 14, end: 51 },
    code: "NXHX-ROUTE-INTERCEPTION-0001",
    message:
      'Route "(..)photo/[id]" cannot use (..) at the App Router root; use (.) for a root sibling.',
  },
  {
    id: "interception-depth",
    line: 13,
    range: { kind: "characters", start: 14, end: 56 },
    code: "NXHX-ROUTE-INTERCEPTION-0001",
    message:
      'Route "feed/(..)(..)photo/[id]" cannot use (..)(..) with fewer than two preceding route segments.',
  },
  {
    id: "interception-empty",
    line: 14,
    range: { kind: "characters", start: 14, end: 56 },
    code: "NXHX-ROUTE-INTERCEPTION-0001",
    message:
      'Intercepting-route segment "(..)" in route "feed/(..)" must attach its marker directly to a static or dynamic target segment.',
  },
  {
    id: "interception-multiple",
    line: 15,
    range: { kind: "characters", start: 14, end: 59 },
    code: "NXHX-ROUTE-INTERCEPTION-0001",
    message:
      'Route "feed/(.)photo/(.)detail/[id]" contains more than one interception marker; Next permits one resolved interception target.',
  },
  {
    id: "duplicate",
    line: 16,
    range: { kind: "characters", start: 14, end: 48 },
    code: "NXHX-ROUTE-PARAM-DUPLICATE-0001",
    message:
      'Route "teams/[id]/members/[id]" repeats dynamic parameter "id"; each parameter name must be unique.',
  },
  {
    id: "placement",
    line: 17,
    range: { kind: "characters", start: 14, end: 48 },
    code: "NXHX-ROUTE-PARAM-PLACEMENT-0001",
    message:
      'Catch-all segment "[...slug]" in route "docs/[...slug]/edit" must be the final URL segment.',
  },
  {
    id: "missing",
    line: 18,
    range: { kind: "characters", start: 14, end: 46 },
    code: "NXHX-ROUTE-PARAM-MISSING-0001",
    message: 'Params for route "todos/[id]" are missing required field "id" for segment 2.',
  },
  {
    id: "extra",
    line: 35,
    range: { kind: "characters", start: 2, end: 21 },
    code: "NXHX-ROUTE-PARAM-EXTRA-0001",
    message:
      'Params for route "todos/[id]" contain extra field "extra" that no dynamic segment supplies.',
  },
  {
    id: "wrong-scalar",
    line: 39,
    range: { kind: "characters", start: 2, end: 15 },
    code: "NXHX-ROUTE-PARAM-TYPE-0001",
    message:
      'Route parameter "id" must be String, a transitively string-backed abstract, or a domain abstract with a validated @:next.routeCodec; found Int.',
  },
  {
    id: "wrong-catch-all",
    line: 43,
    range: { kind: "characters", start: 2, end: 20 },
    code: "NXHX-ROUTE-PARAM-TYPE-0001",
    message: 'Catch-all route parameter "slug" must be Array<String>; found String.',
  },
  {
    id: "wrong-optional-catch-all",
    line: 47,
    range: { kind: "characters", start: 2, end: 33 },
    code: "NXHX-ROUTE-PARAM-TYPE-0001",
    message:
      'Optional catch-all route parameter "slug" must be genes.ts.Undefinable<Array<String>>; found Null<Array<String>>.',
  },
  {
    id: "optional-field",
    line: 51,
    range: { kind: "characters", start: 2, end: 41 },
    code: "NXHX-ROUTE-PARAM-TYPE-0001",
    message:
      'Route parameter field "slug" must be required; optional catch-all absence is represented by genes.ts.Undefinable<Array<String>>.',
  },
  {
    id: "missing-codec",
    line: 57,
    range: { kind: "characters", start: 2, end: 26 },
    code: "NXHX-ROUTE-PARAM-TYPE-0001",
    message:
      'Route parameter "id" must be String, a transitively string-backed abstract, or a domain abstract with a validated @:next.routeCodec; found route_fixture.MissingCodecId.',
  },
  {
    id: "invalid-codec",
    line: 73,
    range: { kind: "lines", start: 73, end: 75 },
    code: "NXHX-ROUTE-CODEC-0001",
    message:
      'Route codec "route_fixture.NegativeDeclarations.BadNumericIdCodec" encode must have exact signature encode(value:route_fixture.BadNumericId):String.',
  },
  {
    id: "not-anonymous",
    line: 26,
    range: { kind: "characters", start: 14, end: 51 },
    code: "NXHX-ROUTE-PARAMS-0001",
    message:
      'Params for route "todos/[id]" must be an anonymous typedef or non-generic @:structInit class with exactly its dynamic fields; found String.',
  },
];

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1" },
  });
  if (result.error !== undefined) {
    throw result.error;
  }
  return result;
}

function verifyHaxeVersion() {
  const result = run("haxe", ["--version"]);
  assert.equal(result.status, 0, "haxe --version failed");
  assert.equal(result.stdout.trim(), HAXE_VERSION, `expected Haxe ${HAXE_VERSION}`);
}

function genesClassPath() {
  const result = run("haxelib", ["path", "genes-ts"]);
  assert.equal(result.status, 0, `haxelib path genes-ts failed:\n${result.stderr}`);
  const candidates = result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== "" && !line.startsWith("-"));
  const source = candidates.find((candidate) =>
    fs.existsSync(path.join(candidate, "genes/ts/Undefinable.hx")),
  );
  assert(source !== undefined, "haxelib path genes-ts did not expose genes.ts.Undefinable");
  return source;
}

function runHaxe(build, genesSource, extraArgs = [], expectedStatus = 0) {
  const result = run("haxe", [build, "-cp", genesSource, ...extraArgs]);
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  assert.equal(result.status, expectedStatus, `${build} exited ${result.status}:\n${output}`);
  return output;
}

function normalizedPlan(file) {
  const value = JSON.parse(fs.readFileSync(file, "utf8"));
  assert.deepEqual(Object.keys(value).sort(), ["routes", "schemaVersion"]);
  assert.equal(value.schemaVersion, 2);
  const routes = value.routes.map((route) => {
    assert.deepEqual(Object.keys(route).sort(), [
      "filesystemPath",
      "interception",
      "parallelSlots",
      "parameters",
      "publicPath",
      "publicSegments",
      "segments",
      "topology",
    ]);
    const segment = (value) => ({
      source: value.source,
      publicSource: value.publicSource,
      kind: value.kind,
      segmentIndex: value.segmentIndex,
      interception: value.interception,
    });
    return {
      filesystemPath: route.filesystemPath,
      publicPath: route.publicPath,
      topology: route.topology,
      parallelSlots: route.parallelSlots,
      interception: route.interception,
      segments: route.segments.map(segment),
      publicSegments: route.publicSegments.map(segment),
      parameters: route.parameters.map((parameter) => ({
        name: parameter.name,
        kind: parameter.kind,
        segmentIndex: parameter.segmentIndex,
        haxeType: parameter.haxeType,
        codecType: parameter.codecType,
      })),
    };
  });
  return `${JSON.stringify({ schemaVersion: 2, routes }, null, 2)}\n`;
}

function repositoryRelative(file) {
  const absolute = path.isAbsolute(file) ? path.normalize(file) : path.resolve(ROOT, file);
  const relative = path.relative(ROOT, absolute);
  assert(
    relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative),
    `diagnostic path escapes the repository: ${file}`,
  );
  return relative.split(path.sep).join("/");
}

function parseDiagnostic(output, fixtureId) {
  const normalized = output.replace(ANSI_ESCAPE, "").replaceAll("\\", "/");
  const customLines = normalized
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.includes("[NXHX-"));
  assert.equal(customLines.length, 1, `${fixtureId} must emit exactly one NXHX diagnostic:\n${normalized}`);
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

try {
  assert(new Set(["verify", "update"]).has(MODE), `expected verify or update mode, found ${MODE}`);
  assert(
    MODE !== "update" || !/^(?:1|true)$/i.test(process.env.CI ?? ""),
    "route-pattern snapshot updates are disabled in CI",
  );
  verifyHaxeVersion();
  const genesSource = genesClassPath();
  fs.rmSync(OUTPUT_ROOT, { recursive: true, force: true });
  fs.mkdirSync(OUTPUT_ROOT, { recursive: true });

  runHaxe("tests/route-patterns/build-forward.hxml", genesSource);
  runHaxe("tests/route-patterns/build-reverse.hxml", genesSource);
  const forward = normalizedPlan(FORWARD_PATH);
  const reverse = normalizedPlan(REVERSE_PATH);
  assert.equal(reverse, forward, "route registration order changed the canonical route model");
  if (MODE === "update") {
    fs.writeFileSync(SNAPSHOT_PATH, forward, "utf8");
  } else {
    assert.equal(
      fs.readFileSync(SNAPSHOT_PATH, "utf8"),
      forward,
      "route-pattern snapshot drifted; review the App Router grammar and Haxe binding contract",
    );
  }
  assert(!forward.includes(ROOT), "route model leaked the compiler host's absolute workspace path");
  assert(!fs.existsSync(APPLICATION_PATH), "--no-output unexpectedly published application JavaScript");

  for (const fixture of NEGATIVE_CASES) {
    const output = runHaxe(
      "tests/route-patterns/build-negative.hxml",
      genesSource,
      ["-D", `route_case=${fixture.id}`],
      1,
    );
    assert.deepEqual(parseDiagnostic(output, fixture.id), {
      file: SOURCE_FILE,
      line: fixture.line,
      range: fixture.range,
      code: fixture.code,
      message: fixture.message,
    });
  }

  console.log(
    `route-patterns: OK: 15 topology positives and ${NEGATIVE_CASES.length} exact fail-closed diagnostics`,
  );
} catch (error) {
  console.error(`[route-patterns] ERROR: ${error.message}`);
  process.exitCode = 1;
}
