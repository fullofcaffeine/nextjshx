import assert from "node:assert/strict";
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  createHaxeWatchPlan,
  discoverNextProject,
  watchHaxeInputs,
  type WatchChange,
} from "../src/index.js";

function writeJson(file: string, value: object): void {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function fixture(): string {
  const root = mkdtempSync(path.join(os.tmpdir(), "nextjshx-watch-inputs-"));
  mkdirSync(path.join(root, "app"), { recursive: true });
  mkdirSync(path.join(root, "haxe"), { recursive: true });
  mkdirSync(path.join(root, "shared"), { recursive: true });
  mkdirSync(path.join(root, "vendor/sample"), { recursive: true });
  mkdirSync(path.join(root, "assets"), { recursive: true });
  mkdirSync(path.join(root, "schema"), { recursive: true });
  writeJson(path.join(root, "package.json"), {
    name: "watch-fixture",
    private: true,
    packageManager: "npm@10.8.2",
    dependencies: { next: "16.2.12" },
  });
  writeJson(path.join(root, "package-lock.json"), {
    name: "watch-fixture",
    lockfileVersion: 3,
  });
  writeJson(path.join(root, "node_modules/next/package.json"), {
    name: "next",
    version: "16.2.12",
    bin: { next: "dist/bin/next" },
  });
  mkdirSync(path.join(root, "node_modules/next/dist/bin"), { recursive: true });
  writeFileSync(path.join(root, "node_modules/next/dist/bin/next"), "#!/usr/bin/env node\n", "utf8");
  writeJson(path.join(root, "nextjshx.config.json"), {
    schemaVersion: 1,
    boundaries: Object.freeze({}),
    appRoot: "app",
    haxe: {
      hxml: "build.hxml",
      generatedRoot: "src-gen",
      defines: ["genes.ts", "genes.ts.no_extension"],
      extraInputs: ["schema/domain.json"],
    },
    next: { package: "next", typedRoutes: true },
    output: { manifest: ".nextjshx/manifest.json", format: "project" },
  });
  writeFileSync(
    path.join(root, "build.hxml"),
    "-cp haxe\nnested.hxml\n-resource assets/message.txt@message\n-lib sample\n-js src-gen/index.tsx\n",
    "utf8",
  );
  writeFileSync(path.join(root, "nested.hxml"), "--class-path shared\n", "utf8");
  mkdirSync(path.join(root, "haxe_libraries"), { recursive: true });
  writeFileSync(path.join(root, "haxe_libraries/sample.hxml"), "-cp vendor/sample\n", "utf8");
  writeJson(path.join(root, ".haxerc"), { version: "4.3.7", resolveLibs: "scoped" });
  writeFileSync(path.join(root, "haxe/Main.hx"), "class Main {}\n", "utf8");
  writeFileSync(path.join(root, "shared/Label.hx"), "class Label {}\n", "utf8");
  writeFileSync(path.join(root, "vendor/sample/Library.hx"), "class Library {}\n", "utf8");
  writeFileSync(path.join(root, "assets/message.txt"), "first\n", "utf8");
  writeJson(path.join(root, "schema/domain.json"), { version: 1 });
  return root;
}

async function eventually(condition: () => boolean): Promise<void> {
  const deadline = Date.now() + 3_000;
  while (!condition()) {
    if (Date.now() >= deadline) {
      assert.fail("watch event did not arrive before the test deadline");
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 10));
  }
}

test("watch planning follows nested HXML, classpaths, resources, libraries, and extra inputs", () => {
  const root = fixture();
  try {
    const discovery = discoverNextProject(root);
    const initial = createHaxeWatchPlan(discovery);
    assert.deepEqual(
      initial.hxmlFiles.map((file) => path.relative(root, file)),
      ["build.hxml", "haxe_libraries/sample.hxml", "nested.hxml"],
    );
    assert.deepEqual(
      initial.classPaths.map((file) => path.relative(root, file)),
      ["haxe", "shared", "vendor/sample"],
    );
    assert.deepEqual(
      initial.resourceInputs.map((file) => path.relative(root, file)),
      ["assets/message.txt"],
    );

    writeFileSync(path.join(root, "haxe/Main.hx"), "class Main { static final changed = true; }\n", "utf8");
    const sourceEdit = createHaxeWatchPlan(discovery);
    assert.equal(sourceEdit.identity, initial.identity, "ordinary Haxe edits preserve server identity");

    writeJson(path.join(root, "schema/domain.json"), { version: 2 });
    const inputEdit = createHaxeWatchPlan(discovery);
    assert.notEqual(inputEdit.identity, initial.identity, "declared extra input changes server identity");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("the filesystem session classifies Haxe edits separately from identity edits", async () => {
  const root = fixture();
  try {
    const plan = createHaxeWatchPlan(discoverNextProject(root));
    const changes: WatchChange[] = [];
    const errors: Error[] = [];
    const session = watchHaxeInputs(plan, (change) => changes.push(change), (error) => errors.push(error));
    try {
      // `fs.watch` has no readiness event. Give the platform backend one turn
      // to activate before producing the event under test; otherwise a busy
      // aggregate suite can race registration on macOS FSEvents.
      await new Promise<void>((resolve) => setTimeout(resolve, 100));
      writeFileSync(path.join(root, "haxe/Main.hx"), "class Main { static final watched = true; }\n", "utf8");
      await eventually(() => changes.some((change) =>
        change.kind === "source" && change.path.endsWith(`${path.sep}haxe${path.sep}Main.hx`),
      ));
      writeFileSync(path.join(root, "nested.hxml"), "--class-path shared\n-D watched\n", "utf8");
      await eventually(() => changes.some((change) =>
        change.kind === "identity" && change.path.endsWith(`${path.sep}nested.hxml`),
      ));
      assert.deepEqual(errors, []);
    } finally {
      session.close();
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("polling reconciliation recovers source and identity edits without native events", async () => {
  const root = fixture();
  try {
    const plan = createHaxeWatchPlan(discoverNextProject(root));
    const changes: WatchChange[] = [];
    const errors: Error[] = [];
    const session = watchHaxeInputs(
      plan,
      (change) => changes.push(change),
      (error) => errors.push(error),
      { pollIntervalMs: 25, nativeEvents: false },
    );
    try {
      writeFileSync(path.join(root, "haxe/Main.hx"), "class Main { static final polled = true; }\n", "utf8");
      await eventually(() => changes.some((change) =>
        change.kind === "source" && change.path.endsWith(`${path.sep}haxe${path.sep}Main.hx`),
      ));

      writeFileSync(path.join(root, "nested.hxml"), "--class-path shared\n-D polled\n", "utf8");
      await eventually(() => changes.some((change) =>
        change.kind === "identity" && change.path.endsWith(`${path.sep}nested.hxml`),
      ));
      assert.deepEqual(errors, []);
    } finally {
      session.close();
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
