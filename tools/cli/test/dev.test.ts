import assert from "node:assert/strict";
import test from "node:test";

import {
  CliDiagnosticError,
  nextDevProcessArguments,
  runCli,
  runDevCommand,
  validatedNextDevArguments,
  type DevGenerationRequest,
  type DevOutputEvent,
  type DevRuntime,
  type DevShutdownSignal,
  type DevelopmentProject,
  type GenerateCommandResult,
  type HaxeWatchPlan,
  type LastGoodGeneratedTree,
  type ManagedDevProcess,
  type NextJsHxConfig,
  type NextProjectDiscovery,
  type OwnedHaxeServer,
  type WatchChange,
} from "../src/index.js";

interface ControlledProcess<T extends ManagedDevProcess> {
  readonly handle: T;
  readonly stopCount: () => number;
  readonly forceCount: () => number;
  finish(code: number, signal?: NodeJS.Signals | null): void;
}

function controlledProcess(pid: number): ControlledProcess<ManagedDevProcess> {
  let settle: ((value: { readonly code: number; readonly signal: NodeJS.Signals | null }) => void) | null = null;
  let complete = false;
  let stops = 0;
  let forces = 0;
  const exit = new Promise<{ readonly code: number; readonly signal: NodeJS.Signals | null }>((resolve) => {
    settle = resolve;
  });
  const finish = (code: number, signal: NodeJS.Signals | null = null): void => {
    if (!complete) {
      complete = true;
      settle?.(Object.freeze({ code, signal }));
    }
  };
  const handle: ManagedDevProcess = Object.freeze({
    pid,
    exit,
    async stop(): Promise<void> {
      stops += 1;
      finish(143, "SIGTERM");
      await exit;
    },
    forceStop(): void {
      forces += 1;
      finish(1, "SIGKILL");
    },
  });
  return Object.freeze({
    handle,
    finish,
    stopCount: () => stops,
    forceCount: () => forces,
  });
}

function controlledServer(pid: number, endpoint: string): ControlledProcess<OwnedHaxeServer> {
  const processHandle = controlledProcess(pid);
  return Object.freeze({
    handle: Object.freeze({
      ...processHandle.handle,
      endpoint,
      compilerCommand: Object.freeze({ command: "/fixture/native-haxe", argsPrefix: Object.freeze([]) }),
    }),
    finish: processHandle.finish,
    stopCount: processHandle.stopCount,
    forceCount: processHandle.forceCount,
  });
}

function projectFixture(root = "/fixture/app"): DevelopmentProject {
  const config: NextJsHxConfig = Object.freeze({
    schemaVersion: 1,
    appRoot: "app",
    boundaries: Object.freeze({}),
    haxe: Object.freeze({
      sourceRoots: Object.freeze(["haxe"]),
      generatedRoot: "src-gen",
      extraInputs: Object.freeze([]),
      legacyHxml: "build.hxml",
    }),
    next: Object.freeze({
      package: "next",
      typedRoutes: true,
      cacheComponents: false,
      experimentalCacheDirectives: Object.freeze([]),
    }),
    output: Object.freeze({ manifest: ".nextjshx/manifest.json", format: "project" }),
  });
  const discovery: NextProjectDiscovery = Object.freeze({
    packageRoot: root,
    workspaceRoot: root,
    packageJsonPath: `${root}/package.json`,
    configPath: `${root}/nextjshx.config.json`,
    config,
    appRoot: `${root}/app`,
    appRootRelative: "app",
    packageManager: Object.freeze({
      name: "npm",
      version: "10.8.2",
      source: "packageManager",
    }),
    nextPackage: Object.freeze({
      name: "next",
      requestedVersion: "16.2.12",
      installedVersion: "16.2.12",
      packageJsonPath: `${root}/node_modules/next/package.json`,
    }),
    configuredPaths: Object.freeze({
      hxml: `${root}/build.hxml`,
      generatedRoot: `${root}/src-gen`,
      manifest: `${root}/.nextjshx/manifest.json`,
    }),
  });
  return Object.freeze({
    discovery,
    projectRoot: root,
    hxmlPath: `${root}/build.hxml`,
    sessionHxmlPath: `${root}/session.hxml`,
    manifestPath: `${root}/.nextjshx/manifest.json`,
    haxeCommand: Object.freeze({ command: "haxe", argsPrefix: Object.freeze([]) }),
    nextCommand: Object.freeze({ command: process.execPath, argsPrefix: Object.freeze(["next-bin.js"]) }),
  });
}

