#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import net from "node:net";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import typescriptParser from "@typescript-eslint/parser";
import { ESLint } from "eslint";
import reactHooks from "eslint-plugin-react-hooks";
import { chromium } from "playwright-core";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const APP = path.join(ROOT, "examples/mixed-adoption");
const CLI = path.join(ROOT, "tools/cli/.tmp/src/cli.js");
const NEXT = path.join(ROOT, "node_modules/next/dist/bin/next");
const TSC = path.join(ROOT, "node_modules/typescript/bin/tsc6");
const PORT = 3417;
const EXPECTED_OUTPUTS = Object.freeze([
  "app/_nextjshx/client/c7daa5458af6/HaxePatchConsole.tsx",
  "app/_nextjshx/hook/4aa28d4a55e4/useBridgeChannel.ts",
  "app/haxe-lab/page.tsx",
]);
const PRESERVED_INPUTS = Object.freeze([
  ".gitignore",
  "app/environment.d.ts",
  "app/layout.tsx",
  "app/page.tsx",
  "app/native-bridge-deck.tsx",
  "native/signal-card.tsx",
  "native/signal-format.ts",
  "native/use-signal.ts",
  "next.config.mjs",
  "nextjshx.config.json",
  "nextjshx.hxml",
  "package.json",
  "tsconfig.json",
]);
const COMMAND_ENV = Object.freeze({
  ...process.env,
  CI: "1",
  NO_COLOR: "1",
  NEXT_TELEMETRY_DISABLED: "1",
});

class MixedAdoptionFailure extends Error {}

function commandLine(command, args) {
  return [command, ...args]
    .map((value) =>
      /^[A-Za-z0-9_./:=@-]+$/.test(value) ? value : JSON.stringify(value),
    )
    .join(" ");
}

function execute(command, args, options = {}) {
  const cwd = options.cwd ?? ROOT;
  console.log(`[mixed-adoption] $ ${commandLine(command, args)}`);
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    env: COMMAND_ENV,
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.error !== undefined) {
    throw result.error;
  }
  if (options.expectFailure === true) {
    assert.notEqual(result.status, 0, `${commandLine(command, args)} unexpectedly passed`);
  } else {
    if (result.stdout.length > 0) process.stdout.write(result.stdout);
    if (result.stderr.length > 0) process.stderr.write(result.stderr);
    assert.equal(result.status, 0, `${commandLine(command, args)} failed`);
  }
  return `${result.stdout}${result.stderr}`;
}

