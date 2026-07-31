#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const FIXTURE = path.join(ROOT, "tests/clientification-boundaries/next-app");
const CLI = path.join(ROOT, "tools/cli/.tmp/src/cli.js");
const LINKED_PACKAGES = ["next", "react", "react-dom", "typescript"];
const GENERATED = [
  "app/_nextjshx",
  "app/high/page.tsx",
  "app/leaf/page.tsx",
  "src-gen",
  ".nextjshx",
  ".next",
  "node_modules",
  "next-env.d.ts",
  "tsconfig.tsbuildinfo",
];

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? ROOT,
    encoding: "utf8",
    env: {
      ...process.env,
      NEXT_TELEMETRY_DISABLED: "1",
    },
  });
  if (result.error !== undefined) {
    throw result.error;
  }
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  const expected = options.expectedStatus ?? 0;
  assert.equal(
    result.status,
    expected,
    `${command} ${args.join(" ")} exited ${String(result.status)}\n${output}`,
  );
  return output;
}

function clean() {
  for (const relative of GENERATED) {
    fs.rmSync(path.join(FIXTURE, relative), { recursive: true, force: true });
  }
  for (const relative of ["app/high", "app/leaf"]) {
    try {
      fs.rmdirSync(path.join(FIXTURE, relative));
    } catch (error) {
      if (error.code !== "ENOENT" && error.code !== "ENOTEMPTY") {
        throw error;
      }
    }
  }
}

function linkDependencies() {
  const modules = path.join(FIXTURE, "node_modules");
  fs.mkdirSync(modules, { recursive: true });
  for (const name of LINKED_PACKAGES) {
    fs.symlinkSync(path.join(ROOT, "node_modules", name), path.join(modules, name), "dir");
  }
}

function reportBoundary(report, owner) {
  const boundary = report.boundaries.find((candidate) => candidate.owner === owner);
  assert(boundary !== undefined, `missing ${owner} boundary evidence`);
  return boundary;
}

function verifyReport() {
  const first = run(process.execPath, [CLI, "boundaries", "--json"], { cwd: FIXTURE });
  const second = run(process.execPath, [CLI, "boundaries", "--json"], { cwd: FIXTURE });
  assert.equal(second, first, "boundary report bytes changed without source/build changes");
  assert.equal(first.includes(ROOT), false, "machine report leaked a machine-local root");
  const envelope = JSON.parse(first);
  assert.equal(envelope.ok, true);
  const report = envelope.result;
  assert.equal(report.projectRoot, ".");
  assert.deepEqual(report.evidence, {
    haxe: "complete",
    next: "all-client-adapters-observed",
  });

  const leaf = reportBoundary(report, "clientification.client.LeafToggle");
  const high = reportBoundary(report, "clientification.client.HighDashboard");
  assert.equal(leaf.nextArtifacts.evidence, "next-observed");
  assert.equal(high.nextArtifacts.evidence, "next-observed");
  assert.equal(typeof leaf.nextArtifacts.bytes, "number");
  assert.equal(typeof high.nextArtifacts.bytes, "number");
  assert(
    high.nextArtifacts.bytes > leaf.nextArtifacts.bytes,
    `high boundary (${high.nextArtifacts.bytes}) did not exceed leaf (${leaf.nextArtifacts.bytes})`,
  );
  assert(
    high.dependencies.some(
      (dependency) =>
        dependency.moduleName === "clientification.shared.FeatureCatalogue" &&
        dependency.classification === "shared-pure",
    ),
    "negative control did not clientify the substantial shared catalogue",
  );
  assert(
    !leaf.dependencies.some(
      (dependency) => dependency.moduleName === "clientification.shared.FeatureCatalogue",
    ),
    "leaf boundary unexpectedly pulled the server-rendered catalogue into its Haxe subtree",
  );
  for (const boundary of [leaf, high]) {
    assert.equal(boundary.evidence, "haxe-known");
    assert.match(boundary.propsContract, /^ComponentType<Parameters</);
    assert(boundary.nextArtifacts.chunks.length > 0);
    assert(boundary.nextArtifacts.manifests.length > 0);
    assert(
      boundary.warnings.some(
        (warning) =>
          warning.remediation.includes("smallest interactive leaf") &&
          warning.remediation.includes("server-rendered content"),
      ),
      `${boundary.owner} has no concrete boundary-budget remediation`,
    );
  }

  const leafPage = reportBoundary(report, "clientification.app.LeafPage");
  const highPage = reportBoundary(report, "clientification.app.HighPage");
  assert.equal(leafPage.references[0]?.targetOwner, "clientification.client.LeafToggle");
  assert.equal(highPage.references[0]?.targetOwner, "clientification.client.HighDashboard");

  const leafHtml = fs.readFileSync(path.join(FIXTURE, ".next/server/app/leaf.html"), "utf8");
  const highHtml = fs.readFileSync(path.join(FIXTURE, ".next/server/app/high.html"), "utf8");
  for (const html of [leafHtml, highHtml]) {
    assert(html.includes("One interface, two component boundaries"));
    assert(html.includes("Interactions"));
    assert(html.includes(": 0</button>"));
    assert(html.includes("Architecture observatory"));
  }

  process.stdout.write(
    `clientification boundaries: leaf=${leaf.nextArtifacts.bytes} bytes, ` +
      `high=${high.nextArtifacts.bytes} bytes, delta=` +
      `${high.nextArtifacts.bytes - leaf.nextArtifacts.bytes} bytes\n`,
  );
}

function verifySources() {
  assert.equal(process.versions.node, "20.19.3");
  assert.equal(run("haxe", ["--version"]).trim(), "4.3.7");
  const files = [];
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const candidate = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        visit(candidate);
      } else if (entry.isFile() && entry.name.endsWith(".hx")) {
        files.push(candidate);
      }
    }
  };
  visit(path.join(FIXTURE, "haxe"));
  for (const file of files) {
    const source = fs.readFileSync(file, "utf8");
    assert(!/\b(?:Dynamic|Any|untyped|cast|Reflect)\b/.test(source), file);
  }
}

try {
  clean();
  verifySources();
  run(process.execPath, ["tools/cli/scripts/ensure-build.mjs", "runtime"]);
  linkDependencies();
  const build = run(process.execPath, [CLI, "build", "--", "--turbopack"], {
    cwd: FIXTURE,
  });
  assert(build.includes("build: passed"));
  verifyReport();
} finally {
  clean();
}
