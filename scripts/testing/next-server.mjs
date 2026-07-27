#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const FIXTURE = path.join(ROOT, "tests/next-server");
const OUTPUT = path.join(FIXTURE, ".tmp");
const TSC = path.join(ROOT, "node_modules/typescript/bin/tsc6");

class NextServerFailure extends Error {}

function run(command, args, expectedStatus = 0) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    encoding: "utf8",
    env: { ...process.env, CI: "1", NO_COLOR: "1", NEXT_TELEMETRY_DISABLED: "1" },
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.error !== undefined) {
    throw result.error;
  }
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  if (result.status !== expectedStatus) {
    throw new NextServerFailure(
      `${path.basename(command)} ${args.join(" ")} exited ${result.status}; expected ${expectedStatus}:\n${output}`,
    );
  }
  return output;
}

function emitted(relative) {
  const file = path.join(OUTPUT, ...relative.split("/"));
  assert(fs.statSync(file).isFile(), `${relative} must be emitted`);
  return fs.readFileSync(file, "utf8");
}

function collectFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    return entry.isDirectory() ? collectFiles(absolute) : [absolute];
  });
}

function verifyPositiveOutput() {
  const consumer = emitted("next_server/ServerConsumer.ts");
  for (const expected of [
    /from "next\/cache"/,
    /from "next\/headers"/,
    /from "next\/server"/,
    /import \{NextRequest, URLPattern, after, connection, userAgentFromString, userAgent, NextResponse\} from "next\/server"/,
    /import type \{NextFetchEvent\} from "next\/server"/,
  ]) {
    assert.match(consumer, expected, `direct public import is missing: ${expected}`);
  }

  const runtimeImports = consumer
    .split("\n")
    .filter((line) => /^import (?!type\b)/.test(line))
    .join("\n");
  assert(
    !runtimeImports.includes("/nextjs/raw/"),
    "a B05 Haxe extern became a local runtime wrapper import",
  );

  for (const evidence of [
    "cacheLife(\"minutes\")",
    "cacheLife(\"inventory\")",
    "cacheTag(\"todos\", \"tenant:42\")",
    "revalidatePath(\"/todos\", \"page\")",
    "revalidateTag(\"todos\", \"max\")",
    "unstable_cache(callback",
    "unstable_cacheLife(\"hours\")",
    "unstable_cacheTag(\"legacy\")",
    "unstable_noStore()",
    "await headers()",
    "await cookies()",
    "await draftMode()",
    "mutableCookies.set",
    "new NextRequest(",
    "NextResponse.json(",
    "NextResponse.redirect(",
    "NextResponse.rewrite(",
    "NextResponse.next(",
    "new URLPattern(",
    "after(Promise.resolve",
    "connection()",
    "userAgentFromString(",
    "userAgent({\"headers\"",
    "import('next/server').MiddlewareConfig",
    "import('next/server').ProxyConfig",
    "import('next/server').NextMiddleware",
    "import('next/server').NextProxy",
  ]) {
    assert(consumer.includes(evidence), `positive fixture did not exercise ${evidence}`);
  }

  assert.match(
    consumer,
    /request: Omit<import\('next\/server'\)\.NextRequest, 'json'> & \{ json\(\): Promise<unknown> \}/,
    "NextRequest JSON did not remain an explicit unknown boundary",
  );
  assert.match(
    consumer,
    /Promise<Omit<globalThis\.Response, 'json'> & \{ json\(\): Promise<unknown> \}>/,
    "route-handler response did not use the safe Web Response projection",
  );
  assert.match(
    consumer,
    /const response: Omit<import\('next\/server'\)\.NextResponse<\{[\s\S]*json\(\): Promise<\{/,
    "locally created JSON responses did not retain their body type",
  );

  const curatedOutput = collectFiles(path.join(OUTPUT, "nextjs", "raw"))
    .filter((file) => file.endsWith(".ts"))
    .map((file) => fs.readFileSync(file, "utf8"))
    .join("\n");
  const publicBoundary = `${consumer}\n${curatedOutput}`;
  assert(!publicBoundary.includes("next/dist"), "B05 emitted a private Next import");
  assert(!/\bany\b/.test(publicBoundary), "B05 widened a generated boundary to TypeScript any");
  assert(!publicBoundary.includes("/Users/"), "B05 emitted a machine-local path");

  const middlewareTypes = emitted("nextjs/raw/server/MiddlewareConfig.ts");
  assert(!/\?:[^\n]*\| null/.test(middlewareTypes), "proxy option fields widened undefined to null");
}

function verifyHaxeFailures() {
  const cases = [
    ["tests/next-server/build-negative-cache-profile.hxml", /String should be nextjs\.raw\.cache\.CacheLifeProfile/],
    ["tests/next-server/build-negative-revalidate-tag.hxml", /Not enough arguments, expected profile/],
    ["tests/next-server/build-negative-readonly-headers.hxml", /ReadonlyHeaders has no field set/],
    ["tests/next-server/build-negative-readonly-cookies.hxml", /ReadonlyRequestCookies has no field set/],
    ["tests/next-server/build-negative-matcher.hxml", /Object requires field value/],
    ["tests/next-server/build-negative-json.hxml", /genes\.ts\.Unknown should be String/],
  ];
  for (const [build, diagnostic] of cases) {
    assert.match(run("haxe", [build], 1), diagnostic, `${build} diagnostic drifted`);
  }
}

function verifyTypeScriptControls() {
  run(TSC, ["--project", "tests/next-server/tsconfig.blindspot.json", "--pretty", "false"]);
  const diagnostics = run(
    TSC,
    ["--project", "tests/next-server/tsconfig.invalid.json", "--pretty", "false"],
    2,
  );
  for (const expected of [
    /Argument of type '"segment"' is not assignable/,
    /Expected 2 arguments, but got 1/,
    /Type 'string' is not assignable to type 'Promise<any>'/,
    /Argument of type '"temporary"' is not assignable/,
    /Argument of type '42' is not assignable to parameter of type 'URLPatternInput/,
    /Type 'string' is not assignable to type 'Headers'/,
    /Type 'number' is not assignable to type 'NextMiddlewareResult/,
    /Type 'unknown' is not assignable to type 'string'/,
  ]) {
    assert.match(diagnostics, expected, `strict TypeScript diagnostic drifted: ${expected}`);
  }
}

try {
  fs.rmSync(OUTPUT, { recursive: true, force: true });
  run("haxe", ["tests/next-server/build-typescript.hxml"]);
  verifyPositiveOutput();
  run(TSC, ["--project", "tests/next-server/tsconfig.json", "--pretty", "false"]);
  verifyHaxeFailures();
  verifyTypeScriptControls();
  console.log(
    "[next-server] OK: 27 P0 Web/server exports, direct imports, six Haxe failures, eight TypeScript failures, and the upstream JSON-any negative control",
  );
} catch (error) {
  console.error(`[next-server] ERROR: ${error.message}`);
  process.exitCode = 1;
} finally {
  fs.rmSync(OUTPUT, { recursive: true, force: true });
}