function watchPlan(root: string, identity = "fixture-identity"): HaxeWatchPlan {
  return Object.freeze({
    projectRoot: root,
    identity,
    hxmlFiles: Object.freeze([`${root}/build.hxml`]),
    classPaths: Object.freeze([`${root}/src`]),
    resourceInputs: Object.freeze([]),
    exactInputs: Object.freeze([]),
    treeInputs: Object.freeze([]),
  });
}

function successfulGeneration(root: string): GenerateCommandResult {
  return Object.freeze({
    command: "generate",
    projectRoot: root,
    recovery: Object.freeze({ transactionId: null, action: "none" }),
    publication: Object.freeze({
      transactionId: null,
      action: "unchanged",
      created: Object.freeze([]),
      updated: Object.freeze([]),
      unchanged: Object.freeze(["app/page.tsx"]),
      removed: Object.freeze([]),
    }),
    blocked: Object.freeze([]),
    validation: "skipped",
  });
}

type GenerationStep = (request: DevGenerationRequest) => Promise<GenerateCommandResult>;

interface FakeDevState {
  readonly runtime: DevRuntime;
  readonly events: DevOutputEvent[];
  readonly requests: DevGenerationRequest[];
  readonly steps: GenerationStep[];
  readonly nextProcesses: Array<ControlledProcess<ManagedDevProcess>>;
  readonly servers: Array<ControlledProcess<OwnedHaxeServer>>;
  readonly watchCloseCount: () => number;
  emitWatch(change: WatchChange): void;
  emitSignal(signal: DevShutdownSignal): void;
}

function fakeRuntime(options: {
  readonly steps?: readonly GenerationStep[];
  readonly lastGood?: LastGoodGeneratedTree;
  readonly serverErrors?: readonly Error[];
} = {}): FakeDevState {
  const project = projectFixture();
  const events: DevOutputEvent[] = [];
  const requests: DevGenerationRequest[] = [];
  const steps = [...(options.steps ?? [])];
  const serverErrors = [...(options.serverErrors ?? [])];
  const nextProcesses: Array<ControlledProcess<ManagedDevProcess>> = [];
  const servers: Array<ControlledProcess<OwnedHaxeServer>> = [];
  let watchChange: ((change: WatchChange) => void) | null = null;
  let signalHandler: ((signal: DevShutdownSignal) => void) | null = null;
  let watcherCloses = 0;
  const runtime: DevRuntime = Object.freeze({
    resolveProject: () => project,
    watchPlan: () => watchPlan(project.projectRoot),
    watch(
      _plan: HaxeWatchPlan,
      onChange: (change: WatchChange) => void,
    ): { close(): void } {
      watchChange = onChange;
      return Object.freeze({
        close(): void {
          watcherCloses += 1;
        },
      });
    },
    async generate(request: DevGenerationRequest): Promise<GenerateCommandResult> {
      requests.push(request);
      const step = steps.shift();
      return step === undefined ? successfulGeneration(project.projectRoot) : await step(request);
    },
    verifyLastGood: () => options.lastGood ?? Object.freeze({
      ok: false,
      reason: "fixture has no manifest",
      manifestGeneration: null,
      generatedEntries: 0,
    }),
    async startHaxeServer(): Promise<OwnedHaxeServer> {
      const serverError = serverErrors.shift();
      if (serverError !== undefined) {
        throw serverError;
      }
      const server = controlledServer(2_000 + servers.length, `127.0.0.1:${6_000 + servers.length}`);
      servers.push(server);
      return server.handle;
    },
    startNext(): ManagedDevProcess {
      const child = controlledProcess(3_000 + nextProcesses.length);
      nextProcesses.push(child);
      return child.handle;
    },
    signals: Object.freeze({
      subscribe(handler: (signal: DevShutdownSignal) => void): () => void {
        signalHandler = handler;
        return () => {
          signalHandler = null;
        };
      },
    }),
  });
  return {
    runtime,
    events,
    requests,
    steps,
    nextProcesses,
    servers,
    watchCloseCount: () => watcherCloses,
    emitWatch(change): void {
      assert.notEqual(watchChange, null, "watcher is installed");
      watchChange?.(change);
    },
    emitSignal(signal): void {
      assert.notEqual(signalHandler, null, "signal subscription is installed");
      signalHandler?.(signal);
    },
  };
}

