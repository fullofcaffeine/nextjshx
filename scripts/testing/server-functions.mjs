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
import { chromium } from "playwright-core";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const FIXTURE = path.join(ROOT, "tests/server-functions");
const NEXT_APP = path.join(FIXTURE, "next-app");
const DIRECT_OUTPUT = path.join(FIXTURE, ".tmp/typescript");
const PLAN = path.join(FIXTURE, ".tmp/plan.json");
const REJECTED_PLAN = path.join(FIXTURE, ".tmp/rejected-plan.json");
const SCHEMA = path.join(ROOT, "schemas/adapter-plan.schema.json");
const CLI = path.join(ROOT, "tools/cli/.tmp/src/cli.js");
const NEXT = path.join(ROOT, "node_modules/next/dist/bin/next");
const GENERATED_ADAPTERS = [
  "app/actions/todos.ts",
  "app/components/TodoActionForm.tsx",
  "app/layout.tsx",
  "app/page.tsx",
];
const LINKED_PACKAGES = ["next", "react", "react-dom", "typescript"];
const ANSI_ESCAPE = /\x1b\[[0-?]*[ -/]*[@-~]/g;

const NEGATIVE_CASES = new Map([
  [
    "sync-action",
    "tests/server-functions/negative/server_functions_negative/SyncAction.hx:8: lines 8-10 : [NXHX-SERVER-FUNCTION-ASYNC-0004] Server Function server_functions_negative.SyncAction.save must declare @:async so the emitted export is an actual async function.",
  ],
  [
    "class-argument",
    'tests/server-functions/negative/server_functions_negative/ClassArgument.hx:13: characters 2-69 : [NXHX-SERVER-FUNCTION-SERIALIZABLE-0005] argument "session" is not a supported native Server Function value: class instances and runtime containers do not have a stable native action encoding. Found server_functions_negative._ClassArgument.ActionSession. Use primitives, arrays, plain immutable records, string/number abstracts, and top-level WebFormData action input.',
  ],
  [
    "unknown-result",
    "tests/server-functions/negative/server_functions_negative/UnknownResult.hx:10: lines 10-12 : [NXHX-SERVER-FUNCTION-SERIALIZABLE-0005] result is not a supported native Server Function value: broad values must be decoded before crossing the action boundary. Found genes.ts.Unknown. Use primitives, arrays, plain immutable records, string/number abstracts, and top-level WebFormData action input.",
  ],
  [
    "optional-argument",
    'tests/server-functions/negative/server_functions_negative/OptionalArgument.hx:9: characters 2-61 : [NXHX-SERVER-FUNCTION-TYPE-0004] Server Function argument "value" must be required and have no default value.',
  ],
  [
    "bad-path",
    'tests/server-functions/negative/server_functions_negative/BadPath.hx:5: characters 24-39 : [NXHX-SERVER-FUNCTION-PATH-0002] Server Function adapter path "actions/route" would collide with Next App Router convention file route.tsx. Choose an action-specific filename.',
  ],
  [
    "unmarked-public",
    "tests/server-functions/negative/server_functions_negative/UnmarkedPublic.hx:5: characters 2-41 : [NXHX-SERVER-FUNCTION-EXPORT-0003] Public Server Function field server_functions_negative.UnmarkedPublic.helper must declare exactly one @:next.action annotation or be private.",
  ],
  [
    "invalid-ref",
    "tests/server-functions/negative/server_functions_negative/InvalidRef.hx:15: characters 35-55 : [NXHX-SERVER-FUNCTION-REF-0006] server_functions_negative.OrdinaryActions is not annotated with @:next.serverFunctions.",
  ],
  [
    "raw-action-client",
    "tests/server-functions/negative/server_functions_negative/RawActionClient.hx:12: characters 3-13 : [NXHX-BOUNDARY-IMPORT-0002] client module server_functions_negative.RawActionClient cannot depend directly on Server Function module server_functions_negative.raw.RawActions. Use the generated native boundary ref, or move target-neutral values into an explicit @:next.shared module.",
  ],
  [
    "private-witness",
    "tests/server-functions/negative/server_functions_negative/PrivateWitness.hx:10: characters 10-66 : Cannot access private constructor of nextjs.server.Authorized",
  ],
  [
    "wrong-operation",
    "tests/server-functions/negative/server_functions_negative/WrongOperation.hx:13: characters 10-20 : error: server_functions_negative.CreateOperation should be server_functions_negative.RemoveOperation\ntests/server-functions/negative/server_functions_negative/WrongOperation.hx:13: characters 10-20 : ... have: nextjs.server.Authorized<server_functions_negative.CreateOperation, ..., ..., ...>\ntests/server-functions/negative/server_functions_negative/WrongOperation.hx:13: characters 10-20 : ... want: nextjs.server.Authorized<server_functions_negative.RemoveOperation, ..., ..., ...>",
  ],
  [
    "missing-authorizer",
    "tests/server-functions/negative/server_functions_negative/MissingAuthorizer.hx:23: lines 23-33 : Object requires field authorize\ntests/server-functions/negative/server_functions_negative/MissingAuthorizer.hx:23: lines 23-33 : ... For function argument 'spec'",
  ],
  [
    "witness-result",
    "tests/server-functions/negative/server_functions_negative/WitnessResult.hx:13: characters 2-98 : [NXHX-SERVER-FUNCTION-SERIALIZABLE-0005] result is not a supported native Server Function value: class instances and runtime containers do not have a stable native action encoding. Found nextjs.server.Authorized<server_functions_negative.WitnessOperation, String, String, String>. Use primitives, arrays, plain immutable records, string/number abstracts, and top-level WebFormData action input.",
  ],
  [
    "broad-operation",
    "tests/server-functions/negative/server_functions_negative/BroadOperation.hx:6: characters 55-61 : Constraint check failure for nextjs.server.Authorized.Operation\ntests/server-functions/negative/server_functions_negative/BroadOperation.hx:6: characters 55-61 : ... String should be nextjs.server.ActionOperation",
  ],
]);

class ServerFunctionFailure extends Error {}

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
    throw new ServerFunctionFailure(
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
      throw new ServerFunctionFailure(`unexpected link or special file under ${directory}`);
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
  for (const directory of ["app/actions", "app/components", "app"]) {
    try {
      fs.rmdirSync(path.join(NEXT_APP, directory));
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
  assert.deepEqual(packageValue.dependencies, {
    next: "16.2.12",
    react: "19.2.7",
    "react-dom": "19.2.7",
  });
  assert.deepEqual(packageValue.devDependencies, { typescript: "6.0.2" });
  const positiveHaxe = walk(path.join(NEXT_APP, "haxe"));
  for (const file of positiveHaxe.filter((entry) => entry.endsWith(".hx"))) {
    const source = fs.readFileSync(file, "utf8");
    assert(
      !/\b(?:Dynamic|Any|untyped|cast)\b/.test(source),
      `${file} contains a broad Haxe escape`,
    );
  }
}

function verifyPlanAndDeterminism() {
  run("haxe", ["tests/server-functions/build-positive.hxml"]);
  const first = treeDigest(DIRECT_OUTPUT);
  const encoded = fs.readFileSync(PLAN, "utf8");
  run("haxe", ["tests/server-functions/build-positive.hxml"]);
  assert.deepEqual(
    treeDigest(DIRECT_OUTPUT),
    first,
    "Server Function Haxe output drifted on rebuild",
  );
  assert.equal(
    fs.readFileSync(PLAN, "utf8"),
    encoded,
    "Server Function adapter plan drifted on rebuild",
  );

  const schema = JSON.parse(fs.readFileSync(SCHEMA, "utf8"));
  const plan = JSON.parse(encoded);
  const validate = new Ajv2020({ allErrors: true, strict: true }).compile(schema);
  assert(validate(plan), JSON.stringify(validate.errors, null, 2));
  assert.deepEqual(
    plan.intents.map((intent) => [intent.kind, intent.targetPath]),
    [
      ["server-function", "actions/todos.ts"],
      ["client-component", "components/TodoActionForm.tsx"],
      ["layout", "layout.tsx"],
      ["page", "page.tsx"],
    ],
  );
  const action = plan.intents[0];
  assert.deepEqual(action.directives, ["use server"]);
  assert.deepEqual(
    action.exports.map((entry) => entry.name),
    ["save", "summarize"],
  );
  for (const exported of action.exports) {
    assert.equal(exported.kind, "named");
    assert.equal(exported.name, exported.sourceField);
    assert.equal(
      exported.signature,
      `(...args: Parameters<typeof TodoActions.${exported.name}>) => Promise<Awaited<ReturnType<typeof TodoActions.${exported.name}>>>`,
    );
  }
  assert(!/\b(?:any|unknown)\b/.test(encoded));

  const client = fs.readFileSync(
    path.join(DIRECT_OUTPUT, "server_functions/client/TodoActionForm.tsx"),
    "utf8",
  );
  assert(client.includes("next-app/app/actions/todos"));
  assert(client.includes("(formData: globalThis.FormData) => Promise<void>"));
  assert(!client.includes("server_functions/actions/TodoActions"));
  const implementation = fs.readFileSync(
    path.join(DIRECT_OUTPUT, "server_functions/actions/TodoActions.tsx"),
    "utf8",
  );
  assert(implementation.includes("static async save(formData: globalThis.FormData)"));
  assert(implementation.includes("static async summarize(draft: TodoDraft)"));
  assert(implementation.includes("return GuardedAction.run("));
  assert(implementation.includes('"authenticate": GuardedTodoPolicy.currentActor'));
  assert(implementation.includes('"authorize": GuardedTodoPolicy.authorize'));
  assert(implementation.includes('"execute": GuardedTodoService.save'));
  assert(!/\bany\b/.test(implementation));

  const guarded = fs.readFileSync(
    path.join(DIRECT_OUTPUT, "nextjs/server/GuardedAction.tsx"),
    "utf8",
  );
  assert(guarded.includes('import "server-only"'));
  assert(guarded.includes("const decision: AuthorizationDecision = await spec.authorize("));
  assert(guarded.includes("new Authorized<Operation, Actor, Target, Input>"));
  assert(!/\b(?:any|unknown)\b/.test(guarded));

  const authorized = fs.readFileSync(
    path.join(DIRECT_OUTPUT, "nextjs/server/Authorized.tsx"),
    "utf8",
  );
  assert(authorized.includes('import "server-only"'));
  assert(!/\b(?:any|unknown)\b/.test(authorized));

  const service = fs.readFileSync(
    path.join(DIRECT_OUTPUT, "server_functions/security/GuardedTodoService.tsx"),
    "utf8",
  );
  assert.equal(service.split(/\r?\n/)[1], 'import "server-only"');
  assert(service.includes("Authorized<SaveTodoOperation, GuardedActor, WorkspaceTarget, SaveTodoInput>"));
  assert(service.includes('"auditSecret": "server-only-audit-secret"'));
  assert(!/\b(?:any|unknown)\b/.test(service));
}

function verifyNegativeControls() {
  for (const [name, expected] of NEGATIVE_CASES) {
    fs.rmSync(REJECTED_PLAN, { force: true });
    const output = run(
      "haxe",
      [
        "tests/server-functions/build-negative.hxml",
        "-D",
        `server_function_case=${name}`,
      ],
      { expectedStatus: 1 },
    );
    assert.equal(normalizeDiagnostic(output), expected, name);
    assert.equal(
      fs.existsSync(REJECTED_PLAN),
      false,
      `${name} emitted a rejected adapter plan`,
    );
  }
}

function verifyGuardedRuntime() {
  run("haxe", ["tests/server-functions/build-security-runtime.hxml"]);
  const output = run(process.execPath, [
    "--no-warnings",
    "tests/server-functions/.tmp/security-runtime.js",
  ]);
  assert.equal(
    output.trim(),
    "guarded-action-runtime: OK: ordered authorization and fail-closed projection",
  );
}

function generatedProof() {
  const action = fs.readFileSync(
    path.join(NEXT_APP, "app/actions/todos.ts"),
    "utf8",
  );
  assert.equal(action.split(/\r?\n/)[0], '"use server";');
  assert.equal(action.split('"use server";').length - 1, 1);
  assert(action.indexOf('"use server";') < action.indexOf("import "));
  assert(action.includes("export async function save("));
  assert(action.includes("Parameters<typeof TodoActions.save>"));
  assert(action.includes("Promise<Awaited<ReturnType<typeof TodoActions.save>>>"));
  assert(!action.includes("GuardedAction"));
  assert(!action.includes("GuardedTodoPolicy"));
  assert(!action.includes("server-only-audit-secret"));
  assert(!/\b(?:any|unknown)\b/.test(action));

  const client = fs.readFileSync(
    path.join(NEXT_APP, "src-gen/server_functions/client/TodoActionForm.tsx"),
    "utf8",
  );
  assert(client.includes('from "../../../app/actions/todos"'));
  assert(!client.includes("server_functions/actions/TodoActions"));
  assert(!client.includes("GuardedTodoPolicy"));
  assert(!client.includes("server-only-audit-secret"));
  const boundary = fs.readFileSync(
    path.join(NEXT_APP, "app/components/TodoActionForm.tsx"),
    "utf8",
  );
  assert.equal(boundary.split(/\r?\n/)[0], '"use client";');

  const manifest = JSON.parse(
    fs.readFileSync(path.join(NEXT_APP, ".nextjshx/manifest.json"), "utf8"),
  );
  assert.deepEqual(
    manifest.outputs.map((output) => output.path),
    GENERATED_ADAPTERS,
  );
}

function verifyProductionBuild() {
  run("npm", ["run", "build", "--workspace", "@nextjshx/cli-internal"]);
  linkDependencies();
  const output = run(process.execPath, [CLI, "build", "--", "--turbopack"], {
    cwd: NEXT_APP,
  });
  assert(output.includes("Compiled successfully"));
  assert(output.includes("build: passed"));
  generatedProof();

  const generatedBefore = treeDigest(path.join(NEXT_APP, "src-gen"));
  const adaptersBefore = GENERATED_ADAPTERS.map((relative) =>
    crypto
      .createHash("sha256")
      .update(fs.readFileSync(path.join(NEXT_APP, relative)))
      .digest("hex"),
  );
  const regenerate = run(process.execPath, [CLI, "generate"], { cwd: NEXT_APP });
  assert(regenerate.includes("unchanged (4)"));
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

async function browserExecutable() {
  const configured = process.env.NEXTJSHX_CHROME;
  const candidates = [
    configured,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ].filter((candidate) => candidate !== undefined);
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  throw new ServerFunctionFailure(
    "no Chrome/Chromium executable found; configure NEXTJSHX_CHROME",
  );
}

async function waitForServer(port) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/`, {
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
  throw new ServerFunctionFailure("production server did not become ready");
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

async function verifyNativeSubmission() {
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
    const browser = await chromium.launch({
      executablePath: await browserExecutable(),
      headless: true,
      args: ["--disable-dev-shm-usage", "--no-sandbox"],
    });
    try {
      const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
      const origin = `http://127.0.0.1:${port}`;
      const actionBodies = [];
      await context.route("**/*", async (route) => {
        const request = route.request();
        if (request.method() !== "POST" || new URL(request.url()).origin !== origin) {
          await route.continue();
          return;
        }

        // Buffer the exact upstream Next response before fulfilling it back to
        // the browser. Chromium can discard a streamed Server Function CDP
        // resource before Response.text() runs; route.fetch() keeps the native
        // request and response bytes while making the disclosure assertion
        // deterministic.
        const upstream = await route.fetch();
        actionBodies.push((await upstream.body()).toString("utf8"));
        await route.fulfill({ response: upstream });
      });
      const sessionCookie = "nextjshx-guarded-session";
      const titleCookie = "nextjshx-action-title";
      const versionCookie = "nextjshx-workspace-version";
      await context.addCookies([
        {
          name: sessionCookie,
          value: "session-actor-a",
          url: origin,
          httpOnly: true,
          sameSite: "Lax",
        },
      ]);
      const page = await context.newPage();
      const pageErrors = [];
      const consoleErrors = [];
      const failedResponses = [];
      page.on("pageerror", (error) => pageErrors.push(error.message));
      page.on("console", (message) => {
        if (message.type() === "error") {
          consoleErrors.push(message.text());
        }
      });
      page.on("response", (response) => {
        if (response.status() >= 400) {
          failedResponses.push(`${response.status()} ${response.url()}`);
        }
      });
      await page.goto(`${origin}/`, {
        waitUntil: "networkidle",
        timeout: 20_000,
      });
      const status = page.locator("#submitted-title");
      await status.waitFor({ state: "visible" });
      assert.equal(await status.textContent(), "No submitted title");
      assert.equal(await page.locator("#todo-action-version").getAttribute("value"), "1");

      const submit = async () => {
        const actionResponsePromise = page.waitForResponse(
          (response) => response.request().method() === "POST",
        );
        await page.locator("#todo-action-submit").click();
        return actionResponsePromise;
      };
      const cookieValue = async (name) => {
        const cookies = await context.cookies(origin);
        const value = cookies.find((cookie) => cookie.name === name)?.value;
        return value === undefined ? undefined : decodeURIComponent(value);
      };

      await page.locator("#todo-action-title").fill("Typed through native FormData");
      const actionResponse = await submit();
      assert(
        actionResponse.ok(),
        `Server Function POST returned ${actionResponse.status()}; server output:\n${serverOutput}`,
      );
      assert.equal(await cookieValue(titleCookie), "Typed through native FormData");
      assert.equal(await cookieValue(versionCookie), "2");
      await page.reload({ waitUntil: "networkidle" });
      assert.equal(await status.textContent(), "Typed through native FormData");
      assert.equal(await page.locator("#todo-action-version").getAttribute("value"), "2");
      const cookies = await context.cookies(origin);
      const actionCookie = cookies.find((cookie) => cookie.name === titleCookie);
      assert(actionCookie !== undefined);
      assert.equal(actionCookie.httpOnly, true);
      assert.equal(actionCookie.sameSite, "Lax");

      // A caller tampers with the UI-owned workspace identifier. The direct
      // native action POST reaches the same exact-target policy and fails closed.
      await page.locator("#todo-action-workspace").evaluate((element) => {
        element.value = "workspace-b";
      });
      await page.locator("#todo-action-title").fill("Cross-tenant overwrite");
      const unauthorized = await submit();
      assert(unauthorized.ok());
      assert.equal(await cookieValue(titleCookie), "Typed through native FormData");
      assert.equal(await cookieValue(versionCookie), "2");

      // Replaying the former resource version is denied before mutation.
      await page.locator("#todo-action-workspace").evaluate((element) => {
        element.value = "workspace-a";
      });
      await page.locator("#todo-action-version").evaluate((element) => {
        element.value = "1";
      });
      await page.locator("#todo-action-title").fill("Stale overwrite");
      const stale = await submit();
      assert(stale.ok());
      assert.equal(await cookieValue(titleCookie), "Typed through native FormData");
      assert.equal(await cookieValue(versionCookie), "2");

      // A malformed target never reaches identity or mutation callbacks.
      await page.locator("#todo-action-workspace").evaluate((element) => {
        element.value = "../../invalid";
      });
      await page.locator("#todo-action-title").fill("Malformed overwrite");
      const malformed = await submit();
      assert(malformed.ok());
      assert.equal(await cookieValue(titleCookie), "Typed through native FormData");

      // The UI was rendered for an authenticated actor. Removing the
      // request-local session before submitting the still-present form proves
      // that a direct POST does not inherit authority from rendered UI state.
      await page.locator("#todo-action-workspace").evaluate((element) => {
        element.value = "workspace-a";
      });
      await page.locator("#todo-action-version").evaluate((element) => {
        element.value = "2";
      });
      await page.locator("#todo-action-title").fill("Unauthenticated overwrite");
      await context.clearCookies({ name: sessionCookie });
      const unauthenticated = await submit();
      assert(unauthenticated.ok());
      assert.equal(await cookieValue(titleCookie), "Typed through native FormData");
      await page.reload({ waitUntil: "networkidle" });
      await page.locator("#guarded-signed-out").waitFor({ state: "visible" });
      assert.equal(await page.locator("#todo-action-form").count(), 0);

      assert.deepEqual(pageErrors, []);
      assert.deepEqual(
        consoleErrors,
        [],
        `browser console errors; failed responses: ${failedResponses.join(", ")}`,
      );
      assert.deepEqual(failedResponses, []);

      // Next's configured raw body limit rejects transport before the decoder
      // or guarded application flow. It is native framework evidence, not a
      // replacement for the closed field/value checks above.
      await context.addCookies([
        {
          name: sessionCookie,
          value: "session-actor-a",
          url: origin,
          httpOnly: true,
          sameSite: "Lax",
        },
      ]);
      await page.reload({ waitUntil: "networkidle" });
      await page.locator("#todo-action-title").evaluate((element) => {
        element.removeAttribute("maxlength");
        element.value = "x".repeat(6_000);
      });
      const oversized = await submit();
      assert.equal(oversized.ok(), false);
      assert.equal(await cookieValue(titleCookie), "Typed through native FormData");
      assert.equal(actionBodies.length, 6, "did not capture every native action response");
      assert.equal(
        actionBodies.some((body) => body.includes("server-only-audit-secret")),
        false,
        "a native action response exposed the server-only audit secret",
      );
    } finally {
      await browser.close();
    }
  } finally {
    await stopServer(child, exitPromise);
  }
  assert(serverOutput.includes("Ready"));
  assert.match(serverOutput, /Body exceeded 2kb limit/i);
}

try {
  clean();
  verifyToolchainAndSources();
  verifyPlanAndDeterminism();
  verifyNegativeControls();
  verifyGuardedRuntime();
  verifyProductionBuild();
  await verifyNativeSubmission();
  console.log(
    `server-functions: OK: guarded ordering/projection, deterministic native adapters/refs, ${NEGATIVE_CASES.size} exact Haxe failures, strict Next production build, and direct FormData policy controls`,
  );
} catch (error) {
  console.error(`[server-functions] ERROR: ${error.message}`);
  process.exitCode = 1;
} finally {
  clean();
}
