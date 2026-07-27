import { createHash } from "node:crypto";
import process from "node:process";
import { Worker } from "node:worker_threads";

import { cliFailure } from "./cli-diagnostic.js";
import {
  type CommandRuntime,
  type DevelopmentProject,
  type GenerateCommandResult,
  type LastGoodGeneratedTree,
  type ToolCommand,
  resolveDevelopmentProject,
  verifyLastGoodGeneratedTree,
} from "./commands.js";
import { SerializedDirtyLoop } from "./dev-loop.js";
import {
  type DevOutputEmitter,
  type DevProcessExit,
  type ManagedDevProcess,
  type OwnedHaxeServer,
  startManagedProcess,
  startOwnedHaxeServer,
} from "./dev-process.js";
import type { DevWorkerMessage } from "./dev-worker.js";
import {
  type HaxeWatchPlan,
  type WatchChange,
  type WatchChangeKind,
  type WatchSession,
  createHaxeWatchPlan,
  watchHaxeInputs,
} from "./watch-inputs.js";

const NEXT_DEV_BOOLEAN_FLAGS = new Map<string, string>([
  ["--disable-source-maps", "disable-source-maps"],
  ["--experimental-cpu-prof", "experimental-cpu-prof"],
  ["--experimental-https", "experimental-https"],
  ["--experimental-next-config-strip-types", "experimental-next-config-strip-types"],
  ["--no-server-fast-refresh", "no-server-fast-refresh"],
  ["--turbo", "bundler"],
  ["--turbopack", "bundler"],
  ["--webpack", "bundler"],
]);
const NEXT_DEV_VALUE_FLAGS = new Map<string, string>([
  ["-H", "hostname"],
  ["--hostname", "hostname"],
  ["--experimental-https-ca", "experimental-https-ca"],
  ["--experimental-https-cert", "experimental-https-cert"],
  ["--experimental-https-key", "experimental-https-key"],
  ["-p", "port"],
  ["--port", "port"],
]);
const CONNECTION_FAILURE =
  /(?:couldn['’]?t connect|connection (?:refused|reset)|connect econn|failed to connect|server.*(?:closed|unavailable))/i;

export interface DevCommandOptions {
  readonly start: string;
  readonly configPath?: string;
  readonly nextArgs?: readonly string[];
  readonly commandRuntime?: CommandRuntime;
  readonly emit: DevOutputEmitter;
  readonly runtime?: DevRuntime;
}

export interface DevCommandResult {
  readonly command: "dev";
  readonly projectRoot: string;
  readonly nextArguments: readonly string[];
  readonly exitCode: number;
}

export interface DevGenerationRequest {
  readonly start: string;
  readonly configPath?: string;
  readonly haxeCommand: ToolCommand;
  readonly signal: AbortSignal;
  readonly emit: DevOutputEmitter;
}

export type DevShutdownSignal = "SIGINT" | "SIGTERM" | "SIGHUP";

export interface DevSignalSource {
  subscribe(handler: (signal: DevShutdownSignal) => void): () => void;
}

export interface DevRuntime {
  resolveProject(options: DevCommandOptions): DevelopmentProject;
  watchPlan(project: DevelopmentProject): HaxeWatchPlan;
  watch(
    plan: HaxeWatchPlan,
    onChange: (change: WatchChange) => void,
    onError: (error: Error) => void,
  ): WatchSession;
  generate(request: DevGenerationRequest): Promise<GenerateCommandResult>;
  verifyLastGood(options: DevCommandOptions): LastGoodGeneratedTree;
  startHaxeServer(
    command: ToolCommand,
    cwd: string,
    emit: DevOutputEmitter,
  ): Promise<OwnedHaxeServer>;
  startNext(
    project: DevelopmentProject,
    args: readonly string[],
    emit: DevOutputEmitter,
  ): ManagedDevProcess;
  readonly signals: DevSignalSource;
}

class DevGenerationFailure extends Error {
  readonly diagnostic: object;
  readonly output: string;

  constructor(message: string, diagnostic: object, output: string) {
    super(message);
    this.name = "DevGenerationFailure";
    this.diagnostic = diagnostic;
    this.output = output;
  }
}

class DevGenerationAborted extends Error {
  constructor() {
    super("development generation aborted");
    this.name = "DevGenerationAborted";
  }
}

function usageFailure(message: string, actual: string): never {
  cliFailure(
    "NXHX-CLI-USAGE-0001",
    message,
    "next dev arguments",
    "reviewed Next 16.2.12 dev flags after one -- separator",
    actual,
    "Run nextjshx --help, remove ambiguous input, and retry.",
  );
}

/** Validate without rewriting: the returned argument bytes preserve user order. */
export function validatedNextDevArguments(args: readonly string[]): readonly string[] {
  const seen = new Set<string>();
  let bundler: string | null = null;
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index] as string;
    if (argument === "--experimental-upload-trace" || argument.startsWith("--experimental-upload-trace=")) {
      usageFailure(
        "Development trace upload is disabled because Next reports that it includes sensitive data.",
        argument,
      );
    }
    const equals = argument.indexOf("=");
    const flag = equals === -1 ? argument : argument.slice(0, equals);
    const inlineValue = equals === -1 ? null : argument.slice(equals + 1);
    const booleanKey = NEXT_DEV_BOOLEAN_FLAGS.get(flag);
    if (booleanKey !== undefined) {
      if (inlineValue !== null) {
        usageFailure("A boolean Next dev flag received an unexpected value.", argument);
      }
      if (seen.has(flag)) {
        usageFailure("A Next dev flag was provided more than once.", argument);
      }
      if (booleanKey === "bundler") {
        if (bundler !== null) {
          usageFailure("Conflicting Next dev bundlers were requested.", `${bundler}, ${argument}`);
        }
        bundler = argument;
      }
      seen.add(flag);
      continue;
    }
    if (flag === "--inspect") {
      if (seen.has("inspect")) {
        usageFailure("--inspect was provided more than once.", argument);
      }
      if (inlineValue !== null && inlineValue.length === 0) {
        usageFailure("--inspect= requires a non-empty host/port value.", argument);
      }
      seen.add("inspect");
      if (
        inlineValue === null &&
        args[index + 1] !== undefined &&
        !(args[index + 1] as string).startsWith("-")
      ) {
        index += 1;
      }
      continue;
    }
    const valueKey = NEXT_DEV_VALUE_FLAGS.get(flag);
    if (valueKey !== undefined) {
      const value = inlineValue ?? args[index + 1];
      if (value === undefined || value.length === 0 || (inlineValue === null && value.startsWith("-"))) {
        usageFailure(`${flag} requires one non-empty value.`, value ?? "missing");
      }
      if (seen.has(valueKey)) {
        usageFailure(`The ${valueKey} Next dev option was provided more than once.`, argument);
      }
      if (valueKey === "port") {
        const port = Number(value);
        if (!Number.isInteger(port) || port < 1 || port > 65_535) {
          usageFailure("Next dev port must be an integer from 1 through 65535.", value);
        }
      }
      seen.add(valueKey);
      if (inlineValue === null) {
        index += 1;
      }
      continue;
    }
    usageFailure("Development received an unsupported or positional Next.js argument.", argument);
  }
  return Object.freeze([...args]);
}

