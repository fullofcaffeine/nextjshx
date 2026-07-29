#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import Ajv2020 from "ajv/dist/2020.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const FIXTURE_ROOT = path.join(ROOT, "tests/special-files");
const OUTPUT_ROOT = path.join(FIXTURE_ROOT, ".tmp");
const PLAN_PATH = path.join(OUTPUT_ROOT, "plan.json");
const REJECTED_PATH = path.join(OUTPUT_ROOT, "rejected.json");
const APPLICATION_PATH = path.join(OUTPUT_ROOT, "application.js");
const SNAPSHOT_PATH = path.join(ROOT, "tests/snapshots/special-file-plan-v1.json");
const SCHEMA_PATH = path.join(ROOT, "schemas/adapter-plan.schema.json");
const TYPESCRIPT_ROOT = path.join(OUTPUT_ROOT, "typescript");
const TSC_BIN = path.join(ROOT, "node_modules/typescript/bin/tsc6");
const ANSI_ESCAPE = /\x1b\[[0-?]*[ -/]*[@-~]/g;
const CHARACTER_DIAGNOSTIC =
  /^(.*):(\d+): characters (\d+)-(\d+) : \[([A-Z0-9-]+)\] (.+)$/;
const LINE_DIAGNOSTIC = /^(.*):(\d+): lines (\d+)-(\d+) : \[([A-Z0-9-]+)\] (.+)$/;
const MODE = process.argv[2] ?? "verify";

const NEGATIVE_CASES = [
  {
    id: "missing-render",
    file: "tests/special-files/src/special_files/negative/MissingRender.hx",
    line: 4,
    range: { kind: "characters", start: 1, end: 23 },
    code: "NXHX-SPECIAL-RENDER-0004",
    message:
      "Loading declaration special_files.negative.MissingRender must expose exactly one public static render function; found 0.",
  },
  {
    id: "loading-props",
    file: "tests/special-files/src/special_files/negative/LoadingProps.hx",
    line: 7,
    range: { kind: "lines", start: 7, end: 9 },
    code: "NXHX-SPECIAL-RENDER-0004",
    message:
      "Loading render special_files.negative.LoadingProps.render requires 0 arguments; found 1.",
  },
  {
    id: "error-props",
    file: "tests/special-files/src/special_files/negative/StructuralErrorProps.hx",
    line: 13,
    range: { kind: "lines", start: 13, end: 15 },
    code: "NXHX-SPECIAL-ERROR-PROPS-0005",
    message:
      "Error render props must be nextjs.app.ErrorProps so error and reset retain Next's exact client-boundary contract; found special_files.negative.ErrorPropsLookalike.",
  },
  {
    id: "async-error",
    file: "tests/special-files/src/special_files/negative/AsyncError.hx",
    line: 9,
    range: { kind: "lines", start: 9, end: 11 },
    code: "NXHX-SPECIAL-ERROR-ASYNC-0007",
    message:
      "Error render special_files.negative.AsyncError.render must be synchronous because error.tsx is a Client Component.",
  },
  {
    id: "not-found-props",
    file: "tests/special-files/src/special_files/negative/NotFoundProps.hx",
    line: 7,
    range: { kind: "lines", start: 7, end: 9 },
    code: "NXHX-SPECIAL-RENDER-0004",
    message:
      "Not-found render special_files.negative.NotFoundProps.render requires 0 arguments; found 1.",
  },
  {
    id: "return",
    file: "tests/special-files/src/special_files/negative/WrongReturn.hx",
    line: 7,
    range: { kind: "lines", start: 7, end: 9 },
    code: "NXHX-SPECIAL-RETURN-0006",
    message: "Error render must return genes.react.Element; found String.",
  },
  {
    id: "default-props",
    file: "tests/special-files/src/special_files/negative/DefaultPropsLookalike.hx",
    line: 16,
    range: { kind: "lines", start: 16, end: 18 },
    code: "NXHX-SPECIAL-DEFAULT-PROPS-0008",
    message:
      "Default render props must be nextjs.app.DefaultProps<Params> so dynamic params remain Promise-shaped; found special_files.negative.UnsafeDefaultProps.",
  },
  {
    id: "default-path",
    file: "tests/special-files/src/special_files/negative/DefaultOutsideSlot.hx",
    line: 5,
    range: { kind: "characters", start: 1, end: 15 },
    code: "NXHX-SPECIAL-DEFAULT-PATH-0009",
    message:
      '@:next.default must target the root of one named parallel slot such as "dashboard/@modal"; found "negative/default-outside-slot".',
  },
  {
    id: "default-params",
    file: "tests/special-files/src/special_files/negative/DefaultWrongParams.hx",
    line: 9,
    range: { kind: "lines", start: 9, end: 11 },
    code: "NXHX-ROUTE-PARAM-MISSING-0001",
    message:
      'Params for route "negative/[id]/@sidebar" are missing required field "id" for segment 2.',
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
  assert(validate(plan), `Special-file plan violates schema v1:\n${JSON.stringify(validate.errors, null, 2)}`);
  if (MODE === "update") {
    fs.writeFileSync(SNAPSHOT_PATH, encoded, "utf8");
  } else {
    assert.equal(
      encoded,
      fs.readFileSync(SNAPSHOT_PATH, "utf8"),
      "Special-file adapter-plan bytes drifted from the reviewed snapshot",
    );
  }
  assert.deepEqual(
    plan.intents.map((intent) => [intent.kind, intent.segmentPath, intent.targetPath]),
    [
      ["default", "proof/@modal", "proof/@modal/default.tsx"],
      ["default", "proof/[id]/@sidebar", "proof/[id]/@sidebar/default.tsx"],
      ["error", "proof/error", "proof/error/error.tsx"],
      ["loading", "proof/loading", "proof/loading/loading.tsx"],
      ["not-found", "proof/not-found", "proof/not-found/not-found.tsx"],
    ],
  );
  assert(plan.intents.every((intent) => intent.source.fieldName === "render"));
  assert(plan.intents.every((intent) => intent.exports.length === 1));
  assert(plan.intents.every((intent) => intent.exports[0].kind === "default"));
  assert(plan.intents.every((intent) => intent.exports[0].sourceField === "render"));
  assert(
    plan.intents.every((intent) =>
      intent.imports.some(
        (imported) => imported.modulePath === "react" && imported.symbol === "JSX" && imported.typeOnly,
      ),
    ),
    "Special-file plans must import React 19's module-owned JSX type namespace",
  );
  assert.deepEqual(plan.intents[0].directives, []);
  assert.deepEqual(plan.intents[1].directives, []);
  assert.deepEqual(plan.intents[2].directives, ["use client"]);
  assert.deepEqual(plan.intents[3].directives, []);
  assert.deepEqual(plan.intents[4].directives, []);
  assert.equal(plan.intents[0].exports[0].signature, "() => JSX.Element");
  assert.equal(
    plan.intents[1].exports[0].signature,
    '(props: Pick<LayoutProps<"/proof/[id]">, "params">) => Promise<JSX.Element>',
  );
  assert.equal(
    plan.intents[2].exports[0].signature,
    "(props: { error: Error & { digest?: string }; reset: () => void }) => JSX.Element",
  );
  assert.equal(plan.intents[3].exports[0].signature, "() => Promise<JSX.Element>");
  assert.equal(plan.intents[4].exports[0].signature, "() => JSX.Element");
  assert(!/\b(?:any|unknown)\b/.test(encoded), "Special-file plan contains a broad TypeScript type");
  assert(!encoded.includes("LOADING-BUSINESS"), "Loading business logic leaked into its adapter plan");
  assert(!encoded.includes("NOT-FOUND-BUSINESS"), "Not-found business logic leaked into its adapter plan");
  assert(!encoded.includes("DEFAULT-STATIC-BUSINESS"), "Default fallback business logic leaked into its adapter plan");
  assert(!encoded.includes(portable(ROOT)), "Special-file plan leaked the compiler host path");
  assert.equal(fs.existsSync(APPLICATION_PATH), false, "--no-output emitted application JavaScript");
}

function generated(relative) {
  const file = path.join(TYPESCRIPT_ROOT, relative);
  assert(fs.statSync(file).isFile(), `${relative} must be emitted by genes-ts`);
  return fs.readFileSync(file, "utf8");
}

function validateGeneratedTypescript() {
  const errorView = generated("special_files/positive/ErrorView.tsx");
  const loadingView = generated("special_files/positive/LoadingView.tsx");
  const notFoundView = generated("special_files/positive/NotFoundView.tsx");
  const defaultView = generated("special_files/positive/DefaultView.tsx");
  const emptyDefaultView = generated("special_files/positive/EmptyDefaultView.tsx");
  const defaultProps = generated("nextjs/app/DefaultProps.tsx");
  const errorProps = generated("nextjs/app/ErrorProps.tsx");

  assert(errorView.includes("static render(props: ErrorProps): JSX.Element"));
  assert(errorView.includes('onClick={props.reset}'));
  assert(errorView.includes("{props.error.message}"));
  assert(loadingView.includes("static render(): globalThis.Promise<JSX.Element>"));
  assert(notFoundView.includes("static render(): JSX.Element"));
  assert(defaultView.includes("static render(props: DefaultProps<DefaultParams>): globalThis.Promise<JSX.Element>"));
  assert(defaultView.includes("props.params.then(function (params: DefaultParams)"));
  assert(defaultView.includes("params.id"));
  assert(emptyDefaultView.includes("static render(): JSX.Element"));
  assert(defaultProps.includes("params: globalThis.Promise<Params>"));
  assert(errorProps.includes("error: Error & { digest?: string }"));
  assert(errorProps.includes("reset: () => void"));
  for (const source of [errorView, loadingView, notFoundView, defaultView, emptyDefaultView, defaultProps, errorProps]) {
    assert(!/\b(?:any|unknown)\b/.test(source), "generated special-file API contains a broad type");
    assert(!/\sas\s/.test(source), "generated special-file API contains a TypeScript assertion");
    assert(!source.includes(portable(ROOT)), "generated special-file source leaked the compiler host path");
  }

  run(process.execPath, [
    TSC_BIN,
    "--project",
    "tests/special-files/tsconfig.json",
    "--pretty",
    "false",
    "--noEmit",
  ]);
}

try {
  assert(new Set(["verify", "update"]).has(MODE), `expected verify or update mode, found ${MODE}`);
  assert(
    MODE !== "update" || !/^(?:1|true)$/i.test(process.env.CI ?? ""),
    "special-file snapshot updates are disabled in CI",
  );
  const version = runHaxe("--version", 0).trim();
  assert.equal(version, "4.3.7", `expected Haxe 4.3.7, found ${version}`);
  fs.rmSync(OUTPUT_ROOT, { recursive: true, force: true });
  fs.mkdirSync(OUTPUT_ROOT, { recursive: true });

  runHaxe("tests/special-files/build-positive.hxml", 0);
  validatePlan();
  runHaxe("tests/special-files/build-typescript.hxml", 0);
  validateGeneratedTypescript();

  for (const fixture of NEGATIVE_CASES) {
    fs.rmSync(REJECTED_PATH, { force: true });
    const output = runHaxe(
      "tests/special-files/build-negative.hxml",
      1,
      ["-D", `special_file_case=${fixture.id}`],
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

  fs.rmSync(REJECTED_PATH, { force: true });
  const resetArgument = runHaxe(
    "tests/special-files/build-negative.hxml",
    1,
    ["-D", "special_file_case=reset-argument"],
  )
    .replace(ANSI_ESCAPE, "")
    .replaceAll("\\", "/")
    .trim();
  assert.equal(
    resetArgument,
    "tests/special-files/src/special_files/negative/ResetArgument.hx:9: characters 15-23 : Too many arguments",
  );
  assert.equal(fs.existsSync(REJECTED_PATH), false, "invalid reset call emitted a rejected plan");

  console.log(
    `special-files: OK: loading/error/not-found/default plans, typed slot params, strict TypeScript, and ${NEGATIVE_CASES.length + 1} exact fail-closed diagnostics`,
  );
} catch (error) {
  console.error(`[special-files] ERROR: ${error.message}`);
  process.exitCode = 1;
}
