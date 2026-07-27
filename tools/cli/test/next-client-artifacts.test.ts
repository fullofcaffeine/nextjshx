import assert from "node:assert/strict";
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { inspectNextClientArtifacts } from "../src/next-client-artifacts.js";

function fixtureRoot(): string {
  return mkdtempSync(path.join(os.tmpdir(), "nextjshx-client-artifacts-"));
}

function write(file: string, value: string): void {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, value, "utf8");
}

test("reads only completed compatible Next client-reference evidence", () => {
  const root = fixtureRoot();
  try {
    const unavailable = inspectNextClientArtifacts(root, "16.2.12");
    assert.equal(unavailable.status, "unavailable");
    assert.match(unavailable.reason, /Next production build/);

    write(path.join(root, ".next/BUILD_ID"), "fixture-build\n");
    write(
      path.join(root, ".next/diagnostics/framework.json"),
      '{"name":"Next.js","version":"16.2.12"}\n',
    );
    write(path.join(root, ".next/static/chunks/shared.js"), "shared");
    write(path.join(root, ".next/static/chunks/leaf.js"), "leaf-client");
    const target = "src/app/_nextjshx/client/abc/Leaf.tsx";
    const projectKey = `[project]/tmp/${path.basename(root)}/${target}`;
    const manifest = {
      moduleLoading: { prefix: "", crossOrigin: null },
      clientModules: {
        [projectKey]: {
          id: 1,
          name: "*",
          chunks: [
            "/_next/static/chunks/shared.js",
            "/_next/static/chunks/leaf.js",
          ],
          async: false,
        },
        [`${projectKey} <module evaluation>`]: {
          id: 1,
          name: "*",
          chunks: ["/_next/static/chunks/shared.js"],
          async: false,
        },
      },
    };
    write(
      path.join(root, ".next/server/app/leaf/page_client-reference-manifest.js"),
      "globalThis.__RSC_MANIFEST = globalThis.__RSC_MANIFEST || {};\n" +
        `globalThis.__RSC_MANIFEST["/leaf/page"] = ${JSON.stringify(manifest)};\n`,
    );

    const evidence = inspectNextClientArtifacts(root, "16.2.12");
    assert.equal(evidence.status, "available");
    const artifact = evidence.artifacts.get(target);
    assert(artifact !== undefined);
    assert.deepEqual(artifact.chunks, [
      ".next/static/chunks/leaf.js",
      ".next/static/chunks/shared.js",
    ]);
    assert.equal(artifact.bytes, Buffer.byteLength("leaf-clientshared"));
    assert.deepEqual(artifact.manifests, [
      ".next/server/app/leaf/page_client-reference-manifest.js",
    ]);

    const newerSource = path.join(root, "haxe/Leaf.hx");
    write(newerSource, "class Leaf {}\n");
    const future = new Date(Date.now() + 5_000);
    utimesSync(newerSource, future, future);
    const stale = inspectNextClientArtifacts(root, "16.2.12", {
      freshnessInputs: [newerSource],
    });
    assert.equal(stale.status, "unavailable");
    assert.match(stale.reason, /changed after the completed Next build/);

    const incompatible = inspectNextClientArtifacts(root, "16.3.0");
    assert.equal(incompatible.status, "unavailable");
    assert.match(incompatible.reason, /configured Next 16\.3\.0/);

    if (process.platform !== "win32") {
      const chunkFile = path.join(root, ".next/static/chunks/leaf.js");
      const outside = path.join(root, "outside.js");
      write(outside, "outside");
      rmSync(chunkFile);
      symlinkSync(outside, chunkFile);
      assert.equal(
        inspectNextClientArtifacts(root, "16.2.12").artifacts.has(target),
        false,
        "a symlinked chunk is not trusted as build evidence",
      );
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("never executes client-reference manifest JavaScript", () => {
  const root = fixtureRoot();
  try {
    write(path.join(root, ".next/BUILD_ID"), "fixture-build\n");
    write(
      path.join(root, ".next/diagnostics/framework.json"),
      '{"name":"Next.js","version":"16.2.12"}\n',
    );
    write(
      path.join(root, ".next/server/app/page_client-reference-manifest.js"),
      "globalThis.__NEXTJSHX_TEST_EXECUTED = true;\n",
    );
    const evidence = inspectNextClientArtifacts(root, "16.2.12");
    assert.equal(evidence.status, "available");
    assert.equal(evidence.artifacts.size, 0);
    assert.equal(
      Object.hasOwn(globalThis, "__NEXTJSHX_TEST_EXECUTED"),
      false,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
