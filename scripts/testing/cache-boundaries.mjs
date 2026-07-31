#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import Ajv2020 from "ajv/dist/2020.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const FIXTURE = path.join(ROOT, "tests/cache-boundaries");
const NEXT_APP = path.join(FIXTURE, "next-app");
const DIRECT_OUTPUT = path.join(FIXTURE, ".tmp/typescript");
const PLAN = path.join(FIXTURE, ".tmp/plan.json");
const REJECTED_PLAN = path.join(FIXTURE, ".tmp/rejected-plan.json");
const SCHEMA = path.join(ROOT, "schemas/adapter-plan.schema.json");
const CLI = path.join(ROOT, "tools/cli/.tmp/src/cli.js");
const NEXT = path.join(ROOT, "node_modules/next/dist/bin/next");
const NEXT_CONFIG = path.join(NEXT_APP, "next.config.mjs");
const NEXTJSHX_CONFIG = path.join(NEXT_APP, "nextjshx.config.json");
const TSCONFIG = path.join(NEXT_APP, "tsconfig.json");
const GENERATED_ADAPTERS = [
  "app/_nextjshx/cache/experimental/catalog.ts",
  "app/_nextjshx/cache/experimental/preference.ts",
  "app/_nextjshx/cache/runtime/counter.ts",
  "app/api/cache/route.ts",
  "app/layout.tsx",
  "app/module-cache/page.tsx",
  "app/page.tsx",
];
const LINKED_PACKAGES = ["next", "react", "react-dom", "typescript"];
const POSITIVE_DEFINES = [
  "genes.ts",
  "genes.ts.no_extension",
  "genes.ts.jsx_import_source=react",
  "nextjshx.cache-components",
  "nextjshx.experimental.cache-private",
  "nextjshx.experimental.cache-remote",
];
const NEGATIVE_CASES = new Map([
  [
    "request-api",
    {
      defines: ["genes.ts", "genes.ts.no_extension", "nextjshx.cache-components"],
      expected:
        "tests/cache-boundaries/negative/cache_boundaries_negative/RequestApi.hx:11: characters 25-40 : [NXHX-CACHE-REQUEST-0006] shared cache module cache_boundaries_negative.RequestApi cannot call nextjs.raw.Headers.headers directly. Read request-time values outside the ordinary/remote cached scope and pass a decoded serializable argument; use @:next.cachePrivate only with its explicit capability when direct request access is truly required.",
    },
  ],
  [
    "missing-capability",
    {
      defines: ["genes.ts", "genes.ts.no_extension"],
      expected:
        "tests/cache-boundaries/negative/cache_boundaries_negative/MissingCapability.hx:5: characters 1-13 : [NXHX-CACHE-CAPABILITY-0001] :next.cache on cache_boundaries_negative.MissingCapability requires Cache Components. Set $.next.cacheComponents to true in nextjshx.config.json; the CLI owns -D nextjshx.cache-components.",
    },
  ],
  [
    "private-capability",
    {
      defines: ["genes.ts", "genes.ts.no_extension", "nextjshx.cache-components"],
      expected:
        'tests/cache-boundaries/negative/cache_boundaries_negative/PrivateCapability.hx:5: characters 1-20 : [NXHX-CACHE-CAPABILITY-0001] :next.cachePrivate is an explicit experimental capability. Add "private" to $.next.experimentalCacheDirectives; the CLI owns -D nextjshx.experimental.cache-private.',
    },
  ],
  [
    "sync-function",
    {
      defines: ["genes.ts", "genes.ts.no_extension", "nextjshx.cache-components"],
      expected:
        "tests/cache-boundaries/negative/cache_boundaries_negative/SyncFunction.hx:7: lines 7-9 : [NXHX-CACHE-FUNCTION-0004] Cached function cache_boundaries_negative.SyncFunction.read must declare @:async so the generated directive belongs to an actual async function.",
    },
  ],
  [
    "class-argument",
    {
      defines: ["genes.ts", "genes.ts.no_extension", "nextjshx.cache-components"],
      expected:
        'tests/cache-boundaries/negative/cache_boundaries_negative/ClassArgument.hx:16: lines 16-18 : [NXHX-CACHE-SERIALIZABLE-0005] argument "session" is not a supported cached-function value: class instances and runtime containers are rejected by the closed cache contract. Found cache_boundaries_negative._ClassArgument.Session. Use primitives, arrays, plain immutable records, and string/number abstracts.',
    },
  ],
  [
    "sync-page",
    {
      defines: [
        "genes.ts",
        "genes.ts.no_extension",
        "genes.ts.jsx_import_source=react",
        "nextjshx.cache-components",
      ],
      expected:
        "tests/cache-boundaries/negative/cache_boundaries_negative/SyncPage.hx:11: lines 11-13 : [NXHX-CACHE-FUNCTION-0004] Cached Page cache_boundaries_negative.SyncPage.render must declare @:async and return Promise<Element>; file-level cache directives require async function exports.",
    },
  ],
  [
    "segment-dynamic-params",
    {
      defines: [
        "genes.ts",
        "genes.ts.no_extension",
        "genes.ts.jsx_import_source=react",
        "nextjshx.cache-components",
      ],
      expected:
        "tests/cache-boundaries/negative/cache_boundaries_negative/CacheDynamicParams.hx:11: characters 69-73 : [NXHX-SEGMENT-CACHE-COMPONENTS-0002] segment.dynamicParams is not compatible with Cache Components in Next 16.2.12. Remove it; Cache Components owns dynamic route behavior and Next retains normal dynamic-parameter behavior without this export.",
    },
  ],
  [
    "segment-revalidate",
    {
      defines: [
        "genes.ts",
        "genes.ts.no_extension",
        "genes.ts.jsx_import_source=react",
        "nextjshx.cache-components",
      ],
      expected:
        "tests/cache-boundaries/negative/cache_boundaries_negative/CacheRevalidate.hx:11: characters 66-68 : [NXHX-SEGMENT-CACHE-COMPONENTS-0002] segment.revalidate is not compatible with Cache Components in Next 16.2.12. Remove it; use cacheLife inside cached scopes and native tag or path invalidation at mutation boundaries.",
    },
  ],
  [
    "raw-implementation",
    {
      defines: ["genes.ts", "genes.ts.no_extension", "nextjshx.cache-components"],
      expected:
        "tests/cache-boundaries/negative/cache_boundaries_negative/RawImplementation.hx:14: characters 23-45 : [NXHX-BOUNDARY-IMPORT-0002] server-default module cache_boundaries_negative.RawImplementation cannot depend directly on shared cache module cache_boundaries_negative.RawImplementationOwner. Use the generated native boundary ref, or move target-neutral values into an explicit @:next.shared module.",
    },
  ],
]);
const ANSI_ESCAPE = /\x1b\[[0-?]*[ -/]*[@-~]/g;

class CacheBoundaryFailure extends Error {}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? ROOT,
    encoding: "utf8",
    env: {
      ...process.env,
      CI: "1",
      NEXT_TELEMETRY_DISABLED: "1",
      NO_COLOR: "1",
    },
    maxBuffer: 32 * 1024 * 1024,
  });
  if (result.error !== undefined) {
    throw result.error;
  }
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  const expectedStatus = options.expectedStatus ?? 0;
  if (result.status !== expectedStatus) {
    throw new CacheBoundaryFailure(
      `${path.basename(command)} ${args.join(" ")} exited ${result.status}; expected ${expectedStatus}:\n${output}`,
    );
  }
  return output;
}

