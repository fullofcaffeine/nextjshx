#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import crypto from "node:crypto";
import { promises as fs } from "node:fs";
import net from "node:net";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright-core";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const FIXTURE = path.join(ROOT, "tests/fixtures/next-stable");
const SOURCE = path.join(FIXTURE, "haxe/app/HaxePage.hx");
const GLOBAL_CSS = path.join(FIXTURE, "app/globals.css");
const GENERATED_SOURCE = path.join(FIXTURE, "src-gen/app/HaxePage.tsx");
const CLI = path.join(ROOT, "tools/cli/.tmp/src/cli.js");
const LINKED_PACKAGES = ["next", "react", "react-dom", "typescript"];
const ORIGINAL_MARKER = "This page implementation originated in typed Haxe.";
const SECOND_MARKER = "DEV-LOOP-TWO";
const THIRD_MARKER = "DEV-LOOP-THREE";
const ORIGINAL_CSS_COLOR = "rgb(12, 34, 56)";
const EDITED_CSS_COLOR = "rgb(67, 89, 101)";
const GENERATED_ADAPTERS = [
  "app/@modal/(.)photo/[id]/page.tsx",
  "app/@modal/default.tsx",
  "app/api/echo/[id]/route.ts",
  "app/feed/page.tsx",
  "app/haxe/page.tsx",
  "app/layout.tsx",
  "app/photo/[id]/page.tsx",
  "app/products/[slug]/page.tsx",
  "app/special/error/error.tsx",
  "app/special/loading/loading.tsx",
  "app/special/not-found/not-found.tsx",
  "proxy.ts",
];
const UNCHANGED_ADAPTER_COUNT = GENERATED_ADAPTERS.length - 1;
const COMMAND_ENV = {
  ...process.env,
  CI: "1",
  NEXT_TELEMETRY_DISABLED: "1",
  NO_COLOR: "1",
};

