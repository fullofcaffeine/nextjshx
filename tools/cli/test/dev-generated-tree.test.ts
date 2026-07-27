import assert from "node:assert/strict";
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  adapterImplementationDigests,
  snapshotGeneratedTree,
} from "../src/dev-generated-tree.js";
import type { AdapterPlan, AdapterSourcePosition } from "../src/adapter-plan.js";

function implementationPlan(sourceFile: string): AdapterPlan {
  const position: AdapterSourcePosition = Object.freeze({
    file: sourceFile,
    startLine: 1,
    startCharacter: 1,
    endLine: 1,
    endCharacter: 2,
  });
  return Object.freeze({
    $schema: "https://nextjshx.dev/schemas/adapter-plan.schema.json",
    schemaVersion: 1,
    boundaries: Object.freeze({}),
    toolchain: Object.freeze({
      nextjshx: "0.0.0-development",
      haxe: "4.3.7",
      genesTs: "1.37.1+fixture",
      next: "16.2.12",
    }),
    intents: Object.freeze([Object.freeze({
      kind: "page",
      source: Object.freeze({
        typeName: "demo.Page",
        fieldName: "render",
        typePosition: position,
        fieldPosition: position,
        metadataPosition: position,
      }),
      segmentPath: "demo",
      targetPath: "demo/page.tsx",
      implementation: Object.freeze({
        modulePath: "../../src-gen/demo/Page",
        symbol: "Page",
      }),
      imports: Object.freeze([]),
      directives: Object.freeze([]),
      exports: Object.freeze([]),
      config: Object.freeze([]),
    })]),
  });
}

test("adapter fingerprints follow only the reachable generated module graph", () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "nextjshx-dev-generated-"));
  try {
    const generated = path.join(root, "src-gen");
    const page = path.join(generated, "demo/Page.tsx");
    const shared = path.join(generated, "demo/shared/index.tsx");
    const unrelated = path.join(generated, "other/Unrelated.tsx");
    mkdirSync(path.dirname(page), { recursive: true });
    mkdirSync(path.dirname(shared), { recursive: true });
    mkdirSync(path.dirname(unrelated), { recursive: true });
    writeFileSync(
      page,
      "import { shared } from './shared';\nexport const page = shared;\n",
      "utf8",
    );
    writeFileSync(shared, "export const shared = 'first';\n", "utf8");
    writeFileSync(unrelated, "export const unrelated = 'first';\n", "utf8");
    const plan = implementationPlan("haxe/demo/Page.hx");
    const initial = adapterImplementationDigests(root, generated, "app", plan)
      .get("app/demo/page.tsx");
    assert.match(initial ?? "", /^[0-9a-f]{64}$/);

    writeFileSync(unrelated, "export const unrelated = 'second';\n", "utf8");
    const unrelatedEdit = adapterImplementationDigests(root, generated, "app", plan)
      .get("app/demo/page.tsx");
    assert.equal(unrelatedEdit, initial, "unreachable modules do not rewrite this adapter");

    writeFileSync(shared, "export const shared = 'second';\n", "utf8");
    const dependencyEdit = adapterImplementationDigests(root, generated, "app", plan)
      .get("app/demo/page.tsx");
    assert.notEqual(dependencyEdit, initial, "reachable shared modules invalidate the adapter");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("generated implementation fingerprinting rejects symbolic links", () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "nextjshx-dev-generated-link-"));
  try {
    const generated = path.join(root, "src-gen");
    mkdirSync(generated);
    writeFileSync(path.join(root, "outside.tsx"), "export {};\n", "utf8");
    symlinkSync(path.join(root, "outside.tsx"), path.join(generated, "Linked.tsx"));
    assert.throws(
      () => snapshotGeneratedTree(generated),
      /generated tree contains a symbolic link/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