function walk(directory) {
  const result = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const child = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      result.push(...walk(child));
    } else if (entry.isFile()) {
      result.push(child);
    } else {
      throw new CacheBoundaryFailure(`unexpected link or special file under ${directory}`);
    }
  }
  return result.sort((left, right) => left.localeCompare(right, "en"));
}

function treeDigest(directory) {
  return walk(directory).map((file) => {
    const relative = path.relative(directory, file).replaceAll("\\", "/");
    const digest = crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
    return `${relative}:${digest}`;
  });
}

function normalizeDiagnostic(output) {
  return output
    .replace(ANSI_ESCAPE, "")
    .replaceAll("\\", "/")
    .replaceAll(`${ROOT.replaceAll("\\", "/")}/`, "")
    .trim();
}

function removeEmptyAdapterDirectories() {
  for (const relative of [
    "app/_nextjshx/cache/experimental",
    "app/_nextjshx/cache/runtime",
    "app/_nextjshx/cache",
    "app/_nextjshx",
    "app/api/cache",
    "app/api",
    "app/module-cache",
  ]) {
    try {
      fs.rmdirSync(path.join(NEXT_APP, relative));
    } catch (error) {
      if (error.code !== "ENOENT" && error.code !== "ENOTEMPTY") {
        throw error;
      }
    }
  }
}

