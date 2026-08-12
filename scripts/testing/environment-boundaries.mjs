#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const FIXTURE = path.join(ROOT, "tests/environment-boundaries");
const OUTPUT = path.join(FIXTURE, ".tmp");
const CLASSIC_OUTPUT = path.join(OUTPUT, "classic");
const NEXT_APP = path.join(FIXTURE, "next-app");
const TYPESCRIPT_OUTPUT = path.join(NEXT_APP, "generated");
const NEXT_OUTPUT = path.join(NEXT_APP, ".next");
const NATIVE_NEGATIVE_SOURCE = path.join(
  NEXT_APP,
  "negative/server-in-client.tsx",
);
const NATIVE_NEGATIVE_TARGET = path.join(NEXT_APP, "app/negative/page.tsx");
const NEXT_BIN = path.join(ROOT, "node_modules/next/dist/bin/next");
const TSC_BIN = path.join(ROOT, "node_modules/typescript/bin/tsc6");
const HAXE_VERSION = "4.3.7";
const NODE_VERSION = "20.19.3";
const GENES_VERSION = "1.50.0";
const GENES_COMMIT = "603ed8349775f86438a8b5be99cafa1a36544644";
const NEXT_VERSION = "16.2.12";
const SECRET_KEY = "NXHX_TEST_SERVER_SECRET";
const SECRET_VALUE = "nextjshx-private-boundary-sentinel-7d1f4c";
const ANSI_ESCAPE = /\x1b\[[0-?]*[ -/]*[@-~]/g;

const NEGATIVE_CASES = [
  {
    define: "client-headers",
    line:
      "tests/environment-boundaries/src/environment_boundaries/negative/ClientHeaders.hx:11: characters 10-17 : [NXHX-BOUNDARY-REQUEST-0003] client-only module environment_boundaries.negative.ClientHeaders cannot use server request/cache API nextjs.raw.Headers. Move the access into an explicit @:next.serverOnly service and pass only a validated value across a native boundary.",
  },
  {
    define: "client-server-only",
    line:
      "tests/environment-boundaries/src/environment_boundaries/negative/ClientServerOnly.hx:9: characters 10-23 : [NXHX-BOUNDARY-IMPORT-0002] client-only module environment_boundaries.negative.ClientServerOnly cannot depend directly on server-only module environment_boundaries.positive.ServerSecrets. Use the generated native boundary ref, or move target-neutral values into an explicit @:next.shared module.",
  },
  {
    define: "server-client-only",
    line:
      "tests/environment-boundaries/src/environment_boundaries/negative/ServerClientOnly.hx:9: characters 10-22 : [NXHX-BOUNDARY-IMPORT-0002] server-only module environment_boundaries.negative.ServerClientOnly cannot depend directly on client-only module environment_boundaries.positive.ClientLabels. Use the generated native boundary ref, or move target-neutral values into an explicit @:next.shared module.",
  },
  {
    define: "conflicting-boundaries",
    line:
      'tests/environment-boundaries/src/environment_boundaries/negative/ConflictingBoundaries.hx:4: characters 1-18 : [NXHX-BOUNDARY-METADATA-0001] Haxe module "environment_boundaries.negative.ConflictingBoundaries" has conflicting boundary owners environment_boundaries.negative.ConflictingBoundaries.ConflictingClient (:next.clientOnly) and environment_boundaries.negative.ConflictingBoundaries (:next.serverOnly). Split them into separate .hx modules.',
  },
];

class EnvironmentBoundaryFailure extends Error {}

function run(command, args, expectedStatus = 0, environment = {}) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    encoding: "utf8",
    env: {
      ...process.env,
      CI: "1",
      NEXT_TELEMETRY_DISABLED: "1",
      NO_COLOR: "1",
      ...environment,
    },
    maxBuffer: 32 * 1024 * 1024,
  });
  if (result.error !== undefined) {
    throw result.error;
  }
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  if (result.status !== expectedStatus) {
    throw new EnvironmentBoundaryFailure(
      `${path.basename(command)} ${args.join(" ")} exited ${result.status}; expected ${expectedStatus}:\n${output}`,
    );
  }
  return output;
}

function walk(directory) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const child = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(child));
    } else if (entry.isFile()) {
      files.push(child);
    } else {
      throw new EnvironmentBoundaryFailure(
        `generated boundary evidence cannot contain a link: ${child}`,
      );
    }
  }
  return files.sort((left, right) => left.localeCompare(right, "en"));
}

function readGenerated(relative) {
  const file = path.join(TYPESCRIPT_OUTPUT, relative);
  assert(fs.statSync(file).isFile(), `${relative} must be emitted`);
  return fs.readFileSync(file, "utf8");
}

