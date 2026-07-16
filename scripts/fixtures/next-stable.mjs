#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import net from "node:net";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const FIXTURE = path.join(ROOT, "tests/fixtures/next-stable");
const GENERATED = path.join(FIXTURE, "src-gen");
const NEXT_BIN = path.join(ROOT, "node_modules/next/dist/bin/next");
const TSC_BIN = path.join(ROOT, "node_modules/typescript/bin/tsc6");
const GENES_COMMIT = "1e7e323fdbda4c5b93689355294bd978e9170725";
const TYPESCRIPT_VERSION = "6.0.2";
const EXPECTED_VERSIONS = new Map([
  ["next", "16.2.10"],
  ["react", "19.2.7"],
  ["react-dom", "19.2.7"],
  ["typescript", TYPESCRIPT_VERSION],
  ["postcss", "8.5.10"],
  ["@types/node", "20.19.24"],
  ["@types/react", "19.2.17"],
  ["@types/react-dom", "19.2.3"],
]);
const SUPPORTED_NODE_VERSIONS = new Set(["20.19.3", "24.18.0"]);
const COMMAND_ENV = {
  ...process.env,
  CI: "1",
  NEXT_TELEMETRY_DISABLED: "1",
};

function commandLine(command, args) {
  return [command, ...args]
    .map((value) => (/^[A-Za-z0-9_./:=@-]+$/.test(value) ? value : JSON.stringify(value)))
    .join(" ");
}

function run(command, args, options = {}) {
  const cwd = options.cwd ?? ROOT;
  console.log(`[next-stable] $ ${commandLine(command, args)}`);
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: COMMAND_ENV,
      stdio: "inherit",
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(
        new Error(
          `${command} failed with ${signal === null ? `exit ${code}` : `signal ${signal}`}`,
        ),
      );
    });
  });
}

function capture(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: ROOT,
      env: COMMAND_ENV,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      reject(
        new Error(
          `${command} failed with ${signal === null ? `exit ${code}` : `signal ${signal}`}: ${stderr.trim()}`,
        ),
      );
    });
  });
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

async function verifyToolchain() {
  assert(
    SUPPORTED_NODE_VERSIONS.has(process.versions.node),
    `expected Node ${[...SUPPORTED_NODE_VERSIONS].join(" or ")}, found ${process.versions.node}`,
  );

  const { stdout: haxeVersion } = await capture("haxe", ["--version"]);
  assert.equal(haxeVersion.trim(), "4.3.7", "fixture must use Haxe 4.3.7");

  for (const [name, expected] of EXPECTED_VERSIONS) {
    const manifest = await readJson(path.join(ROOT, "node_modules", name, "package.json"));
    assert.equal(manifest.version, expected, `${name} must resolve to ${expected}`);
  }

  const { stdout: typescriptVersion } = await capture(process.execPath, [
    TSC_BIN,
    "--version",
  ]);
  assert.equal(
    typescriptVersion.trim(),
    `Version ${TYPESCRIPT_VERSION}`,
    "fixture must execute the exact TypeScript compiler core",
  );

  const genesLock = await fs.readFile(
    path.join(ROOT, "haxe_libraries/genes-ts.hxml"),
    "utf8",
  );
  assert(genesLock.includes(GENES_COMMIT), "genes-ts lock lost its exact commit");
  assert(!genesLock.includes(ROOT), "genes-ts lock contains a machine-local path");
}

async function removeGeneratedState() {
  await Promise.all([
    fs.rm(GENERATED, { recursive: true, force: true }),
    fs.rm(path.join(FIXTURE, ".next"), { recursive: true, force: true }),
    fs.rm(path.join(FIXTURE, "next-env.d.ts"), { force: true }),
    fs.rm(path.join(FIXTURE, "tsconfig.tsbuildinfo"), { force: true }),
  ]);
}

async function walk(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const child = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(child)));
    } else if (entry.isFile()) {
      files.push(child);
    }
  }
  return files;
}

async function verifyAuthoredTypes() {
  const roots = [path.join(FIXTURE, "haxe"), path.join(FIXTURE, "app")];
  for (const root of roots) {
    for (const file of await walk(root)) {
      const source = await fs.readFile(file, "utf8");
      assert(!/\bDynamic\b/.test(source), `${path.relative(ROOT, file)} uses Dynamic`);
      assert(!/\buntyped\b/.test(source), `${path.relative(ROOT, file)} uses untyped`);
      assert(!/@ts-(?:ignore|nocheck)/.test(source), `${path.relative(ROOT, file)} suppresses TypeScript`);
    }
  }
}