function clean() {
  fs.rmSync(path.join(FIXTURE, ".tmp"), { recursive: true, force: true });
  fs.rmSync(path.join(NEXT_APP, "src-gen"), { recursive: true, force: true });
  fs.rmSync(path.join(NEXT_APP, ".nextjshx"), { recursive: true, force: true });
  fs.rmSync(path.join(NEXT_APP, ".next"), { recursive: true, force: true });
  fs.rmSync(path.join(NEXT_APP, "node_modules"), { recursive: true, force: true });
  fs.rmSync(path.join(NEXT_APP, "next-env.d.ts"), { force: true });
  fs.rmSync(path.join(NEXT_APP, "tsconfig.tsbuildinfo"), { force: true });
  for (const relative of GENERATED_ADAPTERS) {
    fs.rmSync(path.join(NEXT_APP, relative), { force: true });
  }
  removeEmptyAdapterDirectories();
}

function linkDependencies() {
  const modules = path.join(NEXT_APP, "node_modules");
  fs.mkdirSync(modules, { recursive: true });
  for (const name of LINKED_PACKAGES) {
    fs.symlinkSync(path.join(ROOT, "node_modules", name), path.join(modules, name), "dir");
  }
}

function verifyToolchainAndSources() {
  assert.equal(process.versions.node, "20.19.3");
  assert.equal(run("haxe", ["--version"]).trim(), "4.3.7");
  const packageValue = JSON.parse(
    fs.readFileSync(path.join(NEXT_APP, "package.json"), "utf8"),
  );
  assert.equal(packageValue.packageManager, "npm@10.8.2");
  assert.deepEqual(packageValue.dependencies, {
    next: "16.2.12",
    react: "19.2.7",
    "react-dom": "19.2.7",
  });
  assert.deepEqual(packageValue.devDependencies, { typescript: "6.0.2" });
  const tsconfigSource = fs.readFileSync(TSCONFIG, "utf8");
  assert.equal(
    tsconfigSource.match(/"incremental"/g)?.length,
    1,
    "cache fixture tsconfig must not contain duplicate incremental keys",
  );
  const config = JSON.parse(fs.readFileSync(NEXTJSHX_CONFIG, "utf8"));
  assert.equal(config.next.cacheComponents, true);
  assert.deepEqual(config.next.experimentalCacheDirectives, ["private", "remote"]);
  for (const file of walk(path.join(NEXT_APP, "haxe")).filter((entry) => entry.endsWith(".hx"))) {
    const source = fs.readFileSync(file, "utf8");
    assert(
      !/\b(?:Dynamic|Any|untyped|cast)\b/.test(source),
      `${file} contains a broad Haxe escape`,
    );
  }
}

