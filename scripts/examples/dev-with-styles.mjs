#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const PROJECT = process.cwd();
const CLI = path.join(ROOT, "tools/cli/.tmp/src/cli.js");
const TAILWIND = path.join(ROOT, "node_modules/@tailwindcss/cli/dist/index.mjs");
const INPUT = path.join(PROJECT, "styles/app.css");
const OUTPUT = path.join(PROJECT, "public/styles.css");
const NEXT_ARGS = Object.freeze([...process.argv.slice(2)]);
const ENV = {
  ...process.env,
  NEXT_TELEMETRY_DISABLED: "1",
  NO_COLOR: "1",
};

function exitCode(code, signal) {
  if (code !== null) {
    return code;
  }
  return signal === "SIGINT" ? 130 : signal === "SIGHUP" ? 129 : signal === "SIGTERM" ? 143 : 1;
}

function run(command, args, cwd = ROOT) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, env: ENV, shell: false, stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${path.basename(command)} exited ${exitCode(code, signal)}`));
      }
    });
  });
}

class Lines {
  #prefix;
  #stream;
  #pending = "";

  constructor(prefix, stream) {
    this.#prefix = prefix;
    this.#stream = stream;
  }

  write(chunk) {
    const lines = `${this.#pending}${chunk.toString("utf8")}`.replaceAll("\r\n", "\n").split(/[\n\r]/);
    this.#pending = lines.pop() ?? "";
    for (const line of lines) {
      this.#stream.write(`[${this.#prefix}] ${line}\n`);
    }
  }

  end() {
    if (this.#pending.length > 0) {
      this.#stream.write(`[${this.#prefix}] ${this.#pending}\n`);
      this.#pending = "";
    }
  }
}

function managed(command, args, cwd, prefix = null) {
  const child = spawn(command, args, {
    cwd,
    env: ENV,
    shell: false,
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (child.pid === undefined) {
    throw new Error(`${path.basename(command)} did not receive a process id`);
  }
  const stdout = prefix === null ? null : new Lines(prefix, process.stdout);
  const stderr = prefix === null ? null : new Lines(prefix, process.stderr);
  child.stdout.on("data", (chunk) => {
    if (stdout === null) {
      process.stdout.write(chunk);
    } else {
      stdout.write(chunk);
    }
  });
  child.stderr.on("data", (chunk) => {
    if (stderr === null) {
      process.stderr.write(chunk);
    } else {
      stderr.write(chunk);
    }
  });
  const exit = new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      stdout?.end();
      stderr?.end();
      resolve({ code: exitCode(code, signal), signal });
    });
  });
  const kill = (signal) => {
    if (child.exitCode !== null || child.signalCode !== null) {
      return;
    }
    try {
      child.kill(signal);
    } catch (error) {
      if (error.code !== "ESRCH") {
        throw error;
      }
    }
  };
  return Object.freeze({
    pid: child.pid,
    exit,
    async stop() {
      kill("SIGTERM");
      const complete = await Promise.race([
        exit.then(() => true),
        new Promise((resolve) => setTimeout(() => resolve(false), 8_000)),
      ]);
      if (!complete) {
        kill("SIGKILL");
        await exit;
      }
    },
    forceStop: () => kill("SIGKILL"),
  });
}

let styles = null;
let app = null;

try {
  const relative = path.relative(ROOT, PROJECT);
  assert(
    relative.startsWith(`examples${path.sep}`) && !relative.startsWith(`examples${path.sep}..`),
    "the styled dev helper must run from a repository example package",
  );
  await Promise.all([
    fs.access(path.join(PROJECT, "package.json")),
    fs.access(INPUT),
    fs.access(TAILWIND),
  ]);
  await run(process.execPath, ["tools/cli/scripts/ensure-build.mjs", "runtime"]);
  await run(process.execPath, [TAILWIND, "-i", INPUT, "-o", OUTPUT], PROJECT);

  styles = managed(
    process.execPath,
    [TAILWIND, "-i", INPUT, "-o", OUTPUT, "--watch=always"],
    PROJECT,
    "styles",
  );
  app = managed(
    process.execPath,
    [CLI, "dev", ...(NEXT_ARGS.length === 0 ? [] : ["--", ...NEXT_ARGS])],
    PROJECT,
  );
  console.log(`[dev] styles pid ${styles.pid}; NextJsHx pid ${app.pid}`);

  let signalResolve;
  const signal = new Promise((resolve) => {
    signalResolve = resolve;
  });
  const interrupt = () => signalResolve("SIGINT");
  const terminate = () => signalResolve("SIGTERM");
  const hangup = () => signalResolve("SIGHUP");
  process.once("SIGINT", interrupt);
  process.once("SIGTERM", terminate);
  process.once("SIGHUP", hangup);
  const forceStop = () => {
    styles?.forceStop();
    app?.forceStop();
  };
  process.once("exit", forceStop);
  try {
    const terminal = await Promise.race([
      styles.exit.then((result) => ({ owner: "styles", result })),
      app.exit.then((result) => ({ owner: "app", result })),
      signal.then((received) => ({ owner: "signal", received })),
    ]);
    if (terminal.owner === "signal") {
      console.log(`[dev] received ${terminal.received}; stopping both development owners`);
      await Promise.all([styles.stop(), app.stop()]);
      process.exitCode = terminal.received === "SIGINT" ? 130 : terminal.received === "SIGHUP" ? 129 : 143;
    } else if (terminal.owner === "styles") {
      console.error(`[dev] Tailwind watcher exited ${terminal.result.code}; stopping NextJsHx`);
      await app.stop();
      process.exitCode = terminal.result.code === 0 ? 1 : terminal.result.code;
    } else {
      await styles.stop();
      process.exitCode = terminal.result.code;
    }
  } finally {
    process.off("SIGINT", interrupt);
    process.off("SIGTERM", terminate);
    process.off("SIGHUP", hangup);
    process.off("exit", forceStop);
  }
} catch (error) {
  console.error(`[dev] ${error.message}`);
  process.exitCode = 1;
} finally {
  if (styles !== null) {
    await styles.stop().catch(() => undefined);
  }
  if (app !== null) {
    await app.stop().catch(() => undefined);
  }
}