function readClassic(relative) {
  const file = path.join(CLASSIC_OUTPUT, relative);
  assert(fs.statSync(file).isFile(), `classic ${relative} must be emitted`);
  return fs.readFileSync(file, "utf8");
}

function normalizeDiagnostic(output) {
  return output
    .replace(ANSI_ESCAPE, "")
    .replaceAll("\\", "/")
    .replaceAll(`${ROOT.replaceAll("\\", "/")}/`, "")
    .trim()
    .split(/\r?\n/)
    .map((line) => line.trimEnd());
}

function clean() {
  fs.rmSync(OUTPUT, { recursive: true, force: true });
  fs.rmSync(TYPESCRIPT_OUTPUT, { recursive: true, force: true });
  fs.rmSync(NEXT_OUTPUT, { recursive: true, force: true });
  fs.rmSync(path.join(NEXT_APP, "next-env.d.ts"), { force: true });
  fs.rmSync(path.join(NEXT_APP, "tsconfig.tsbuildinfo"), { force: true });
  fs.rmSync(NATIVE_NEGATIVE_TARGET, { force: true });
  try {
    fs.rmdirSync(path.dirname(NATIVE_NEGATIVE_TARGET));
  } catch (error) {
    if (error.code !== "ENOENT" && error.code !== "ENOTEMPTY") {
      throw error;
    }
  }
}

function verifyToolchain() {
  assert.equal(process.versions.node, NODE_VERSION);
  assert.equal(run("haxe", ["--version"]).trim(), HAXE_VERSION);
  const lock = fs.readFileSync(
    path.join(ROOT, "haxe_libraries/genes-ts.hxml"),
    "utf8",
  );
  assert(lock.includes(`genes-ts/${GENES_VERSION}/github/${GENES_COMMIT}`));
  assert(lock.includes(`-D genes-ts=${GENES_VERSION}`));
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(ROOT, "package.json"), "utf8"),
  );
  assert.equal(packageJson.devDependencies.next, NEXT_VERSION);
  assert(!lock.includes(ROOT), "genes-ts lock contains a machine-local path");
}

function treeDigest(directory) {
  return walk(directory).map((file) => {
    const relative = path.relative(directory, file).replaceAll("\\", "/");
    const digest = crypto
      .createHash("sha256")
      .update(fs.readFileSync(file))
      .digest("hex");
    return `${relative}:${digest}`;
  });
}

function compileDeterministically(hxml, output) {
  run("haxe", [hxml]);
  const first = treeDigest(output);
  run("haxe", [hxml]);
  assert.deepEqual(treeDigest(output), first, `${hxml} output drifted on rebuild`);
}

function verifyMarker(source, specifier, label) {
  const marker = `import "${specifier}"`;
  assert.equal(
    source.split(marker).length - 1,
    1,
    `${label} must contain one exact ${marker}`,
  );
  assert(
    source.indexOf(marker) < source.indexOf("export "),
    `${label} marker must remain in the ECMAScript import prologue`,
  );
  assert(!source.includes(`${marker} from`), `${label} marker gained a fake binding`);
}

function verifyGeneratedOutput() {
  const serverSecretsPath =
    "environment_boundaries/positive/ServerSecrets.ts";
  const clientLabelsPath = "environment_boundaries/positive/ClientLabels.ts";
  const serverEnvironmentPath = "nextjs/env/ServerEnvironment.ts";
  const serverSecrets = readGenerated(serverSecretsPath);
  const clientLabels = readGenerated(clientLabelsPath);
  const serverEnvironment = readGenerated(serverEnvironmentPath);
  const classicServerSecrets = readClassic(
    "environment_boundaries/positive/ServerSecrets.js",
  );
  const classicClientLabels = readClassic(
    "environment_boundaries/positive/ClientLabels.js",
  );
  const classicServerEnvironment = readClassic(
    "nextjs/env/ServerEnvironment.js",
  );

  for (const [source, specifier, label] of [
    [serverSecrets, "server-only", serverSecretsPath],
    [serverEnvironment, "server-only", serverEnvironmentPath],
    [clientLabels, "client-only", clientLabelsPath],
    [classicServerSecrets, "server-only", `classic ${serverSecretsPath}`],
    [classicServerEnvironment, "server-only", `classic ${serverEnvironmentPath}`],
    [classicClientLabels, "client-only", `classic ${clientLabelsPath}`],
  ]) {
    verifyMarker(source, specifier, label);
  }

  assert(serverEnvironment.includes('import * as NodeProcess from "node:process"'));
  assert(serverEnvironment.includes("NodeProcess.env[name]"));
  assert(!serverEnvironment.includes("return NodeProcess.env"));
  assert(serverSecrets.includes(`ServerEnvironment.get("${SECRET_KEY}")`));
  assert(
    serverSecrets.includes("ServerSecrets.initialized = true"),
    "marker injection replaced the owner's existing static initializer",
  );

  for (const [relative, source] of [
    [serverSecretsPath, serverSecrets],
    [serverEnvironmentPath, serverEnvironment],
    [clientLabelsPath, clientLabels],
  ]) {
    assert(!/\bany\b/.test(source), `${relative} contains TypeScript any`);
    assert(!source.includes("Register.unsafeCast"), `${relative} contains an unchecked cast`);
    assert(!/@ts-(?:ignore|nocheck)/.test(source), `${relative} suppresses TypeScript`);
    assert(!source.includes("next/dist/"), `${relative} imports private Next code`);
    assert(!source.includes(ROOT), `${relative} leaked the compiler host path`);
  }
}

