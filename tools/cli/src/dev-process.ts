import { spawn, type ChildProcess } from "node:child_process";
import {
  accessSync,
  constants,
  existsSync,
  lstatSync,
  readFileSync,
  realpathSync,
} from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";

import type { ToolCommand } from "./commands.js";

export type DevOutputSource = "haxe" | "nextjshx" | "next" | "tsc";
export type DevOutputChannel = "stdout" | "stderr";

export interface DevOutputEvent {
  readonly source: DevOutputSource;
  readonly channel: DevOutputChannel;
  readonly line: string;
}

export type DevOutputEmitter = (event: DevOutputEvent) => void;

export interface DevProcessExit {
  readonly code: number;
  readonly signal: NodeJS.Signals | null;
}

export interface ManagedDevProcess {
  readonly pid: number;
  readonly exit: Promise<DevProcessExit>;
  stop(): Promise<void>;
  forceStop(): void;
}

export interface ManagedProcessRequest {
  readonly command: string;
  readonly args: readonly string[];
  readonly cwd: string;
  readonly env?: Readonly<Record<string, string | undefined>>;
  readonly source: "haxe" | "next";
  readonly cleanupMs?: number;
}

class LineEmitter {
  readonly #source: "haxe" | "next";
  readonly #channel: DevOutputChannel;
  readonly #emit: DevOutputEmitter;
  #pending = "";

  constructor(
    source: "haxe" | "next",
    channel: DevOutputChannel,
    emit: DevOutputEmitter,
  ) {
    this.#source = source;
    this.#channel = channel;
    this.#emit = emit;
  }

  write(chunk: Buffer): void {
    const normalized = `${this.#pending}${chunk.toString("utf8")}`.replaceAll("\r\n", "\n");
    const lines = normalized.split(/[\n\r]/);
    this.#pending = lines.pop() ?? "";
    for (const line of lines) {
      this.#emit(Object.freeze({ source: this.#source, channel: this.#channel, line }));
    }
  }

  end(): void {
    if (this.#pending.length > 0) {
      this.#emit(Object.freeze({
        source: this.#source,
        channel: this.#channel,
        line: this.#pending,
      }));
      this.#pending = "";
    }
  }
}

function exitCode(code: number | null, signal: NodeJS.Signals | null): number {
  if (code !== null) {
    return code;
  }
  return signal === "SIGINT" ? 130 : signal === "SIGHUP" ? 129 : signal === "SIGTERM" ? 143 : 1;
}

function killOwnedGroup(child: ChildProcess, signal: NodeJS.Signals): void {
  if (child.pid === undefined || child.exitCode !== null || child.signalCode !== null) {
    return;
  }
  try {
    if (process.platform !== "win32") {
      process.kill(-child.pid, signal);
    } else {
      child.kill(signal);
    }
  } catch (error) {
    if (
      typeof error !== "object" ||
      error === null ||
      !("code" in error) ||
      error.code !== "ESRCH"
    ) {
      throw error;
    }
  }
}