/**
 * The reviewed Next 16.2.12 Turbopack build can stop invalidating even an
 * ordinary app/page.tsx under its default macOS watcher. Prefer Next's
 * supported Webpack backend only for that exact default; preserve every
 * explicit bundler choice and reevaluate the fallback with each Next pin.
 */
export function nextDevProcessArguments(
  args: readonly string[],
  platform: NodeJS.Platform = process.platform,
  nextVersion = "16.2.12",
): readonly string[] {
  const explicitBundler = args.some((argument) =>
    argument === "--turbo" || argument === "--turbopack" || argument === "--webpack",
  );
  if (
    platform === "darwin" &&
    nextVersion === "16.2.12" &&
    !explicitBundler
  ) {
    return Object.freeze(["--webpack", ...args]);
  }
  return Object.freeze([...args]);
}

function outputLines(
  value: string,
  channel: "stdout" | "stderr",
  emit: DevOutputEmitter,
): void {
  const normalized = value.replaceAll("\r\n", "\n");
  const lines = normalized.split(/[\n\r]/);
  if (lines.at(-1) === "") {
    lines.pop();
  }
  for (const line of lines) {
    emit(Object.freeze({ source: "haxe", channel, line }));
  }
}

function workerGeneration(request: DevGenerationRequest): Promise<GenerateCommandResult> {
  return new Promise<GenerateCommandResult>((resolve, reject) => {
    const worker = new Worker(new URL("./dev-worker.js", import.meta.url), {
      workerData: {
        start: request.start,
        ...(request.configPath === undefined ? {} : { configPath: request.configPath }),
        haxeCommand: request.haxeCommand,
      },
    });
    let complete = false;
    let rawOutput = "";
    const abort = (): void => {
      if (!complete) {
        complete = true;
        void worker.terminate();
        reject(new DevGenerationAborted());
      }
    };
    request.signal.addEventListener("abort", abort, { once: true });
    const finish = (): void => {
      request.signal.removeEventListener("abort", abort);
    };
    worker.on("message", (message: DevWorkerMessage) => {
      if (complete) {
        return;
      }
      if (message.kind === "output") {
        rawOutput += message.value;
        outputLines(message.value, message.channel, request.emit);
        return;
      }
      complete = true;
      finish();
      void worker.terminate();
      if (message.kind === "success") {
        resolve(message.result);
      } else {
        reject(new DevGenerationFailure(message.message, message.diagnostic, rawOutput));
      }
    });
    worker.once("error", (error) => {
      if (!complete) {
        complete = true;
        finish();
        reject(error);
      }
    });
    worker.once("exit", (code) => {
      if (!complete) {
        complete = true;
        finish();
        reject(new Error(`development generation worker exited ${code} without a result`));
      }
    });
  });
}

