#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import Ajv2020 from "ajv/dist/2020.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const FIXTURE_ROOT = path.join(ROOT, "tests/proxy");
const OUTPUT_ROOT = path.join(FIXTURE_ROOT, ".tmp");
const PLAN_PATH = path.join(OUTPUT_ROOT, "plan.json");
const NO_CONFIG_PLAN_PATH = path.join(OUTPUT_ROOT, "no-config-plan.json");
const SNAPSHOT_PATH = path.join(ROOT, "tests/snapshots/proxy-plan-v1.json");
const SCHEMA_PATH = path.join(ROOT, "schemas/adapter-plan.schema.json");
const TSC_BIN = path.join(ROOT, "node_modules/typescript/bin/tsc6");
const ANSI_ESCAPE = /\x1b\[[0-?]*[ -/]*[@-~]/g;
const CHARACTER_DIAGNOSTIC =
  /^(.*):(\d+): characters (\d+)-(\d+) : \[([A-Z0-9-]+)\] (.+)$/;
const LINE_DIAGNOSTIC = /^(.*):(\d+): lines (\d+)-(\d+) : \[([A-Z0-9-]+)\] (.+)$/;

const NEGATIVE_CASES = [
  {
    id: "missing-function",
    file: "tests/proxy/src/proxy_fixture/negative/MissingFunction.hx",
    line: 4,
    range: { kind: "characters", start: 1, end: 25 },
    code: "NXHX-PROXY-FUNCTION-0002",
    message:
      "Proxy declaration proxy_fixture.negative.MissingFunction must expose exactly one public static proxy function; found 0.",
  },
  {
    id: "wrong-request",
    file: "tests/proxy/src/proxy_fixture/negative/WrongRequest.hx",
    line: 7,
    range: { kind: "lines", start: 7, end: 9 },
    code: "NXHX-PROXY-SIGNATURE-0004",
    message:
      "Proxy request must be nextjs.proxy.ProxyRequest or raw nextjs.raw.server.NextRequest; found String.",
  },
  {
    id: "wrong-return",
    file: "tests/proxy/src/proxy_fixture/negative/WrongReturn.hx",
    line: 7,
    range: { kind: "lines", start: 7, end: 9 },
    code: "NXHX-PROXY-RETURN-0005",
    message:
      "Proxy return must be ProxyResponse, WebResponse, NextResponse, NextMiddlewareResult, or a supported Promise form; found String.",
  },
  {
    id: "matcher-expression",
    file: "tests/proxy/src/proxy_fixture/negative/MatcherExpression.hx",
    line: 11,
    range: { kind: "characters", start: 16, end: 34 },
    code: "NXHX-PROXY-MATCHER-0003",
    message:
      "@:next.matcher on proxy_fixture.negative.MatcherExpression accepts compile-time string literals only; expressions are not evaluated.",
  },
  {
    id: "duplicate-matcher",
    file: "tests/proxy/src/proxy_fixture/negative/DuplicateMatcher.hx",
    line: 7,
    range: { kind: "characters", start: 1, end: 15 },
    code: "NXHX-PROXY-MATCHER-0003",
    message: 'Proxy matcher "/private" is duplicated.',
  },
  {
    id: "extra-public",
    file: "tests/proxy/src/proxy_fixture/negative/ExtraPublic.hx",
    line: 8,
    range: { kind: "characters", start: 2, end: 51 },
    code: "NXHX-PROXY-FIELD-0006",
    message:
      "Public proxy field proxy_fixture.negative.ExtraPublic.config has no reviewed proxy.ts export mapping; make helpers private.",
  },
  {
    id: "boundary-conflict",
    file: "tests/proxy/src/proxy_fixture/negative/BoundaryConflict.hx",
    line: 7,
    range: { kind: "characters", start: 1, end: 13 },
    code: "NXHX-PROXY-BOUNDARY-0001",
    message:
      "proxy_fixture.negative.BoundaryConflict must declare exactly one App Router boundary annotation; found 2.",
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
  const lines = normalized
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.includes("[NXHX-"));
  assert.equal(lines.length, 1, `${fixtureId} must emit one diagnostic:\n${normalized}`);
  const characters = CHARACTER_DIAGNOSTIC.exec(lines[0]);
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
  const lineRange = LINE_DIAGNOSTIC.exec(lines[0]);
  assert(lineRange !== null, `${fixtureId} emitted an unparseable diagnostic`);
  return {
    file: repositoryRelative(lineRange[1]),
    line: Number(lineRange[2]),
    range: {
      kind: "lines",
      start: Number(lineRange[3]),
      end: Number(lineRange[4]),
    },
    code: lineRange[5],
    message: lineRange[6],
  };
}

fs.rmSync(OUTPUT_ROOT, { recursive: true, force: true });
run("haxe", ["tests/proxy/build-positive.hxml"]);

const encoded = fs.readFileSync(PLAN_PATH, "utf8");
const plan = JSON.parse(encoded);
const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, "utf8"));
const validate = new Ajv2020({ allErrors: true, strict: true }).compile(schema);
assert(validate(plan), `Proxy plan violates schema v1:\n${JSON.stringify(validate.errors, null, 2)}`);
assert.equal(
  encoded,
  fs.readFileSync(SNAPSHOT_PATH, "utf8"),
  "Proxy adapter-plan bytes drifted from the reviewed snapshot",
);
assert.equal(plan.intents.length, 1);
const [intent] = plan.intents;
assert.equal(intent.kind, "proxy");
assert.equal(intent.segmentPath, "");
assert.equal(intent.targetPath, "proxy.ts");
assert.deepEqual(intent.config, [
  {
    name: "matcher",
    value: { kind: "string-array", value: ["/haxe", "/products/:path*"] },
  },
]);
assert.deepEqual(intent.exports, [
  {
    kind: "named",
    name: "proxy",
    sourceField: "proxy",
    signature: "NextJsHxProxy",
  },
]);
assert(!/\b(?:any|unknown)\b/.test(encoded), "Proxy plan contains a broad type");
assert(!encoded.includes(portable(ROOT)), "Proxy plan leaked the compiler host path");
assert.equal(fs.existsSync(path.join(OUTPUT_ROOT, "application.js")), false);

