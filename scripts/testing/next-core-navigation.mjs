#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const FIXTURE = path.join(ROOT, "tests/next-core-navigation");
const OUTPUT = path.join(FIXTURE, ".tmp");
const TSC = path.join(ROOT, "node_modules/typescript/bin/tsc6");

class CoreNavigationFailure extends Error {}

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
    throw new CoreNavigationFailure(
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

function verifyPositiveOutput() {
  const consumer = emitted("next_core_navigation/CoreNavigationConsumer.ts");
  assert.match(consumer, /import \* as Navigation from "next\/navigation"/);
  assert.match(consumer, /import \* as Router from "next\/compat\/router"/);
  assert(!consumer.includes("next/dist"), "generated consumer imported a private Next path");
  assert(!/\bany\b/.test(consumer), "B03 consumer widened a boundary to TypeScript any");
  assert.match(
    consumer,
    /Omit<import\('next'\)\.NextConfig, 'sassOptions'>.*\[key: string\]: unknown/,
    "NextConfig's reviewed upstream any was not mapped to unknown",
  );
  assert.match(consumer, /const metadata: import\('next'\)\.Metadata/);
  assert.match(consumer, /const viewport: import\('next'\)\.Viewport/);
  assert.match(consumer, /const route: import\('next'\)\.Route<unknown>/);

  for (const call of [
    "Navigation.usePathname()",
    "Navigation.useParams()",
    "Navigation.useSearchParams()",
    "Navigation.useSelectedLayoutSegment()",
    "Navigation.useSelectedLayoutSegments()",
    "Navigation.useRouter()",
    "Navigation.redirect(",
    "Navigation.permanentRedirect(",
    "Navigation.notFound()",
    "Navigation.forbidden()",
    "Navigation.unauthorized()",
    "Router.useRouter()",
  ]) {
    assert(consumer.includes(call), `strict parity consumer did not call ${call}`);
  }
  for (const method of [
    "redirectPush",
    "redirectReplace",
    "redirectRuntimePush",
    "permanent",
    "missing",
    "denied",
    "unauthenticated",
  ]) {
    assert.match(
      consumer,
      new RegExp(`static ${method}\\(\\): never`),
      `${method} lost its non-returning TypeScript contract`,
    );
  }
  for (const method of ["back", "forward", "refresh", "push", "replace", "prefetch"]) {
    assert.match(consumer, new RegExp(`router\\.${method}\\(`));
  }
  for (const method of ["get", "getAll", "has", "entries", "keys", "values", "forEach", "toString"]) {
    assert.match(consumer, new RegExp(`search\\.${method}\\(`));
  }

  const params = emitted("nextjs/raw/navigation/RouteParams.ts");
  assert.match(params, /export type RouteParamValue = string \| string\[\] \| undefined/);
  assert.match(
    params,
    /ReturnType<typeof import\('next\/navigation'\)\.useParams>/,
  );
  assert.match(
    consumer,
    /const search: import\('next\/navigation'\)\.ReadonlyURLSearchParams/,
  );
  assert.match(
    consumer,
    /const entries: IterableIterator<SearchParamEntry> = search\.entries\(\)/,
  );
  const search = emitted("nextjs/raw/navigation/ReadonlyURLSearchParams.ts");
  assert.match(search, /export type SearchParamEntry = \[string, string\]/);
  assert.match(consumer, /Navigation\.redirect\("\/login", Navigation\.RedirectType\.push\)/);
  assert.match(
    consumer,
    /Navigation\.permanentRedirect\("\/moved", Navigation\.RedirectType\.replace\)/,
  );
  assert(!/Navigation\.RedirectType\.(?:push|replace) as/.test(consumer));
}

function verifyHaxeFailures() {
  const cases = [
    ["tests/next-core-navigation/build-negative-readonly.hxml", /has no field set/],
    [
      "tests/next-core-navigation/build-negative-search-entry.hxml",
      /Int should be String/,
    ],
    [
      "tests/next-core-navigation/build-negative-redirect.hxml",
      /String should be nextjs\.raw\.navigation\.RedirectType/,
    ],
    ["tests/next-core-navigation/build-negative-router-options.hxml", /String should be Null<Bool>/],
  ];
  for (const [build, diagnostic] of cases) {
    assert.match(run("haxe", [build], 1), diagnostic, `${build} diagnostic drifted`);
  }
}

function verifyTypeScriptOracleFailure() {
  run("haxe", ["tests/next-core-navigation/build-negative-typescript.hxml"]);
  const result = spawnSync(TSC, [
    "--project",
    "tests/next-core-navigation/tsconfig.invalid.json",
    "--pretty",
    "false",
  ], {
    cwd: ROOT,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1" },
  });
  if (result.error !== undefined) {
    throw result.error;
  }
  assert.notEqual(result.status, 0, "invalid nested Metadata unexpectedly passed strict TypeScript");
  assert.match(
    `${result.stdout ?? ""}${result.stderr ?? ""}`,
    /notAValidTitle.*does not exist in type 'TemplateString'/,
    "Metadata oracle failure did not identify the invalid nested field",
  );
  assert.match(
    `${result.stdout ?? ""}${result.stderr ?? ""}`,
    /Property 'id' is missing in type 'Params' but required in type 'InvalidParams'/,
    "useParams generic constraint was not enforced by Next's public TypeScript type",
  );
}

try {
  fs.rmSync(OUTPUT, { recursive: true, force: true });
  run("haxe", ["tests/next-core-navigation/build-typescript.hxml"]);
  verifyPositiveOutput();
  run(TSC, ["--project", "tests/next-core-navigation/tsconfig.json", "--pretty", "false"]);
  verifyHaxeFailures();
  verifyTypeScriptOracleFailure();
  console.log(
    "[next-core-navigation] OK: 13 navigation exports, 6 core types, nullable compat router, exact never output, 4 Haxe failures, and strict Next type parity",
  );
} catch (error) {
  console.error(`[next-core-navigation] ERROR: ${error.message}`);
  process.exitCode = 1;
} finally {
  fs.rmSync(OUTPUT, { recursive: true, force: true });
}
