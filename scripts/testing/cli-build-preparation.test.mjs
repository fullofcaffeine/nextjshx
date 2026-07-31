import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const OUTPUT = path.join(ROOT, "tools/cli/.tmp");
const MARKER = path.join(OUTPUT, ".nextjshx-cli-build.json");
const RUNTIME_PROBE = path.join(ROOT, "tools/cli/src/__build_preparation_probe__.ts");
const TEST_PROBE = path.join(ROOT, "tools/cli/test/__build_preparation_probe__.ts");

function ensure(mode) {
  const result = spawnSync(
    process.execPath,
    ["tools/cli/scripts/ensure-build.mjs", mode],
    {
      cwd: ROOT,
      encoding: "utf8",
      env: { ...process.env, CI: "1", NO_COLOR: "1" },
    },
  );
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  assert.equal(result.status, 0, output);
  return output;
}

function marker() {
  return JSON.parse(fs.readFileSync(MARKER, "utf8"));
}

test("CLI runtime and test preparation reject missing or stale output", () => {
  fs.rmSync(OUTPUT, { recursive: true, force: true });
  fs.rmSync(RUNTIME_PROBE, { force: true });
  fs.rmSync(TEST_PROBE, { force: true });
  try {
    assert.match(ensure("runtime"), /runtime: rebuilt exact input identity/);
    const firstRuntime = marker().runtimeFingerprint;
    assert.match(ensure("runtime"), /runtime: verified prepared output/);

    fs.rmSync(path.join(OUTPUT, "src/cli.js"), { force: true });
    assert.match(
      ensure("runtime"),
      /runtime: rebuilt exact input identity/,
      "missing required output must invalidate an otherwise matching marker",
    );

    fs.appendFileSync(path.join(OUTPUT, "src/cli.js"), "\n// modified prepared output\n");
    assert.match(
      ensure("runtime"),
      /runtime: rebuilt exact input identity/,
      "modified prepared output must invalidate a matching source fingerprint",
    );

    fs.writeFileSync(
      RUNTIME_PROBE,
      "export const buildPreparationProbe = \"runtime-source-changed\";\n",
    );
    assert.match(ensure("runtime"), /runtime: rebuilt exact input identity/);
    assert.notEqual(marker().runtimeFingerprint, firstRuntime);
    fs.rmSync(RUNTIME_PROBE, { force: true });
    assert.match(ensure("runtime"), /runtime: rebuilt exact input identity/);
    assert.equal(marker().runtimeFingerprint, firstRuntime);

    fs.writeFileSync(
      TEST_PROBE,
      "export const buildPreparationTestProbe = \"test-source-changed\";\n",
    );
    assert.match(
      ensure("runtime"),
      /runtime: verified prepared output/,
      "test-only source must not invalidate runtime-only preparation",
    );
    assert.match(ensure("test"), /test: rebuilt exact input identity/);
    const testFingerprint = marker().testFingerprint;
    assert.match(ensure("test"), /test: verified prepared output/);
    fs.rmSync(TEST_PROBE, { force: true });
    assert.match(ensure("test"), /test: rebuilt exact input identity/);
    assert.notEqual(marker().testFingerprint, testFingerprint);
  } finally {
    fs.rmSync(RUNTIME_PROBE, { force: true });
    fs.rmSync(TEST_PROBE, { force: true });
    ensure("test");
  }
});