async function exists(file) {
  try {
    await fs.access(file);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

async function digest(file) {
  return createHash("sha256").update(await fs.readFile(file)).digest("hex");
}

async function preservedDigests() {
  return new Map(
    await Promise.all(
      PRESERVED_INPUTS.map(async (relative) => [
        relative,
        await digest(path.join(APP, relative)),
      ]),
    ),
  );
}

function assertNoBroadHaxe(relative, source) {
  const code = source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "");
  for (const forbidden of [
    /\bDynamic\b/,
    /\bAny\b/,
    /\buntyped\b/,
    /\bReflect\b/,
    /genes\.ts\.Unknown/,
    /\bcast\s*(?:\(|[A-Za-z_{[])/,
  ]) {
    assert(!forbidden.test(code), `${relative} contains ${forbidden}`);
  }
}

async function verifySource() {
  const haxeRoot = path.join(APP, "haxe");
  const pending = [haxeRoot];
  while (pending.length > 0) {
    const directory = pending.pop();
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) {
        throw new MixedAdoptionFailure(`${path.relative(ROOT, absolute)} is a symlink`);
      }
      if (entry.isDirectory()) pending.push(absolute);
      if (entry.isFile() && entry.name.endsWith(".hx")) {
        assertNoBroadHaxe(
          path.relative(ROOT, absolute),
          await fs.readFile(absolute, "utf8"),
        );
      }
    }
  }
  const bridge = await fs.readFile(path.join(APP, "app/native-bridge-deck.tsx"), "utf8");
  for (const fragment of [
    '"use client"',
    "HaxePatchConsole",
    "useBridgeChannel",
    "haxeInteropLabel",
  ]) {
    assert(bridge.includes(fragment), `native bridge lost ${fragment}`);
  }
  assert(!bridge.includes("REPLACE_"), "native bridge retains an adapter placeholder");
}

function runCli(args, options = {}) {
  return execute(process.execPath, [CLI, ...args], { cwd: APP, ...options });
}

async function clean() {
  if (await exists(path.join(APP, "nextjshx.config.json"))) {
    runCli(["clean", "--json"]);
  }
  await fs.rm(path.join(APP, "src-gen"), { recursive: true, force: true });
  await fs.rm(path.join(APP, ".next"), { recursive: true, force: true });
  await fs.rm(path.join(APP, ".nextjshx"), { recursive: true, force: true });
  await fs.rm(path.join(APP, "next-env.d.ts"), { force: true });
  await fs.rm(path.join(APP, "public/styles.css"), { force: true });
  await fs.rm(path.join(APP, "tsconfig.tsbuildinfo"), { force: true });
}

async function verifyInitPreservesNative() {
  const before = await preservedDigests();
  const libraries = path.join(APP, "haxe_libraries");
  const haxerc = path.join(APP, ".haxerc");
  await fs.mkdir(libraries);
  await fs.copyFile(
    path.join(ROOT, "haxe_libraries/genes-ts.hxml"),
    path.join(libraries, "genes-ts.hxml"),
  );
  await fs.copyFile(
    path.join(ROOT, "haxe_libraries/helder.set.hxml"),
    path.join(libraries, "helder.set.hxml"),
  );
  await fs.writeFile(
    path.join(libraries, "nextjshx.hxml"),
    `# Test-only stand-in for the installed NextJsHx Lix scope.\n-cp ${path.join(ROOT, "src")}\n-D nextjshx=0.0.0-development\n`,
    "utf8",
  );
  await fs.writeFile(
    haxerc,
    '{\n  "version": "4.3.7",\n  "resolveLibs": "scoped"\n}\n',
    "utf8",
  );
  try {
    const output = JSON.parse(runCli(["init", "--json"]));
    assert.equal(output.ok, true);
    assert.equal(
      output.result.scripts.find((script) => script.name === "dev").action,
      "preserved",
    );
    assert.deepEqual(await preservedDigests(), before);
  } finally {
    await fs.rm(libraries, { recursive: true, force: true });
    await fs.rm(haxerc, { force: true });
  }
}

async function verifyOwnershipCollision() {
  const target = path.join(APP, "app/haxe-lab/page.tsx");
  await fs.mkdir(path.dirname(target), { recursive: true });
  const nativeBytes = "export default function NativeCollision() { return null; }\n";
  await fs.writeFile(target, nativeBytes, "utf8");
  try {
    const failure = runCli(["generate", "--no-check", "--json"], {
      expectFailure: true,
    });
    assert.match(failure, /existing unowned target|unowned/i);
    assert.equal(await fs.readFile(target, "utf8"), nativeBytes);
  } finally {
    await fs.rm(target, { force: true });
  }
}

async function verifyBoundaryNegatives() {
  const haxeFailure = execute(
    "haxe",
    ["tests/mixed-adoption/build-negative.hxml"],
    { expectFailure: true },
  );
  assert.match(haxeFailure, /\[NXHX-SERIALIZABLE-PROP-0001\] props\.onCommit/);

  const negativeRoute = path.join(APP, "app/negative/page.tsx");
  await fs.mkdir(path.dirname(negativeRoute), { recursive: true });
  await fs.copyFile(
    path.join(ROOT, "tests/mixed-adoption/native-server-hook-page.tsx"),
    negativeRoute,
  );
  try {
    const nextFailure = execute(process.execPath, [NEXT, "build", "."], {
      cwd: APP,
      expectFailure: true,
    });
    assert.match(nextFailure, /useBridgeChannel|Client Component|client module/i);
  } finally {
    await fs.rm(path.join(APP, "app/negative"), {
      recursive: true,
      force: true,
    });
  }
}

const REACT_LINTER = new ESLint({
  overrideConfigFile: true,
  overrideConfig: [
    {
      files: ["**/*.{ts,tsx}"],
      languageOptions: {
        parser: typescriptParser,
        parserOptions: {
          ecmaFeatures: { jsx: true },
          ecmaVersion: "latest",
          sourceType: "module",
        },
      },
      plugins: { "react-hooks": reactHooks },
      rules: {
        "react-hooks/exhaustive-deps": "error",
        "react-hooks/purity": "error",
        "react-hooks/rules-of-hooks": "error",
      },
    },
  ],
});

async function verifyReactLint() {
  const files = [
    "app/native-bridge-deck.tsx",
    "native/use-signal.ts",
    "src-gen/mixed_adoption/client/HaxeHooks.tsx",
    "src-gen/mixed_adoption/client/HaxePatchConsole.tsx",
    ...EXPECTED_OUTPUTS.slice(0, 2),
  ];
  for (const relative of files) {
    const absolute = path.join(APP, relative);
    const results = await REACT_LINTER.lintText(
      await fs.readFile(absolute, "utf8"),
      { filePath: absolute },
    );
    const messages = results.flatMap((result) => result.messages);
    assert.equal(
      messages.filter((message) => message.severity === 2).length,
      0,
      `${relative}: ${messages.map((message) => `${message.ruleId}: ${message.message}`).join(" | ")}`,
    );
  }
}

async function verifyGeneratedShape() {
  const manifest = JSON.parse(
    await fs.readFile(path.join(APP, ".nextjshx/manifest.json"), "utf8"),
  );
  assert.deepEqual(
    manifest.outputs.map((output) => output.path).sort(),
    [...EXPECTED_OUTPUTS].sort(),
  );
  const component = await fs.readFile(path.join(APP, EXPECTED_OUTPUTS[0]), "utf8");
  const hook = await fs.readFile(path.join(APP, EXPECTED_OUTPUTS[1]), "utf8");
  const index = await fs.readFile(path.join(APP, "src-gen/index.tsx"), "utf8");
  assert(component.startsWith('"use client";\n'));
  assert(hook.startsWith('"use client";\n'));
  assert.match(component, /ComponentType<Parameters<typeof HaxePatchConsole\.render>\[0\]>/);
  assert.match(hook, /typeof HaxeHooks\.useBridgeChannel/);
  assert.match(index, /export \{haxeInteropLabel\}/);
  for (const source of [component, hook, index]) {
    assert(!/\sas\s|\b(?:any|unknown)\b|unsafeCast|Register\.unsafeCast/.test(source));
  }

  const routeReport = JSON.parse(runCli(["routes", "--check", "--json"]));
  const routes = new Map(
    routeReport.result.routes.map((route) => [route.publicPattern, route]),
  );
  assert.equal(routes.get("/")?.origin, "native");
  assert.equal(routes.get("/haxe-lab")?.origin, "haxe");
  assert.equal(routes.get("/haxe-lab")?.ownership, "owned-current");
}

async function browserExecutable() {
  const configured = process.env.NEXTJSHX_CHROME;
  if (configured !== undefined && !path.isAbsolute(configured)) {
    throw new MixedAdoptionFailure(
      "NEXTJSHX_CHROME must be an absolute executable path",
    );
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
      if (error.code !== "ENOENT" && error.code !== "EACCES") throw error;
    }
  }
  throw new MixedAdoptionFailure(
    "no Chrome/Chromium executable found; configure NEXTJSHX_CHROME",
  );
}

async function waitForPort(port) {
  const started = Date.now();
  while (Date.now() - started < 15_000) {
    const ready = await new Promise((resolve) => {
      const socket = net.createConnection({ host: "127.0.0.1", port });
      socket.once("connect", () => {
        socket.destroy();
        resolve(true);
      });
      socket.once("error", () => resolve(false));
    });
    if (ready) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new MixedAdoptionFailure(`Next server did not open port ${port}`);
}

async function verifyBrowser() {
  const server = spawn(process.execPath, [NEXT, "start", "--port", String(PORT)], {
    cwd: APP,
    env: COMMAND_ENV,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let browser;
  try {
    await waitForPort(PORT);
    browser = await chromium.launch({
      executablePath: await browserExecutable(),
      headless: true,
    });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    await page.goto(`http://127.0.0.1:${PORT}`, { waitUntil: "networkidle" });
    await page.getByRole("heading", { name: /Keep the app/ }).waitFor();
    await page.getByRole("button", { name: "03" }).click();
    await page.getByText("typed Hook", { exact: true }).waitFor();
    await page.getByRole("button", { name: "+ 04" }).click();
    await page.getByText("72 DB", { exact: true }).first().waitFor();
    await page.getByRole("button", { name: "switch mode" }).click();
    await page.getByText("transmit", { exact: true }).waitFor();
    await page.getByRole("link", { name: /Cross into the Haxe-owned signal lab/ }).click();
    await page.waitForURL(`http://127.0.0.1:${PORT}/haxe-lab`);
    await page.getByRole("heading", { name: /Reverse the current/ }).waitFor();
    await page.getByRole("button", { name: "+ 04" }).click();
    await page.getByText("56 DB", { exact: true }).first().waitFor();

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`http://127.0.0.1:${PORT}`, { waitUntil: "networkidle" });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    assert(overflow <= 1, `mobile layout has ${overflow}px horizontal overflow`);
  } finally {
    await browser?.close();
    server.kill("SIGTERM");
    await new Promise((resolve) => server.once("exit", resolve));
  }
}

async function verify() {
  execute(process.execPath, ["tools/cli/scripts/ensure-build.mjs", "runtime"]);
  await clean();
  await verifySource();
  await verifyOwnershipCollision();
  await verifyInitPreservesNative();
  runCli(["generate", "--no-check", "--json"]);
  execute("npm", ["run", "styles", "--workspace", "@nextjshx/mixed-adoption"]);
  await verifyBoundaryNegatives();
  execute("npm", ["run", "build", "--workspace", "@nextjshx/mixed-adoption"]);
  execute(TSC, ["--project", "tsconfig.json", "--noEmit"], { cwd: APP });
  await verifyReactLint();
  await verifyGeneratedShape();
  await verifyBrowser();
  console.log("[mixed-adoption] OK: bidirectional interop, ownership, production build, and browser behavior");
}

const command = process.argv[2] ?? "verify";
try {
  if (command === "source") {
    await verifySource();
  } else if (command === "clean") {
    await clean();
  } else if (command === "verify") {
    await verify();
  } else {
    throw new MixedAdoptionFailure(`unknown command ${JSON.stringify(command)}`);
  }
} finally {
  if (command === "verify") {
    await clean();
  }
}