function defaultSignalSource(): DevSignalSource {
  return Object.freeze({
    subscribe(handler: (signal: DevShutdownSignal) => void): () => void {
      const interrupt = (): void => handler("SIGINT");
      const terminate = (): void => handler("SIGTERM");
      const hangup = (): void => handler("SIGHUP");
      process.once("SIGINT", interrupt);
      process.once("SIGTERM", terminate);
      process.once("SIGHUP", hangup);
      return () => {
        process.off("SIGINT", interrupt);
        process.off("SIGTERM", terminate);
        process.off("SIGHUP", hangup);
      };
    },
  });
}

function defaultRuntime(commandRuntime: CommandRuntime | undefined): DevRuntime {
  return Object.freeze({
    resolveProject(options: DevCommandOptions): DevelopmentProject {
      return resolveDevelopmentProject({
        start: options.start,
        ...(options.configPath === undefined ? {} : { configPath: options.configPath }),
        ...(commandRuntime === undefined ? {} : { runtime: commandRuntime }),
      });
    },
    watchPlan: (project: DevelopmentProject) => createHaxeWatchPlan(project.discovery),
    watch: watchHaxeInputs,
    generate: workerGeneration,
    verifyLastGood(options: DevCommandOptions): LastGoodGeneratedTree {
      return verifyLastGoodGeneratedTree({
        start: options.start,
        ...(options.configPath === undefined ? {} : { configPath: options.configPath }),
        ...(commandRuntime === undefined ? {} : { runtime: commandRuntime }),
      });
    },
    startHaxeServer: startOwnedHaxeServer,
    startNext(
      project: DevelopmentProject,
      args: readonly string[],
      emit: DevOutputEmitter,
    ): ManagedDevProcess {
      const processArguments = nextDevProcessArguments(
        args,
        process.platform,
        project.discovery.nextPackage.installedVersion,
      );
      if (processArguments[0] === "--webpack" && args[0] !== "--webpack") {
        friendly(
          emit,
          "Next 16.2.12 on macOS defaults to webpack for reliable native and generated Fast Refresh; pass --turbopack explicitly to opt in",
        );
      }
      return startManagedProcess(
        {
          command: project.nextCommand.command,
          args: [...project.nextCommand.argsPrefix, "dev", ".", ...processArguments],
          cwd: project.projectRoot,
          source: "next",
        },
        emit,
      );
    },
    signals: defaultSignalSource(),
  });
}