async function verifyGeneratedOutput() {
  const files = await walk(GENERATED);
  const relativeFiles = files.map((file) => path.relative(GENERATED, file));
  assert(relativeFiles.includes("index.tsx"), "genes-ts did not emit the TSX entry module");
  assert(
    relativeFiles.includes(path.join("app", "HelloView.tsx")),
    "genes-ts did not emit the split HelloView TSX module",
  );
  assert(
    relativeFiles.every((file) => !file.endsWith(".js")),
    "genes-ts emitted JavaScript in the TypeScript fixture",
  );

  const helloView = await fs.readFile(path.join(GENERATED, "app/HelloView.tsx"), "utf8");
  assert(helloView.includes("export class HelloView"), "HelloView is not a named ESM export");
  assert(
    helloView.includes('import type {JSX} from "react"'),
    "HelloView lost the explicit React 19 JSX type import",
  );
  assert(helloView.includes('<main id="nextjshx-fixture">'), "HelloView lost its TSX markup");

  for (const file of files.filter((candidate) => candidate.endsWith(".ts") || candidate.endsWith(".tsx"))) {
    const source = await fs.readFile(file, "utf8");
    const relativeImports = [...source.matchAll(/\bfrom\s+["'](\.{1,2}\/[^"']+)["']/g)];
    for (const match of relativeImports) {
      assert(
        path.posix.extname(match[1]) === "",
        `${path.relative(ROOT, file)} emitted an extension-bearing relative import ${match[1]}`,
      );
    }
  }

  console.log(
    `[next-stable] generated-output: OK: ${relativeFiles.length} split TS/TSX files checked`,
  );
}

async function verifyBuild() {
  await removeGeneratedState();
  await verifyToolchain();
  await verifyAuthoredTypes();
  await run("haxe", ["tests/fixtures/next-stable/build.hxml"]);
  await verifyGeneratedOutput();
  await run(process.execPath, [NEXT_BIN, "typegen", FIXTURE]);
  await run(process.execPath, [TSC_BIN, "--project", path.join(FIXTURE, "tsconfig.json"), "--noEmit"]);
  await run(process.execPath, [NEXT_BIN, "build", FIXTURE]);
  await fs.access(path.join(FIXTURE, ".next/BUILD_ID"));
  console.log("[next-stable] build: OK");
}

async function reservePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  assert(address !== null && typeof address !== "string", "could not reserve a loopback port");
  const { port } = address;
  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  return port;
}

async function stopServer(child, exitPromise) {
  if (child.exitCode !== null || child.signalCode !== null) {
    return;
  }
  child.kill("SIGTERM");
  const stopped = await Promise.race([
    exitPromise.then(() => true),
    new Promise((resolve) => setTimeout(() => resolve(false), 5_000)),
  ]);
  if (!stopped && child.exitCode === null && child.signalCode === null) {
    child.kill("SIGKILL");
    await exitPromise;
  }
}

async function smoke() {
  await verifyToolchain();
  await fs.access(path.join(FIXTURE, ".next/BUILD_ID"));
  const port = await reservePort();
  const child = spawn(
    process.execPath,
    [NEXT_BIN, "start", FIXTURE, "--hostname", "127.0.0.1", "--port", String(port)],
    {
      cwd: ROOT,
      env: COMMAND_ENV,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let output = "";
  for (const stream of [child.stdout, child.stderr]) {
    stream.setEncoding("utf8");
    stream.on("data", (chunk) => {
      output += chunk;
      process.stdout.write(chunk);
    });
  }
  const exitPromise = new Promise((resolve) => child.once("exit", resolve));

  try {
    const deadline = Date.now() + 30_000;
    let response;
    let lastError;
    while (Date.now() < deadline) {
      if (child.exitCode !== null || child.signalCode !== null) {
        throw new Error(`Next production server exited before the smoke request:\n${output}`);
      }
      try {
        response = await fetch(`http://127.0.0.1:${port}/`, {
          signal: AbortSignal.timeout(2_000),
        });
        if (response.ok) {
          break;
        }
        lastError = new Error(`HTTP ${response.status}`);
      } catch (error) {
        lastError = error;
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    assert(response?.ok, `production server did not become ready: ${lastError}`);
    const html = await response.text();
    assert(html.includes('id="nextjshx-fixture"'), "rendered HTML lost the Haxe marker");
    assert(html.includes("Haxe → genes-ts → Next.js"), "rendered HTML lost the Haxe content");
    console.log(`[next-stable] smoke: OK: GET / returned ${response.status}`);
  } finally {
    await stopServer(child, exitPromise);
  }
}

const mode = process.argv[2] ?? "verify";
switch (mode) {
  case "verify":
    await verifyBuild();
    break;
  case "smoke":
    await smoke();
    break;
  case "clean":
    await removeGeneratedState();
    console.log("[next-stable] clean: OK");
    break;
  default:
    throw new Error(`unknown mode ${mode}; expected verify, smoke, or clean`);
}