function verifyPlanAndDeterminism() {
  const args = [
    "tests/cache-boundaries/build-positive.hxml",
    ...POSITIVE_DEFINES.flatMap((define) => ["-D", define]),
  ];
  run("haxe", args);
  const first = treeDigest(DIRECT_OUTPUT);
  const encoded = fs.readFileSync(PLAN, "utf8");
  run("haxe", args);
  assert.deepEqual(treeDigest(DIRECT_OUTPUT), first, "cached Haxe output drifted");
  assert.equal(fs.readFileSync(PLAN, "utf8"), encoded, "cache plan drifted");

  const schema = JSON.parse(fs.readFileSync(SCHEMA, "utf8"));
  const plan = JSON.parse(encoded);
  const validate = new Ajv2020({ allErrors: true, strict: true }).compile(schema);
  assert(validate(plan), JSON.stringify(validate.errors, null, 2));
  assert.deepEqual(
    plan.intents.map((intent) => [intent.kind, intent.targetPath, intent.directives]),
    [
      ["cache-function", "_nextjshx/cache/experimental/catalog.ts", ["use cache: remote"]],
      ["cache-function", "_nextjshx/cache/experimental/preference.ts", ["use cache: private"]],
      ["cache-function", "_nextjshx/cache/runtime/counter.ts", ["use cache"]],
      ["route-handler", "api/cache/route.ts", []],
      ["layout", "layout.tsx", []],
      ["page", "module-cache/page.tsx", ["use cache"]],
      ["page", "page.tsx", []],
    ],
  );
  assert(!/\b(?:any|unknown)\b/.test(encoded));
}

function verifyNegativeControls() {
  for (const [name, fixture] of NEGATIVE_CASES) {
    fs.rmSync(REJECTED_PLAN, { force: true });
    const output = run(
      "haxe",
      [
        "tests/cache-boundaries/build-negative.hxml",
        "-D",
        `cache_boundary_case=${name}`,
        ...fixture.defines.flatMap((define) => ["-D", define]),
      ],
      { expectedStatus: 1 },
    );
    assert.equal(normalizeDiagnostic(output), fixture.expected, name);
    assert.equal(
      fs.existsSync(REJECTED_PLAN),
      false,
      `${name} emitted a rejected adapter plan`,
    );
  }
}

function generatedProof() {
  const modulePage = fs.readFileSync(
    path.join(NEXT_APP, "app/module-cache/page.tsx"),
    "utf8",
  );
  assert.equal(modulePage.split(/\r?\n/)[0], '"use cache";');
  assert(modulePage.indexOf('"use cache";') < modulePage.indexOf("import "));
  assert(modulePage.includes("export default async function NextJsHxDefault("));

  const expected = new Map([
    ["app/_nextjshx/cache/runtime/counter.ts", "use cache"],
    ["app/_nextjshx/cache/experimental/preference.ts", "use cache: private"],
    ["app/_nextjshx/cache/experimental/catalog.ts", "use cache: remote"],
  ]);
  for (const [relative, directive] of expected) {
    const adapter = fs.readFileSync(path.join(NEXT_APP, relative), "utf8");
    assert(adapter.includes("export async function"));
    assert.equal(adapter.split(JSON.stringify(directive)).length - 1, 1);
    assert(adapter.indexOf(JSON.stringify(directive)) > adapter.indexOf("export async function"));
    assert(!adapter.startsWith(JSON.stringify(directive)));
    assert(!/\b(?:any|unknown)\b/.test(adapter));
  }

  const consumer = fs.readFileSync(
    path.join(NEXT_APP, "src-gen/cache_boundaries/routes/CacheApi.tsx"),
    "utf8",
  );
  assert(consumer.includes("app/_nextjshx/cache/runtime/counter"));
  assert(!consumer.includes("import {CachedCounter}"));

  const manifest = JSON.parse(
    fs.readFileSync(path.join(NEXT_APP, ".nextjshx/manifest.json"), "utf8"),
  );
  assert.deepEqual(
    manifest.outputs.map((output) => output.path),
    GENERATED_ADAPTERS,
  );
}

