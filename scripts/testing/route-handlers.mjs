#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import Ajv2020 from "ajv/dist/2020.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const FIXTURE_ROOT = path.join(ROOT, "tests/route-handlers");
const OUTPUT_ROOT = path.join(FIXTURE_ROOT, ".tmp");
const PLAN_PATH = path.join(OUTPUT_ROOT, "plan.json");
const REJECTED_PATH = path.join(OUTPUT_ROOT, "rejected.json");
const APPLICATION_PATH = path.join(OUTPUT_ROOT, "application.js");
const TYPESCRIPT_ROOT = path.join(OUTPUT_ROOT, "typescript");
const TSC_BIN = path.join(ROOT, "node_modules/typescript/bin/tsc6");
const SNAPSHOT_PATH = path.join(ROOT, "tests/snapshots/route-handler-plan-v1.json");
const SCHEMA_PATH = path.join(ROOT, "schemas/adapter-plan.schema.json");
const ANSI_ESCAPE = /\x1b\[[0-?]*[ -/]*[@-~]/g;
const CHARACTER_DIAGNOSTIC =
  /^(.*):(\d+): characters (\d+)-(\d+) : \[([A-Z0-9-]+)\] (.+)$/;
const LINE_DIAGNOSTIC = /^(.*):(\d+): lines (\d+)-(\d+) : \[([A-Z0-9-]+)\] (.+)$/;
const MODE = process.argv[2] ?? "verify";

const NEGATIVE_CASES = [
  {
    id: "duplicate",
    file: "tests/route-handlers/src/route_handlers/negative/DuplicateHandlers.hx",
    line: 15,
    range: { kind: "characters", start: 2, end: 12 },
    code: "NXHX-ROUTE-HANDLER-DUPLICATE-0008",
    message:
      'Route Handler route_handlers.negative.DuplicateHandlers exports GET from both "first" and "second"; each HTTP method may be exported once.',
  },
  {
    id: "unsupported",
    file: "tests/route-handlers/src/route_handlers/negative/UnsupportedHandler.hx",
    line: 10,
    range: { kind: "characters", start: 2, end: 14 },
    code: "NXHX-ROUTE-HANDLER-METHOD-0002",
    message:
      'Route Handler field "trace" uses unsupported method annotation @next.TRACE; supported methods are GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS.',
  },
  {
    id: "context",
    file: "tests/route-handlers/src/route_handlers/negative/NonRouteContextHandler.hx",
    line: 10,
    range: { kind: "lines", start: 10, end: 12 },
    code: "NXHX-ROUTE-HANDLER-CONTEXT-0005",
    message:
      "Route Handler context must be nextjs.route.RouteContext<Params> so params remain Promise-shaped; found route_handlers.negative.StructuralContext.",
  },
  {
    id: "params",
    file: "tests/route-handlers/src/route_handlers/negative/WrongParamsHandler.hx",
    line: 11,
    range: { kind: "lines", start: 11, end: 13 },
    code: "NXHX-ROUTE-PARAM-MISSING-0001",
    message:
      'Params for route "api/negative/[id]" are missing required field "id" for segment 3.',
  },
  {
    id: "response",
    file: "tests/route-handlers/src/route_handlers/negative/WrongResponseHandler.hx",
    line: 10,
    range: { kind: "lines", start: 10, end: 12 },
    code: "NXHX-ROUTE-HANDLER-RESPONSE-0006",
    message:
      "Route Handler GET must return WebResponse, NextResponse, or Promise of one; found String.",
  },
  {
    id: "topology",
    file: "tests/route-handlers/src/route_handlers/negative/ParallelRouteHandler.hx",
    line: 7,
    range: { kind: "characters", start: 1, end: 13 },
    code: "NXHX-ROUTE-HANDLER-PATH-0001",
    message:
      "Route Handler route_handlers.negative.ParallelRouteHandler may use URL-elided route groups, but parallel slots and intercepted views are UI topology rather than request endpoint ownership.",
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
  assert(validate(plan), `Route Handler plan violates schema v1:\n${JSON.stringify(validate.errors, null, 2)}`);
  if (MODE === "update") {
    fs.writeFileSync(SNAPSHOT_PATH, encoded, "utf8");
  } else {
    assert.equal(
      encoded,
      fs.readFileSync(SNAPSHOT_PATH, "utf8"),
      "Route Handler adapter-plan bytes drifted from the reviewed snapshot",
    );
  }
  assert.equal(plan.intents.length, 1);
  const [intent] = plan.intents;
  assert.equal(intent.kind, "route-handler");
  assert.equal(intent.segmentPath, "api/(v1)/echo/[id]");
  assert.equal(intent.targetPath, "api/(v1)/echo/[id]/route.ts");
  assert.equal(intent.implementation.symbol, "EchoHandlers");
  assert.equal(
    intent.implementation.modulePath,
    "../../../../../../.tmp/src-gen/route_handlers/positive/EchoHandlers",
  );
  assert.deepEqual(
    intent.exports.map((entry) => [entry.name, entry.sourceField]),
    [
      ["DELETE", "remove"],
      ["GET", "get"],
      ["POST", "post"],
    ],
  );
  assert.match(intent.exports[0].signature, /=> globalThis\.Response$/);
  assert.match(intent.exports[1].signature, /=> Promise<globalThis\.Response>$/);
  assert.match(intent.exports[2].signature, /=> Promise<globalThis\.Response>$/);
  assert(intent.exports.every((entry) => entry.signature.includes('RouteContext<"/api/echo/[id]">')));
  assert(!/\b(?:any|unknown)\b/.test(encoded), "Route Handler plan contains a broad TypeScript type");
  assert(!encoded.includes(portable(ROOT)), "Route Handler plan leaked the compiler host path");
  assert.equal(fs.existsSync(APPLICATION_PATH), false, "--no-output emitted application JavaScript");
}

function validateGeneratedTypescript() {
  runHaxe("tests/route-handlers/build-typescript.hxml", 0);
  const handler = fs.readFileSync(
    path.join(TYPESCRIPT_ROOT, "route_handlers/positive/EchoHandlers.ts"),
    "utf8",
  );
  const consumer = fs.readFileSync(
    path.join(TYPESCRIPT_ROOT, "route_handlers/NoRuntime.ts"),
    "utf8",
  );
  assert(
    handler.includes("static href(params: EchoParams): import('next').Route<`/api/echo/${string}`>"),
    "Route Handler href lost its concrete Next route type",
  );
  assert(
    consumer.includes("NoRuntime.retain(`/api/echo/${__nextRoute0Encoded0}`);"),
    "Route Handler href did not erase to one canonical encoded pathname",
  );
  assert(!consumer.includes("EchoHandlers"), "inline Route Handler href retained the server implementation");
  const hrefStart = handler.indexOf("\tstatic href(");
  const hrefEnd = handler.indexOf("\tstatic get __name__", hrefStart);
  assert(hrefStart !== -1 && hrefEnd !== -1, "generated Route Handler href section is missing");
  const href = handler.slice(hrefStart, hrefEnd);
  for (const source of [href, consumer]) {
    assert(!/\b(?:any|unknown)\b/.test(source), "generated Route Handler href widened to a broad type");
    assert(!/\sas\s/.test(source), "generated Route Handler href contains an assertion");
    assert(!source.includes(portable(ROOT)), "generated Route Handler href leaked the compiler host path");
  }
  const result = spawnSync(process.execPath, [
    TSC_BIN,
    "--project",
    "tests/route-handlers/tsconfig.json",
    "--pretty",
    "false",
  ], { cwd: ROOT, encoding: "utf8", env: { ...process.env, CI: "1" } });
  assert.equal(result.status, 0, `strict TypeScript rejected Route Handler href output:\n${result.stdout}${result.stderr}`);
}

try {
  assert(new Set(["verify", "update"]).has(MODE), `expected verify or update mode, found ${MODE}`);
  assert(
    MODE !== "update" || !/^(?:1|true)$/i.test(process.env.CI ?? ""),
    "Route Handler snapshot updates are disabled in CI",
  );
  const version = runHaxe("--version", 0).trim();
  assert.equal(version, "4.3.7", `expected Haxe 4.3.7, found ${version}`);
  fs.rmSync(OUTPUT_ROOT, { recursive: true, force: true });
  fs.mkdirSync(OUTPUT_ROOT, { recursive: true });

  runHaxe("tests/route-handlers/build-positive.hxml", 0);
  validatePlan();
  validateGeneratedTypescript();

  for (const fixture of NEGATIVE_CASES) {
    fs.rmSync(REJECTED_PATH, { force: true });
    const output = runHaxe(
      "tests/route-handlers/build-negative.hxml",
      1,
      ["-D", `route_handler_case=${fixture.id}`],
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
    `route-handlers: OK: GET/POST/DELETE plan, typed canonical href output, and ${NEGATIVE_CASES.length} exact fail-closed diagnostics`,
  );
} catch (error) {
  console.error(`[route-handlers] ERROR: ${error.message}`);
  process.exitCode = 1;
}