export function startManagedProcess(
  request: ManagedProcessRequest,
  emit: DevOutputEmitter,
): ManagedDevProcess {
  const child = spawn(request.command, [...request.args], {
    cwd: request.cwd,
    detached: process.platform !== "win32",
    env: {
      ...process.env,
      ...request.env,
      NEXT_TELEMETRY_DISABLED: "1",
      NO_COLOR: "1",
    },
    shell: false,
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (child.pid === undefined) {
    // A failed spawn reports its error asynchronously even though the missing
    // pid is observable synchronously. Consume that event before rejecting the
    // start so it cannot become an uncaught process-level error.
    child.once("error", () => undefined);
    throw new Error(`cannot start ${request.source}: child process has no pid`);
  }
  const stdout = new LineEmitter(request.source, "stdout", emit);
  const stderr = new LineEmitter(request.source, "stderr", emit);
  child.stdout?.on("data", (chunk: Buffer) => stdout.write(chunk));
  child.stderr?.on("data", (chunk: Buffer) => stderr.write(chunk));
  let settled = false;
  const exit = new Promise<DevProcessExit>((resolve) => {
    const settle = (result: DevProcessExit): void => {
      if (settled) {
        return;
      }
      settled = true;
      stdout.end();
      stderr.end();
      resolve(Object.freeze(result));
    };
    child.once("error", (error) => {
      emit(Object.freeze({
        source: request.source,
        channel: "stderr",
        line: `cannot start process: ${error.message}`,
      }));
      settle({ code: 1, signal: null });
    });
    child.once("exit", (code, signal) => {
      settle({ code: exitCode(code, signal), signal });
    });
  });
  const cleanupMs = request.cleanupMs ?? 3_000;
  return Object.freeze({
    pid: child.pid,
    exit,
    async stop(): Promise<void> {
      if (settled || child.exitCode !== null || child.signalCode !== null) {
        await exit;
        return;
      }
      killOwnedGroup(child, "SIGTERM");
      let cleanupTimer: NodeJS.Timeout | null = null;
      const completed = await Promise.race([
        exit.then(() => true),
        new Promise<false>((resolve) => {
          cleanupTimer = setTimeout(() => resolve(false), cleanupMs);
        }),
      ]);
      if (cleanupTimer !== null) {
        clearTimeout(cleanupTimer);
      }
      if (!completed) {
        killOwnedGroup(child, "SIGKILL");
        await exit;
      }
    },
    forceStop(): void {
      killOwnedGroup(child, "SIGKILL");
    },
  });
}

async function reservePort(): Promise<number> {
  const server = net.createServer();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (typeof address !== "object" || address === null) {
    server.close();
    throw new Error("cannot reserve an isolated Haxe server port");
  }
  await new Promise<void>((resolve, reject) =>
    server.close((error) => error === undefined ? resolve() : reject(error)),
  );
  return address.port;
}

function executableOnPath(command: string, cwd: string): string | null {
  const candidates: string[] = [];
  if (path.isAbsolute(command)) {
    candidates.push(command);
  } else if (command.includes(path.sep) || (path.sep === "\\" && command.includes("/"))) {
    candidates.push(path.resolve(cwd, command));
  } else {
    const extensions = process.platform === "win32"
      ? (process.env.PATHEXT ?? ".EXE;.CMD;.BAT").split(";")
      : [""];
    for (const directory of (process.env.PATH ?? "").split(path.delimiter)) {
      if (directory.length === 0) {
        continue;
      }
      for (const extension of extensions) {
        candidates.push(path.join(directory, `${command}${extension}`));
      }
    }
  }
  for (const candidate of candidates) {
    try {
      accessSync(candidate, constants.X_OK);
      const resolved = realpathSync.native(candidate);
      if (lstatSync(resolved).isFile()) {
        return resolved;
      }
    } catch {
      // Continue through the caller's trusted PATH in order.
    }
  }
  return null;
}

function nodeHaxeShim(file: string): boolean {
  try {
    const prefix = readFileSync(file).subarray(0, 8_192).toString("utf8");
    const segments = file.split(path.sep);
    const nodeBin = segments.some((segment, index) =>
      segment === "node_modules" && segments[index + 1] === ".bin",
    );
    return nodeBin || prefix.startsWith("#!/usr/bin/env node") || prefix.includes("haxeshim");
  } catch {
    return false;
  }
}

function nearestHaxerc(cwd: string): string | null {
  let current = path.resolve(cwd);
  while (true) {
    const candidate = path.join(current, ".haxerc");
    if (existsSync(candidate)) {
      return candidate;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }
}

function nativeHaxeFromProject(cwd: string): string | null {
  const haxerc = nearestHaxerc(cwd);
  if (haxerc === null) {
    return null;
  }
  let decoded: unknown;
  try {
    decoded = JSON.parse(readFileSync(haxerc, "utf8"));
  } catch {
    return null;
  }
  if (typeof decoded !== "object" || decoded === null || Array.isArray(decoded)) {
    return null;
  }
  const record = decoded as Record<string, unknown>;
  if (typeof record.version !== "string" || !/^[A-Za-z0-9._+-]+$/.test(record.version)) {
    return null;
  }
  const home = os.homedir();
  for (const base of [path.join(home, "haxe"), path.join(home, ".haxe")]) {
    for (const name of process.platform === "win32" ? ["haxe.exe", "haxe"] : ["haxe"]) {
      const candidate = path.join(base, "versions", record.version, name);
      try {
        const stats = lstatSync(candidate);
        if (stats.isSymbolicLink() || !stats.isFile()) {
          continue;
        }
        accessSync(candidate, constants.X_OK);
        const resolved = realpathSync.native(candidate);
        if (!nodeHaxeShim(resolved)) {
          return resolved;
        }
      } catch {
        // Try the next reviewed Lix/Haxe installation convention.
      }
    }
  }
  return null;
}

function haxeServerCommand(command: ToolCommand, cwd: string): ToolCommand {
  const executable = executableOnPath(command.command, cwd);
  if (executable === null || !nodeHaxeShim(executable)) {
    return command;
  }
  if (command.argsPrefix.length > 0) {
    throw new Error("cannot safely translate a Haxe Node shim with custom prefix arguments to server mode");
  }
  const native = nativeHaxeFromProject(cwd);
  if (native === null) {
    throw new Error("the Haxe command is a Node shim and no real compiler binary matches the nearest .haxerc");
  }
  return Object.freeze({ command: native, argsPrefix: Object.freeze([]) });
}

async function probeHaxeServer(
  command: ToolCommand,
  endpoint: string,
  cwd: string,
): Promise<boolean> {
  return await new Promise<boolean>((resolve) => {
    const child = spawn(
      command.command,
      [...command.argsPrefix, "--connect", endpoint, "-version"],
      { cwd, env: { ...process.env, NO_COLOR: "1" }, shell: false, stdio: "ignore" },
    );
    let complete = false;
    const finish = (ready: boolean): void => {
      if (complete) {
        return;
      }
      complete = true;
      clearTimeout(timeout);
      resolve(ready);
    };
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      finish(false);
    }, 500);
    child.once("error", () => finish(false));
    child.once("exit", (code) => finish(code === 0));
  });
}

export interface OwnedHaxeServer extends ManagedDevProcess {
  readonly endpoint: string;
  readonly compilerCommand: ToolCommand;
}

export async function startOwnedHaxeServer(
  command: ToolCommand,
  cwd: string,
  emit: DevOutputEmitter,
): Promise<OwnedHaxeServer> {
  const port = await reservePort();
  const endpoint = `127.0.0.1:${port}`;
  const compilerCommand = haxeServerCommand(command, cwd);
  const processHandle = startManagedProcess(
    {
      command: compilerCommand.command,
      args: [...compilerCommand.argsPrefix, "--wait", endpoint],
      cwd,
      source: "haxe",
    },
    emit,
  );
  const deadline = Date.now() + 4_000;
  while (Date.now() < deadline) {
    const outcome = await Promise.race([
      processHandle.exit.then(() => "exit" as const),
      probeHaxeServer(compilerCommand, endpoint, cwd).then((ready) =>
        ready ? "ready" as const : "retry" as const,
      ),
    ]);
    if (outcome === "ready") {
      return Object.freeze({ ...processHandle, endpoint, compilerCommand });
    }
    if (outcome === "exit") {
      throw new Error("owned Haxe compilation server exited during startup");
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 50));
  }
  await processHandle.stop();
  throw new Error("owned Haxe compilation server did not become ready within 4 seconds");
}
