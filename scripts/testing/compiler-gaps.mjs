#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const FIXTURE = path.join(ROOT, "tests/compiler-gaps");
const OUT = path.join(FIXTURE, "out");
const TSC = path.join(ROOT, "node_modules/typescript/bin/tsc6");
const HAXE_VERSION = "4.3.7";

class CompilerGapFailure extends Error {}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    encoding: "utf8",
    stdio: "inherit",
  });
  if (result.error !== undefined) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new CompilerGapFailure(`${command} exited ${result.status}`);
  }
}

function read(relative) {
  const file = path.join(FIXTURE, relative);
  assert(fs.statSync(file).isFile(), `${relative} must exist`);
  return fs.readFileSync(file, "utf8").replaceAll("\\", "/");
}

function absent(relative) {
  assert(!fs.existsSync(path.join(FIXTURE, relative)), `${relative} must remain absent`);
}

function verifyVersion() {
  const result = spawnSync("haxe", ["--version"], {
    cwd: ROOT,
    encoding: "utf8",
  });
  if (result.error !== undefined) {
    throw result.error;
  }
  assert.equal(result.status, 0, "haxe --version failed");
  assert.equal(result.stdout.trim(), HAXE_VERSION, `expected Haxe ${HAXE_VERSION}`);
}

function verifyFrameworkNeutralSource() {
  const sourceRoot = path.join(FIXTURE, "src");
  const pending = [sourceRoot];
  while (pending.length > 0) {
    const directory = pending.pop();
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        pending.push(absolute);
      } else if (entry.isFile()) {
        const source = fs.readFileSync(absolute, "utf8");
        assert.doesNotMatch(source, /next(?:js|jshx)?|react/i, `${entry.name} is not generic`);
      } else {
        throw new CompilerGapFailure(`fixture source cannot contain links: ${absolute}`);
      }
    }
  }
}

function verifyCurrentOutput() {
  const tsDirective = read("out/typescript/compiler_gaps/DirectiveBoundary.ts");
  const jsDirective = read("out/classic/compiler_gaps/DirectiveBoundary.js");
  for (const [profile, source] of [
    ["TypeScript", tsDirective],
    ["classic JavaScript", jsDirective],
  ]) {
    const directive = source.indexOf('"generic-mode";');
    const dependencyImport = source.indexOf('import {Dependency} from "./Dependency.js"');
    const declaration = source.indexOf("DirectiveBoundary");
    assert(directive >= 0, `${profile} lost the generic module directive`);
    assert(dependencyImport >= 0, `${profile} lost the reduced import edge`);
    assert(directive < dependencyImport, `${profile} placed the directive after an import`);
    assert(dependencyImport < declaration, `${profile} import ordering drifted`);
  }

  const tsExport = read("out/typescript/compiler_gaps/ExportBoundary.ts");
  const jsExport = read("out/classic/compiler_gaps/ExportBoundary.js");
  const tsRoot = read("out/typescript/index.ts");
  const jsRoot = read("out/classic/index.js");
  const dtsRoot = read("out/classic/index.d.ts");
  for (const [profile, source] of [
    ["TypeScript module", tsExport],
    ["classic JavaScript module", jsExport],
    ["TypeScript root", tsRoot],
    ["classic JavaScript root", jsRoot],
    ["classic declaration root", dtsRoot],
  ]) {
    assert(!source.includes("export default"), `${profile} unexpectedly gained a default export`);
  }
  assert.match(tsExport, /export const exportedLabel\s*=/);
  assert.match(jsExport, /export const exportedLabel\s*=/);
  for (const source of [tsRoot, jsRoot, dtsRoot]) {
    assert.match(
      source,
      /export \{exportedLabel\} from "\.\/compiler_gaps\/ExportBoundary\.js"/,
    );
  }

  const tsExternal = read("out/typescript/compiler_gaps/ExternalEntry.ts");
  const jsExternal = read("out/classic/compiler_gaps/ExternalEntry.js");
  const dtsExternal = read("out/classic/compiler_gaps/ExternalEntry.d.ts");
  assert.match(tsExternal, /export class ExternalEntry/);
  assert.match(tsExternal, /static label\(\): string/);
  assert.match(jsExternal, /export const ExternalEntry/);
  assert.match(dtsExternal, /export declare class ExternalEntry/);
  assert.match(dtsExternal, /static label\(\): string/);
  for (const extension of ["ts", "js", "d.ts"]) {
    const profile = extension === "ts" ? "typescript" : "classic";
    absent(`out/${profile}/compiler_gaps/UnretainedEntry.${extension}`);
  }
}

try {
  verifyVersion();
  verifyFrameworkNeutralSource();
  fs.rmSync(OUT, { recursive: true, force: true });
  run("haxe", ["tests/compiler-gaps/build-typescript.hxml"]);
  run("haxe", ["tests/compiler-gaps/build-classic.hxml"]);
  verifyCurrentOutput();
  run(process.execPath, [TSC, "--project", "tests/compiler-gaps/tsconfig.typescript.json"]);
  run(process.execPath, [TSC, "--project", "tests/compiler-gaps/tsconfig.classic.json"]);
  console.log(
    "[compiler-gaps] OK: 1 resolved capability, 1 deferred shape, and 1 DCE policy verified in both output profiles",
  );
} catch (error) {
  console.error(`[compiler-gaps] ERROR: ${error.message}`);
  process.exitCode = 1;
} finally {
  fs.rmSync(OUT, { recursive: true, force: true });
}