async function eventually(condition: () => boolean): Promise<void> {
  const deadline = Date.now() + 2_000;
  while (!condition()) {
    if (Date.now() >= deadline) {
      assert.fail("condition did not become true before the dev test deadline");
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 5));
  }
}

function usageDiagnostic(invocation: readonly string[]): boolean {
  assert.throws(
    () => validatedNextDevArguments(invocation),
    (error: unknown) =>
      error instanceof CliDiagnosticError && error.diagnostic.code === "NXHX-CLI-USAGE-0001",
  );
  return true;
}

test("Next dev flags are allowlisted and preserved byte-for-byte", () => {
  const flags = ["--turbopack", "-p", "3100", "-H", "127.0.0.1", "--inspect=127.0.0.1:9230"];
  assert.deepEqual(validatedNextDevArguments(flags), flags);
  assert(usageDiagnostic(["-p", "3000", "--port=3001"]));
  assert(usageDiagnostic(["--turbopack", "--webpack"]));
  assert(usageDiagnostic(["--port", "70000"]));
  assert(usageDiagnostic(["--experimental-upload-trace=https://example.invalid"]));
  assert(usageDiagnostic(["project-directory"]));
  assert(usageDiagnostic(["--future-next-flag"]));
});

test("the reviewed macOS pin defaults to webpack without rewriting explicit bundler choices", () => {
  assert.deepEqual(nextDevProcessArguments([], "darwin", "16.2.12"), ["--webpack"]);
  assert.deepEqual(
    nextDevProcessArguments(["-p", "3100"], "darwin", "16.2.12"),
    ["--webpack", "-p", "3100"],
  );
  for (const bundler of ["--turbo", "--turbopack", "--webpack"]) {
    assert.deepEqual(
      nextDevProcessArguments([bundler, "-p", "3100"], "darwin", "16.2.12"),
      [bundler, "-p", "3100"],
    );
  }
  assert.deepEqual(nextDevProcessArguments([], "linux", "16.2.12"), []);
  assert.deepEqual(nextDevProcessArguments([], "darwin", "16.2.11"), []);
});