function compilerIdentity(project: DevelopmentProject, plan: HaxeWatchPlan): string {
  return createHash("sha256")
    .update(project.projectRoot)
    .update("\0")
    .update(project.haxeCommand.command)
    .update("\0")
    .update(project.haxeCommand.argsPrefix.join("\0"))
    .update("\0")
    .update(plan.identity)
    .digest("hex");
}

function connectedCommand(command: ToolCommand, server: OwnedHaxeServer | null): ToolCommand {
  return server === null
    ? command
    : Object.freeze({
        command: server.compilerCommand.command,
        argsPrefix: Object.freeze([
          ...server.compilerCommand.argsPrefix,
          "--connect",
          server.endpoint,
        ]),
      });
}

function diagnosticLabel(error: Error): string {
  if (!(error instanceof DevGenerationFailure)) {
    return error.message;
  }
  const code = "code" in error.diagnostic && typeof error.diagnostic.code === "string"
    ? error.diagnostic.code
    : "NXHX-CLI-DEV-0010";
  const message = "message" in error.diagnostic && typeof error.diagnostic.message === "string"
    ? error.diagnostic.message
    : error.message;
  return `${code}: ${message}`;
}

function mergeCause(
  left: WatchChangeKind | null,
  right: WatchChangeKind,
): WatchChangeKind {
  return left === "identity" || right === "identity" ? "identity" : "source";
}

function friendly(emit: DevOutputEmitter, line: string, channel: "stdout" | "stderr" = "stdout"): void {
  emit(Object.freeze({ source: "nextjshx", channel, line }));
}