function verifyHaxeFailures() {
  for (const fixture of NEGATIVE_CASES) {
    const output = run(
      "haxe",
      [
        "tests/environment-boundaries/build-negative.hxml",
        "-D",
        `environment_boundary_case=${fixture.define}`,
      ],
      1,
    );
    assert.deepEqual(normalizeDiagnostic(output), [fixture.line], fixture.define);
  }
}

function verifyPositiveNextBuild() {
  const output = run(
    process.execPath,
    [NEXT_BIN, "build", NEXT_APP],
    0,
    { [SECRET_KEY]: SECRET_VALUE },
  );
  assert(output.includes(`Next.js ${NEXT_VERSION}`));
  assert(output.includes("Compiled successfully"));

  const browserFiles = walk(path.join(NEXT_OUTPUT, "static/chunks")).filter(
    (file) => file.endsWith(".js"),
  );
  assert(browserFiles.length > 0, "Next emitted no browser chunks");
  const browserSource = browserFiles
    .map((file) => fs.readFileSync(file, "utf8"))
    .join("\n");
  assert(browserSource.includes("client-only-helper"));
  assert(!browserSource.includes(SECRET_KEY), "server environment key reached a browser chunk");
  assert(!browserSource.includes(SECRET_VALUE), "server environment value reached a browser chunk");

  const renderedFiles = walk(path.join(NEXT_OUTPUT, "server/app")).filter(
    (file) => file.endsWith(".html") || file.endsWith(".rsc"),
  );
  const rendered = renderedFiles
    .map((file) => fs.readFileSync(file, "utf8"))
    .join("\n");
  assert(rendered.includes("server-secret-configured"));
  assert(
    rendered.includes("server-secret-configured:yes") ||
      /server-secret-configured[^\n]{0,120}[\",]yes[\"},]/.test(rendered),
    "the server build did not observe the named environment value",
  );
}

function verifyNativeNextFailure() {
  fs.mkdirSync(path.dirname(NATIVE_NEGATIVE_TARGET), { recursive: true });
  fs.copyFileSync(NATIVE_NEGATIVE_SOURCE, NATIVE_NEGATIVE_TARGET);
  fs.rmSync(NEXT_OUTPUT, { recursive: true, force: true });
  const output = normalizeDiagnostic(
    run(process.execPath, [NEXT_BIN, "build", NEXT_APP], 1),
  ).join("\n");
  assert(output.includes("server-only"));
  assert(output.includes("ServerSecrets.ts"));
  assert(output.includes("server-in-client") || output.includes("app/negative/page.tsx"));
  assert.match(output, /cannot be imported from a Client Component module/);
}

try {
  clean();
  verifyToolchain();
  compileDeterministically(
    "tests/environment-boundaries/build-typescript.hxml",
    TYPESCRIPT_OUTPUT,
  );
  compileDeterministically(
    "tests/environment-boundaries/build-classic.hxml",
    CLASSIC_OUTPUT,
  );
  run(process.execPath, [
    TSC_BIN,
    "--project",
    "tests/environment-boundaries/next-app/tsconfig.json",
    "--pretty",
    "false",
    "--noEmit",
  ]);
  verifyGeneratedOutput();
  verifyHaxeFailures();
  verifyPositiveNextBuild();
  verifyNativeNextFailure();
  console.log(
    `environment-boundaries: OK: 6 exact marker imports in deterministic TypeScript/classic output, ${NEGATIVE_CASES.length} Haxe failures, strict TypeScript, server-secret browser exclusion, and 1 blocking native Next graph failure`,
  );
} catch (error) {
  console.error(`[environment-boundaries] ERROR: ${error.message}`);
  process.exitCode = 1;
} finally {
  clean();
}