test("the CLI requires the separator and streams prefixed dev output", async () => {
  let stdout = "";
  let stderr = "";
  const exit = await runCli(
    ["dev", "--", "--turbopack", "-p", "3100"],
    {
      cwd: "/fixture/app",
      stdout: (value) => { stdout += value; },
      stderr: (value) => { stderr += value; },
    },
    undefined,
    async (options) => {
      assert.deepEqual(options.nextArgs, ["--turbopack", "-p", "3100"]);
      options.emit({ source: "nextjshx", channel: "stdout", line: "ready" });
      options.emit({ source: "haxe", channel: "stderr", line: "typed failure" });
      return Object.freeze({
        command: "dev",
        projectRoot: options.start,
        nextArguments: options.nextArgs ?? Object.freeze([]),
        exitCode: 17,
      });
    },
  );
  assert.equal(exit, 17);
  assert.equal(stdout, "[nextjshx] ready\n");
  assert.equal(stderr, "[haxe] typed failure\n");

  stdout = "";
  stderr = "";
  const rejected = await runCli(
    ["dev", "--turbopack"],
    {
      cwd: "/fixture/app",
      stdout: (value) => { stdout += value; },
      stderr: (value) => { stderr += value; },
    },
  );
  assert.equal(rejected, 1);
  assert.equal(stdout, "");
  assert.match(stderr, /NXHX-CLI-USAGE-0001/);

  stdout = "";
  stderr = "";
  const rejectedForwardedJson = await runCli(
    ["dev", "--", "--json"],
    {
      cwd: "/fixture/app",
      stdout: (value) => { stdout += value; },
      stderr: (value) => { stderr += value; },
    },
  );
  assert.equal(rejectedForwardedJson, 1);
  assert.equal(stdout, "");
  assert.match(stderr, /NXHX-CLI-USAGE-0001/);
  assert.doesNotMatch(stderr, /^\s*\{/);
});

test("compile failure keeps one Next process alive and a later edit recovers", async () => {
  const state = fakeRuntime({
    steps: [
      async () => successfulGeneration("/fixture/app"),
      async () => { throw new Error("fixture Haxe type error"); },
      async () => successfulGeneration("/fixture/app"),
    ],
  });
  const running = runDevCommand({
    start: "/fixture/app",
    emit: (event) => state.events.push(event),
    runtime: state.runtime,
  });
  await eventually(() => state.nextProcesses.length === 1 && state.requests.length === 1);
  state.emitWatch({ kind: "source", path: "/fixture/app/src/Page.hx" });
  await eventually(() => state.requests.length === 2);
  assert.equal(state.nextProcesses[0]?.stopCount(), 0);
  assert(state.events.some((event) => event.line.includes("verified last-good tree")));

  state.emitWatch({ kind: "source", path: "/fixture/app/src/Page.hx" });
  await eventually(() => state.requests.length === 3);
  assert(state.events.some((event) => event.line.includes("Haxe recovered")));
  assert.equal(state.nextProcesses.length, 1, "Next is never restarted for Haxe edits");
  state.nextProcesses[0]?.finish(0);
  const result = await running;
  assert.equal(result.exitCode, 0);
  assert.equal(state.watchCloseCount(), 1);
  assert.equal(state.servers[0]?.stopCount(), 1);
});

test("an initial failure requires exact last-good state before Next starts", async () => {
  const state = fakeRuntime({
    steps: [async () => { throw new Error("initial Haxe failure"); }],
  });
  await assert.rejects(
    runDevCommand({
      start: "/fixture/app",
      emit: (event) => state.events.push(event),
      runtime: state.runtime,
    }),
    (error: unknown) =>
      error instanceof CliDiagnosticError && error.diagnostic.code === "NXHX-CLI-DEV-0010",
  );
  assert.equal(state.nextProcesses.length, 0);
  assert.equal(state.watchCloseCount(), 1);
  assert.equal(state.servers[0]?.stopCount(), 1);
  assert(state.events.some((event) => event.line.includes("no generated output was published")));
  assert(!state.events.some((event) => event.line.includes("verified last-good tree")));
});

test("an initial failure may start Next only after exact last-good verification", async () => {
  const state = fakeRuntime({
    steps: [async () => { throw new Error("fixture initial Haxe failure"); }],
    lastGood: Object.freeze({
      ok: true,
      reason: "verified",
      manifestGeneration: "fixture-generation",
      generatedEntries: 8,
    }),
  });
  const running = runDevCommand({
    start: "/fixture/app",
    emit: (event) => state.events.push(event),
    runtime: state.runtime,
  });
  await eventually(() => state.nextProcesses.length === 1);
  assert(state.events.some((event) =>
    event.line.includes("initial Haxe failure retained verified generation fixture-generation"),
  ));
  state.nextProcesses[0]?.finish(0);
  const result = await running;
  assert.equal(result.exitCode, 0);
  assert.equal(state.watchCloseCount(), 1);
  assert.equal(state.servers[0]?.stopCount(), 1);
});

test("an unavailable Haxe server falls back to one direct generation", async () => {
  const state = fakeRuntime({ serverErrors: [new Error("fixture server unavailable")] });
  const running = runDevCommand({
    start: "/fixture/app",
    emit: (event) => state.events.push(event),
    runtime: state.runtime,
  });
  await eventually(() => state.nextProcesses.length === 1 && state.requests.length === 1);
  assert.deepEqual(
    state.requests[0]?.haxeCommand,
    { command: "haxe", argsPrefix: [] },
  );
  assert(state.events.some((event) =>
    event.line.includes("Haxe server unavailable; using direct compilation"),
  ));
  assert.equal(state.servers.length, 0);
  state.nextProcesses[0]?.finish(0);
  const result = await running;
  assert.equal(result.exitCode, 0);
  assert.equal(state.watchCloseCount(), 1);
});

test("a signal during initial compilation aborts startup and cleans the owned server", async () => {
  const state = fakeRuntime({
    steps: [async (request) => await new Promise<GenerateCommandResult>((_resolve, reject) => {
      request.signal.addEventListener("abort", () => reject(new Error("fixture startup aborted")), {
        once: true,
      });
    })],
  });
  const running = runDevCommand({
    start: "/fixture/app",
    emit: (event) => state.events.push(event),
    runtime: state.runtime,
  });
  await eventually(() => state.requests.length === 1 && state.servers.length === 1);
  state.emitSignal("SIGTERM");
  const result = await running;
  assert.equal(result.exitCode, 143);
  assert.equal(state.nextProcesses.length, 0);
  assert.equal(state.servers[0]?.stopCount(), 1);
  assert.equal(state.watchCloseCount(), 1);
});

test("shutdown drops a debounced rebuild before stopping owned processes", async () => {
  const state = fakeRuntime();
  const running = runDevCommand({
    start: "/fixture/app",
    emit: (event) => state.events.push(event),
    runtime: state.runtime,
  });
  await eventually(() => state.nextProcesses.length === 1 && state.requests.length === 1);
  state.emitWatch({ kind: "source", path: "/fixture/app/src/Page.hx" });
  state.emitSignal("SIGTERM");
  const result = await running;
  await new Promise<void>((resolve) => setTimeout(resolve, 100));
  assert.equal(result.exitCode, 143);
  assert.equal(state.requests.length, 1, "no generation starts after shutdown owns the dirty loop");
  assert.equal(state.nextProcesses[0]?.stopCount(), 1);
  assert.equal(state.servers[0]?.stopCount(), 1);
});

test("a crashed owned Haxe server is replaced and signals stop only owned processes", async () => {
  const state = fakeRuntime();
  const running = runDevCommand({
    start: "/fixture/app",
    emit: (event) => state.events.push(event),
    runtime: state.runtime,
  });
  await eventually(() => state.nextProcesses.length === 1 && state.requests.length === 1);
  assert.deepEqual(
    state.requests[0]?.haxeCommand,
    { command: "/fixture/native-haxe", argsPrefix: ["--connect", "127.0.0.1:6000"] },
  );
  state.servers[0]?.finish(1);
  await eventually(() => state.servers.length === 2 && state.requests.length === 2);
  assert.deepEqual(
    state.requests[1]?.haxeCommand,
    { command: "/fixture/native-haxe", argsPrefix: ["--connect", "127.0.0.1:6001"] },
  );
  state.emitSignal("SIGTERM");
  const result = await running;
  assert.equal(result.exitCode, 143);
  assert.equal(state.nextProcesses[0]?.stopCount(), 1);
  assert.equal(state.servers[1]?.stopCount(), 1);
  assert.equal(state.watchCloseCount(), 1);
});