export async function runDevCommand(options: DevCommandOptions): Promise<DevCommandResult> {
  const nextArguments = validatedNextDevArguments(options.nextArgs ?? []);
  const runtime = options.runtime ?? defaultRuntime(options.commandRuntime);
  let project = runtime.resolveProject(options);
  let plan = runtime.watchPlan(project);
  let identity = compilerIdentity(project, plan);
  let watcher: WatchSession | null = null;
  let server: OwnedHaxeServer | null = null;
  let next: ManagedDevProcess | null = null;
  let activeAbort: AbortController | null = null;
  let shuttingDown = false;
  let armed = false;
  let startupDirty: WatchChangeKind | null = null;
  let lastFailure: Error | null = null;
  let hasVerifiedLastGood = false;
  const retiringServers = new Set<number>();

  const observeServer = (candidate: OwnedHaxeServer): void => {
    void candidate.exit.then((result) => {
      if (retiringServers.has(candidate.pid)) {
        retiringServers.delete(candidate.pid);
        return;
      }
      if (!shuttingDown && server?.pid === candidate.pid) {
        server = null;
        friendly(options.emit, `owned Haxe server exited ${result.code}; the next rebuild will recover with a bounded direct compile`, "stderr");
        loop.request("identity");
      }
    });
  };

  const stopServer = async (): Promise<void> => {
    const current = server;
    server = null;
    if (current !== null) {
      retiringServers.add(current.pid);
      await current.stop();
    }
  };

  const ensureServer = async (): Promise<void> => {
    if (server !== null || shuttingDown) {
      return;
    }
    try {
      const started = await runtime.startHaxeServer(
        project.haxeCommand,
        project.projectRoot,
        options.emit,
      );
      server = started;
      observeServer(started);
      friendly(
        options.emit,
        `isolated Haxe server ready with pid ${started.pid} (${identity.slice(0, 12)})`,
      );
    } catch (error) {
      friendly(
        options.emit,
        `Haxe server unavailable; using direct compilation: ${error instanceof Error ? error.message : "startup failure"}`,
        "stderr",
      );
    }
  };

  const replaceWatch = (nextPlan: HaxeWatchPlan): void => {
    watcher?.close();
    plan = nextPlan;
    watcher = runtime.watch(
      plan,
      (change) => {
        if (armed) {
          loop.request(change.kind);
        } else {
          startupDirty = mergeCause(startupDirty, change.kind);
        }
      },
      (error) => {
        friendly(options.emit, `watch error: ${error.message}`, "stderr");
        if (armed) {
          loop.request("identity");
        } else {
          startupDirty = "identity";
        }
      },
    );
  };

  const refreshIdentity = async (): Promise<boolean> => {
    try {
      const refreshedProject = runtime.resolveProject(options);
      if (refreshedProject.projectRoot !== project.projectRoot) {
        throw new Error("configured project root changed during one dev invocation");
      }
      const refreshedPlan = runtime.watchPlan(refreshedProject);
      const refreshedIdentity = compilerIdentity(refreshedProject, refreshedPlan);
      project = refreshedProject;
      if (refreshedIdentity !== identity) {
        identity = refreshedIdentity;
        replaceWatch(refreshedPlan);
        await stopServer();
      }
      return true;
    } catch (error) {
      lastFailure = error instanceof Error ? error : new Error("cannot refresh Haxe watch identity");
      friendly(options.emit, diagnosticLabel(lastFailure), "stderr");
      return false;
    }
  };

  const generate = async (cause: WatchChangeKind): Promise<boolean> => {
    if (cause === "identity" && !(await refreshIdentity())) {
      return false;
    }
    await ensureServer();
    activeAbort = new AbortController();
    const request = (haxeCommand: ToolCommand): DevGenerationRequest => ({
      start: options.start,
      ...(options.configPath === undefined ? {} : { configPath: options.configPath }),
      haxeCommand,
      signal: activeAbort?.signal ?? AbortSignal.abort(),
      emit: options.emit,
    });
    try {
      let result: GenerateCommandResult;
      try {
        result = await runtime.generate(request(connectedCommand(project.haxeCommand, server)));
      } catch (error) {
        if (
          server !== null &&
          error instanceof DevGenerationFailure &&
          CONNECTION_FAILURE.test(`${error.message}\n${error.output}`) &&
          !activeAbort.signal.aborted
        ) {
          friendly(options.emit, "Haxe server connection failed; retrying this generation directly", "stderr");
          await stopServer();
          result = await runtime.generate(request(project.haxeCommand));
        } else {
          throw error;
        }
      }
      const recovered = lastFailure !== null;
      lastFailure = null;
      hasVerifiedLastGood = true;
      const changed = result.publication.created.length +
        result.publication.updated.length + result.publication.removed.length;
      friendly(
        options.emit,
        `${recovered ? "Haxe recovered; " : ""}generation ${result.publication.action} (${changed} changed, ${result.publication.unchanged.length} unchanged)`,
      );
      return true;
    } catch (error) {
      if (error instanceof DevGenerationAborted || activeAbort.signal.aborted) {
        return false;
      }
      lastFailure = error instanceof Error ? error : new Error("unknown Haxe generation failure");
      friendly(
        options.emit,
        `${diagnosticLabel(lastFailure)}; ${hasVerifiedLastGood
          ? "Next remains on the verified last-good tree"
          : "no generated output was published"}`,
        "stderr",
      );
      return false;
    } finally {
      activeAbort = null;
    }
  };

  const loop = new SerializedDirtyLoop({
    debounceMs: 75,
    run: async (cause) => {
      await generate(cause);
    },
    onError: (error) => friendly(options.emit, `rebuild loop failed: ${error.message}`, "stderr"),
  });

  const cleanup = async (stopNext: boolean): Promise<void> => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    watcher?.close();
    watcher = null;
    activeAbort?.abort();
    // Close the dirty loop before process teardown so a debounced request
    // cannot begin a fresh worker after the one-time abort above. Once no
    // generation can use the compiler, the independent owned groups may stop
    // concurrently within one cleanup bound.
    await loop.close();
    await Promise.all([
      stopNext ? (next?.stop() ?? Promise.resolve()) : Promise.resolve(),
      stopServer(),
    ]);
    friendly(options.emit, "owned development processes stopped");
  };

  let signalResolve: ((signal: DevShutdownSignal) => void) | null = null;
  let receivedSignal: DevShutdownSignal | null = null;
  const signal = new Promise<DevShutdownSignal>((resolve) => {
    signalResolve = resolve;
  });
  const unsubscribe = runtime.signals.subscribe((received) => {
    if (receivedSignal === null) {
      receivedSignal = received;
      activeAbort?.abort();
      signalResolve?.(received);
    }
  });
  const forceExit = (): void => {
    next?.forceStop();
    server?.forceStop();
  };
  process.once("exit", forceExit);
  const signalResult = (received: DevShutdownSignal): DevCommandResult =>
    Object.freeze({
      command: "dev",
      projectRoot: project.projectRoot,
      nextArguments,
      exitCode: received === "SIGINT" ? 130 : received === "SIGHUP" ? 129 : 143,
    });
  try {
    replaceWatch(plan);
    const initialOk = await generate("source");
    if (receivedSignal !== null) {
      friendly(options.emit, `received ${receivedSignal}; stopping owned development processes`);
      await cleanup(false);
      return signalResult(receivedSignal);
    }
    if (!initialOk) {
      const lastGood = runtime.verifyLastGood(options);
      if (!lastGood.ok) {
        await cleanup(false);
        cliFailure(
          "NXHX-CLI-DEV-0010",
          "Development cannot start because initial Haxe generation failed and no verified last-good tree exists.",
          project.projectRoot,
          "a successful initial generation or an exact manifest-owned fallback tree",
          `${diagnosticLabel(lastFailure ?? new Error("initial generation failed"))}; fallback: ${lastGood.reason}`,
          "Fix the Haxe diagnostic, run nextjshx generate successfully once, then retry dev.",
        );
      }
      hasVerifiedLastGood = true;
      friendly(
        options.emit,
        `initial Haxe failure retained verified generation ${lastGood.manifestGeneration ?? "unknown"}; watching for a fix`,
        "stderr",
      );
    }

    next = runtime.startNext(project, nextArguments, options.emit);
    friendly(options.emit, `Next dev started with pid ${next.pid}; Next owns HMR and Fast Refresh`);
    armed = true;
    if (startupDirty !== null) {
      loop.request(startupDirty);
      startupDirty = null;
    }

    const terminal = await Promise.race([
      next.exit.then((result) => ({ kind: "next" as const, result })),
      signal.then((received) => ({ kind: "signal" as const, signal: received })),
    ]);
    if (terminal.kind === "signal") {
      friendly(options.emit, `received ${terminal.signal}; stopping owned development processes`);
      await cleanup(true);
      return signalResult(terminal.signal);
    }
    await cleanup(false);
    friendly(options.emit, `Next dev exited ${terminal.result.code}`, terminal.result.code === 0 ? "stdout" : "stderr");
    return Object.freeze({
      command: "dev",
      projectRoot: project.projectRoot,
      nextArguments,
      exitCode: terminal.result.code,
    });
  } finally {
    unsubscribe();
    process.off("exit", forceExit);
    if (!shuttingDown) {
      await cleanup(true);
    }
  }
}