run("haxe", ["tests/proxy/build-no-config.hxml"]);
const noConfigPlan = JSON.parse(fs.readFileSync(NO_CONFIG_PLAN_PATH, "utf8"));
assert(validate(noConfigPlan), "No-config proxy plan violates schema v1");
assert.equal(noConfigPlan.intents.length, 1);
assert.deepEqual(noConfigPlan.intents[0].config, []);
assert(
  noConfigPlan.intents[0].imports.every(
    (entry) => entry.symbol !== "ProxyConfig",
  ),
  "No-config proxy retained a ProxyConfig import",
);
assert.equal(fs.existsSync(path.join(OUTPUT_ROOT, "no-config.js")), false);

run("haxe", ["tests/proxy/build-typescript.hxml"]);
run(process.execPath, [
  TSC_BIN,
  "--project",
  "tests/proxy/tsconfig.json",
  "--noEmit",
]);
const generated = fs.readFileSync(
  path.join(OUTPUT_ROOT, "typescript/proxy_fixture/positive/RequestProxy.ts"),
  "utf8",
);
assert(generated.includes("static proxy(request:"));
assert(generated.includes("event: NextFetchEvent"));
assert(
  generated.includes(
    "Promise<Omit<import('next/server').NextResponse<unknown>, 'json'>",
  ),
);
assert(!/\bany\b/.test(generated), "Generated proxy source contains any");
assert(!generated.includes(portable(ROOT)), "Generated proxy source leaked the host path");

for (const fixture of NEGATIVE_CASES) {
  const output = run(
    "haxe",
    ["tests/proxy/build-negative.hxml", "-D", `proxy_case=${fixture.id}`],
    1,
  );
  const { id: _id, ...expected } = fixture;
  assert.deepEqual(parseDiagnostic(output, fixture.id), expected);
  assert.equal(
    fs.existsSync(path.join(OUTPUT_ROOT, "rejected.json")),
    false,
    `${fixture.id} wrote a rejected plan`,
  );
}

console.log(
  `[proxy] OK: typed matcher/no-config plans, ${NEGATIVE_CASES.length} compile failures, strict generated TypeScript`,
);