async function run(command, args, cwd = ROOT) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, env: COMMAND_ENV, stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${path.basename(command)} exited ${code ?? signal}`));
      }
    });
  });
}

function processAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (error.code === "ESRCH") {
      return false;
    }
    throw error;
  }
}

function ownedHaxeServerPids(value) {
  return new Set(
    [...value.matchAll(/isolated Haxe server ready with pid (\d+) \(/g)]
      .map((match) => Number(match[1])),
  );
}

async function reservePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  assert(address !== null && typeof address !== "string", "could not reserve a loopback port");
  await new Promise((resolve, reject) =>
    server.close((error) => error === undefined ? resolve() : reject(error)),
  );
  return address.port;
}

async function browserExecutable() {
  const configured = process.env.NEXTJSHX_CHROME;
  if (configured !== undefined && !path.isAbsolute(configured)) {
    throw new Error("NEXTJSHX_CHROME must be an absolute browser executable path");
  }
  const candidates = [
    configured,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ].filter((candidate) => candidate !== undefined);
  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch (error) {
      if (error.code !== "ENOENT" && error.code !== "EACCES") {
        throw error;
      }
    }
  }
  throw new Error("no system Chrome/Chromium found; set NEXTJSHX_CHROME to its absolute path");
}

async function removeGeneratedState() {
  await Promise.all([
    fs.rm(path.join(FIXTURE, "src-gen"), { recursive: true, force: true }),
    fs.rm(path.join(FIXTURE, ".next"), { recursive: true, force: true }),
    fs.rm(path.join(FIXTURE, ".nextjshx"), { recursive: true, force: true }),
    fs.rm(path.join(FIXTURE, "next-env.d.ts"), { force: true }),
    fs.rm(path.join(FIXTURE, "tsconfig.tsbuildinfo"), { force: true }),
    ...GENERATED_ADAPTERS.map((relative) => fs.rm(path.join(FIXTURE, relative), { force: true })),
  ]);
  for (const relative of [
    "app/api/echo/[id]",
    "app/api/echo",
    "app/api",
    "app/haxe",
    "app/products/[slug]",
    "app/products",
  ]) {
    await fs.rmdir(path.join(FIXTURE, relative)).catch((error) => {
      if (error.code !== "ENOENT" && error.code !== "ENOTEMPTY") {
        throw error;
      }
    });
  }
}

async function linkDependencies() {
  const created = [];
  for (const name of LINKED_PACKAGES) {
    const source = path.join(ROOT, "node_modules", name);
    const destination = path.join(FIXTURE, "node_modules", name);
    await fs.access(path.join(source, "package.json"));
    try {
      await fs.lstat(destination);
    } catch (error) {
      if (error.code !== "ENOENT") {
        throw error;
      }
      await fs.mkdir(path.dirname(destination), { recursive: true });
      await fs.symlink(source, destination, "dir");
      created.push(destination);
    }
  }
  return created;
}

async function removeCreatedLinks(created) {
  for (const link of created.reverse()) {
    await fs.rm(link, { force: true });
  }
  await fs.rmdir(path.join(FIXTURE, "node_modules")).catch((error) => {
    if (error.code !== "ENOENT" && error.code !== "ENOTEMPTY") {
      throw error;
    }
  });
}

async function filesUnder(candidate) {
  let stats;
  try {
    stats = await fs.lstat(candidate);
  } catch (error) {
    if (error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
  if (stats.isSymbolicLink()) {
    throw new Error(`generated-state digest encountered a symlink: ${candidate}`);
  }
  if (stats.isFile()) {
    return [candidate];
  }
  if (!stats.isDirectory()) {
    throw new Error(`generated-state digest encountered a special file: ${candidate}`);
  }
  const result = [];
  for (const entry of await fs.readdir(candidate, { withFileTypes: true })) {
    result.push(...(await filesUnder(path.join(candidate, entry.name))));
  }
  return result;
}

async function lastGoodDigest() {
  const roots = [
    path.join(FIXTURE, "src-gen"),
    path.join(FIXTURE, ".nextjshx/manifest.json"),
    ...GENERATED_ADAPTERS.map((relative) => path.join(FIXTURE, relative)),
  ];
  const files = (await Promise.all(roots.map(filesUnder)))
    .flat()
    .sort((left, right) => Buffer.from(left).compare(Buffer.from(right)));
  const hash = crypto.createHash("sha256");
  for (const file of files) {
    hash.update(path.relative(FIXTURE, file).replaceAll("\\", "/"));
    hash.update("\0");
    hash.update(await fs.readFile(file));
    hash.update("\n");
  }
  return hash.digest("hex");
}

async function adapterDigests() {
  return new Map(await Promise.all(GENERATED_ADAPTERS.map(async (relative) => [
    relative,
    crypto.createHash("sha256").update(await fs.readFile(path.join(FIXTURE, relative))).digest("hex"),
  ])));
}

function changedAdapters(before, after) {
  return GENERATED_ADAPTERS.filter((relative) => before.get(relative) !== after.get(relative));
}

async function eventually(label, condition, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;
  while (Date.now() < deadline) {
    try {
      if (await condition()) {
        return;
      }
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`${label} did not complete within ${timeoutMs}ms${lastError === null ? "" : `: ${lastError.message}`}`);
}

async function stopDev(child, exitPromise) {
  if (child.exitCode !== null || child.signalCode !== null) {
    return await exitPromise;
  }
  child.kill("SIGTERM");
  let cleanupTimer = null;
  try {
    return await Promise.race([
      exitPromise,
      new Promise((_, reject) => {
        cleanupTimer = setTimeout(() => reject(new Error("dev cleanup exceeded 8 seconds")), 8_000);
      }),
    ]);
  } finally {
    if (cleanupTimer !== null) {
      clearTimeout(cleanupTimer);
    }
  }
}

let originalSource = null;
let originalCss = null;
let createdLinks = [];
let browser = null;
let dev = null;
let devExit = null;
let output = "";

try {
  originalSource = await fs.readFile(SOURCE, "utf8");
  originalCss = await fs.readFile(GLOBAL_CSS, "utf8");
  assert(originalSource.includes(ORIGINAL_MARKER), "dev fixture marker drifted");
  assert(originalCss.includes(ORIGINAL_CSS_COLOR), "dev fixture CSS marker drifted");
  await removeGeneratedState();
  createdLinks = await linkDependencies();
  await run(process.execPath, ["tools/cli/scripts/ensure-build.mjs", "runtime"]);
  const port = await reservePort();
  dev = spawn(
    process.execPath,
    [CLI, "dev", "--", "-H", "127.0.0.1", "-p", String(port)],
    { cwd: FIXTURE, env: COMMAND_ENV, stdio: ["ignore", "pipe", "pipe"] },
  );
  devExit = new Promise((resolve, reject) => {
    dev.once("error", reject);
    dev.once("exit", (code, signal) => resolve({ code, signal }));
  });
  for (const stream of [dev.stdout, dev.stderr]) {
    stream.setEncoding("utf8");
    stream.on("data", (chunk) => {
      output += chunk;
      process.stdout.write(chunk);
    });
  }
  await eventually("Next dev readiness", async () => {
    if (dev.exitCode !== null || dev.signalCode !== null) {
      throw new Error(`dev exited before readiness:\n${output}`);
    }
    const response = await fetch(`http://127.0.0.1:${port}/haxe`, {
      signal: AbortSignal.timeout(1_500),
    });
    return response.ok;
  // This one bound includes both the initial Haxe generation and Next's lazy
  // cold route compilation. The macOS pin uses the supported webpack fallback;
  // edit/recovery checks remain at 30 s with no retries.
  }, 90_000);

  browser = await chromium.launch({
    executablePath: await browserExecutable(),
    headless: true,
    args: ["--disable-dev-shm-usage", "--no-sandbox"],
  });
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${port}/haxe`, { waitUntil: "networkidle", timeout: 20_000 });
  const copy = page.locator("#haxe-page p");
  const styledHeader = page.locator("#nextjshx-fixture");
  assert.equal(await copy.textContent(), ORIGINAL_MARKER);
  assert.equal(
    await styledHeader.evaluate((element) => getComputedStyle(element).color),
    ORIGINAL_CSS_COLOR,
    "the initial Haxe-requested stylesheet did not reach Next dev",
  );

  // Next—not the Haxe compiler—owns this stylesheet edit. Seeing the browser
  // update proves the annotation produced an ordinary Next CSS import rather
  // than a copied file or a second style watcher.
  await fs.writeFile(
    GLOBAL_CSS,
    originalCss.replace(ORIGINAL_CSS_COLOR, EDITED_CSS_COLOR),
    "utf8",
  );
  await eventually("browser CSS update through Next dev", async () =>
    await styledHeader.evaluate((element) => getComputedStyle(element).color) === EDITED_CSS_COLOR,
  );
  await fs.writeFile(GLOBAL_CSS, originalCss, "utf8");
  await eventually("browser CSS restoration through Next dev", async () =>
    await styledHeader.evaluate((element) => getComputedStyle(element).color) === ORIGINAL_CSS_COLOR,
  );

  const initialAdapters = await adapterDigests();
  const secondSource = originalSource.replace(ORIGINAL_MARKER, SECOND_MARKER);
  const beforeSecond = output.length;
  await fs.writeFile(SOURCE, secondSource, "utf8");
  await eventually("valid Haxe generation", async () =>
    output.slice(beforeSecond).includes(
      `[nextjshx] generation published (1 changed, ${UNCHANGED_ADAPTER_COUNT} unchanged)`,
    ),
  );
  await eventually("valid generated Haxe bytes", async () =>
    (await fs.readFile(GENERATED_SOURCE, "utf8")).includes(SECOND_MARKER),
  );
  const secondAdapters = await adapterDigests();
  assert.deepEqual(
    changedAdapters(initialAdapters, secondAdapters),
    ["app/haxe/page.tsx"],
    "one Haxe page edit should invalidate only its reachable Next adapter",
  );
  await eventually("browser Fast Refresh after a valid Haxe edit", async () =>
    await copy.textContent() === SECOND_MARKER,
  );
  const lastGood = await lastGoodDigest();

  const brokenSource = secondSource.replace(
    "\tpublic static function render",
    "\tpublic static final __devBroken:String = ;\n\n\tpublic static function render",
  );
  assert.notEqual(brokenSource, secondSource, "negative edit anchor drifted");
  const beforeFailure = output.length;
  await fs.writeFile(SOURCE, brokenSource, "utf8");
  await eventually("raw Haxe compile failure", async () =>
    output.slice(beforeFailure).includes("NXHX-CLI-HAXE-0003"),
  );
  assert.equal(dev.exitCode, null, "Haxe failure terminated the dev owner");
  assert.equal(await copy.textContent(), SECOND_MARKER, "browser left the last-good Haxe tree");
  assert.equal(await lastGoodDigest(), lastGood, "failed Haxe compile mutated last-good generated bytes");

  const thirdSource = originalSource.replace(ORIGINAL_MARKER, THIRD_MARKER);
  const beforeRecovery = output.length;
  await fs.writeFile(SOURCE, thirdSource, "utf8");
  await eventually("Haxe recovery", async () =>
    output.slice(beforeRecovery).includes(
      `Haxe recovered; generation published (1 changed, ${UNCHANGED_ADAPTER_COUNT} unchanged)`,
    ),
  );
  await eventually("recovered generated Haxe bytes", async () =>
    (await fs.readFile(GENERATED_SOURCE, "utf8")).includes(THIRD_MARKER),
  );
  const thirdAdapters = await adapterDigests();
  assert.deepEqual(
    changedAdapters(secondAdapters, thirdAdapters),
    ["app/haxe/page.tsx"],
    "Haxe recovery should invalidate only its reachable Next adapter",
  );
  await eventually("browser Fast Refresh after Haxe recovery", async () =>
    await copy.textContent() === THIRD_MARKER,
  );

  const beforeRestoration = output.length;
  await fs.writeFile(SOURCE, originalSource, "utf8");
  await eventually("fixture restoration generation", async () =>
    output.slice(beforeRestoration).includes(
      `[nextjshx] generation published (1 changed, ${UNCHANGED_ADAPTER_COUNT} unchanged)`,
    ),
  );
  await eventually("restored generated Haxe bytes", async () =>
    (await fs.readFile(GENERATED_SOURCE, "utf8")).includes(ORIGINAL_MARKER),
  );
  const restoredAdapters = await adapterDigests();
  assert.deepEqual(
    changedAdapters(thirdAdapters, restoredAdapters),
    ["app/haxe/page.tsx"],
    "fixture restoration should invalidate only its reachable Next adapter",
  );
  await eventually("fixture restoration rebuild", async () =>
    await copy.textContent() === ORIGINAL_MARKER,
  );
  const ownedHaxePids = ownedHaxeServerPids(output);
  assert.equal(ownedHaxePids.size, 1, "the integration fixture should own exactly one Haxe server");
  const stopped = await stopDev(dev, devExit);
  assert.equal(stopped.code, 143, `SIGTERM should produce exit 143, received ${stopped.code ?? stopped.signal}`);
  await eventually("owned Haxe server cleanup", async () => {
    return [...ownedHaxePids].every((pid) => !processAlive(pid));
  }, 8_000);
  await eventually("Next dev listener cleanup", async () => {
    try {
      await fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(250) });
      return false;
    } catch {
      return true;
    }
  }, 8_000);
  dev = null;
  devExit = null;
  console.log(
    "[dev-loop] OK: one command handled native CSS updates and Haxe Fast Refresh, retained exact last-good bytes on a Haxe error, recovered, and cleaned up",
  );
} catch (error) {
  console.error(`[dev-loop] ERROR: ${error.message}\n${output}`);
  process.exitCode = 1;
} finally {
  if (originalSource !== null) {
    await fs.writeFile(SOURCE, originalSource, "utf8");
  }
  if (originalCss !== null) {
    await fs.writeFile(GLOBAL_CSS, originalCss, "utf8");
  }
  if (browser !== null) {
    await browser.close();
  }
  if (dev !== null && devExit !== null) {
    await stopDev(dev, devExit).catch(() => undefined);
  }
  await removeGeneratedState();
  await removeCreatedLinks(createdLinks);
}