function verifyProductionBuild() {
  const authoredConfig = new Map(
    [NEXT_CONFIG, NEXTJSHX_CONFIG, TSCONFIG].map((file) => [
      file,
      fs.readFileSync(file),
    ]),
  );
  run(process.execPath, ["tools/cli/scripts/ensure-build.mjs", "runtime"]);
  linkDependencies();
  const output = run(process.execPath, [CLI, "build", "--", "--turbopack"], {
    cwd: NEXT_APP,
  });
  assert(output.includes("Cache Components enabled"));
  assert(output.includes("Compiled successfully"));
  assert(output.includes("build: passed"));
  for (const [file, expected] of authoredConfig) {
    assert.deepEqual(
      fs.readFileSync(file),
      expected,
      `Next build rewrote authored configuration: ${path.relative(ROOT, file)}`,
    );
  }
  generatedProof();

  const generatedBefore = treeDigest(path.join(NEXT_APP, "src-gen"));
  const adaptersBefore = GENERATED_ADAPTERS.map((relative) =>
    crypto
      .createHash("sha256")
      .update(fs.readFileSync(path.join(NEXT_APP, relative)))
      .digest("hex"),
  );
  const regenerate = run(process.execPath, [CLI, "generate"], { cwd: NEXT_APP });
  assert(regenerate.includes("unchanged (7)"));
  assert.deepEqual(treeDigest(path.join(NEXT_APP, "src-gen")), generatedBefore);
  assert.deepEqual(
    GENERATED_ADAPTERS.map((relative) =>
      crypto
        .createHash("sha256")
        .update(fs.readFileSync(path.join(NEXT_APP, relative)))
        .digest("hex"),
    ),
    adaptersBefore,
  );
}

async function reservePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  assert(typeof address === "object" && address !== null);
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  return address.port;
}

async function waitForServer(port) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/cache?key=ready`, {
        signal: AbortSignal.timeout(2_000),
      });
      if (response.ok) {
        return;
      }
    } catch {
      // The production server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new CacheBoundaryFailure("production server did not become ready");
}

async function stopServer(child, exitPromise) {
  if (child.exitCode === null && child.signalCode === null) {
    child.kill("SIGTERM");
    await Promise.race([
      exitPromise,
      new Promise((resolve) => setTimeout(resolve, 5_000)),
    ]);
  }
  if (child.exitCode === null && child.signalCode === null) {
    child.kill("SIGKILL");
    await exitPromise;
  }
}

async function jsonRequest(url, init) {
  const response = await fetch(url, init);
  assert.equal(response.status, 200, `${init?.method ?? "GET"} ${url}`);
  assert.match(response.headers.get("content-type") ?? "", /^application\/json/);
  return response.json();
}

async function verifyRuntimeCaching() {
  const port = await reservePort();
  const child = spawn(
    process.execPath,
    [NEXT, "start", ".", "-H", "127.0.0.1", "-p", String(port)],
    {
      cwd: NEXT_APP,
      env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let serverOutput = "";
  child.stdout.on("data", (chunk) => {
    serverOutput += chunk;
  });
  child.stderr.on("data", (chunk) => {
    serverOutput += chunk;
  });
  const exitPromise = new Promise((resolve) => child.once("exit", resolve));
  try {
    await waitForServer(port);
    const base = `http://127.0.0.1:${port}/api/cache`;
    const first = await jsonRequest(`${base}?key=alpha`);
    const repeated = await jsonRequest(`${base}?key=alpha`);
    const distinct = await jsonRequest(`${base}?key=beta`);
    assert.deepEqual(repeated, first, "same cache key recomputed unexpectedly");
    assert.equal(first.key, "alpha");
    assert.equal(distinct.key, "beta");
    assert(distinct.invocation > first.invocation, "distinct cache key reused alpha data");

    const receipt = await jsonRequest(base, { method: "POST" });
    assert.deepEqual(receipt, { ok: true });
    const invalidated = await jsonRequest(`${base}?key=alpha`);
    assert.equal(invalidated.key, "alpha");
    assert(
      invalidated.invocation > distinct.invocation,
      "revalidateTag did not expire the tagged cached value",
    );
  } finally {
    await stopServer(child, exitPromise);
  }
  assert(serverOutput.includes("Ready"));
  assert(!serverOutput.includes("Error:"), serverOutput);
}

try {
  clean();
  verifyToolchainAndSources();
  verifyPlanAndDeterminism();
  verifyNegativeControls();
  verifyProductionBuild();
  await verifyRuntimeCaching();
  console.log(
    `cache-boundaries: OK: deterministic module/function directives, ${NEGATIVE_CASES.size} exact Haxe failures, strict Next build, cache-key reuse, and tag invalidation`,
  );
} catch (error) {
  console.error(`[cache-boundaries] ERROR: ${error.message}`);
  process.exitCode = 1;
} finally {
  clean();
}
