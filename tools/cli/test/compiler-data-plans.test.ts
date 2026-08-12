import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import type { CompilerDataFile } from "@genes-ts/tooling/session";

import {
  ADAPTER_PLAN_COMPILER_DATA_ID,
  BOUNDARY_PLAN_COMPILER_DATA_ID,
  CliDiagnosticError,
  parseCompilerDataPlans,
} from "../src/index.js";

function compilerValue(id: string, value: string | Uint8Array): CompilerDataFile {
  const bytes = typeof value === "string" ? Buffer.from(value, "utf8") : value;
  return Object.freeze({
    id,
    digest: createHash("sha256").update(bytes).digest("hex"),
    sizeBytes: bytes.byteLength,
    readBytes: () => Uint8Array.from(bytes),
  });
}

function adapterPlan(): string {
  return `${JSON.stringify({
    $schema: "https://nextjshx.dev/schemas/adapter-plan.schema.json",
    schemaVersion: 2,
    toolchain: {
      nextjshx: "0.0.0-development",
      haxe: "4.3.7",
      genesTs: "1.50.0+source",
      next: "16.2.12",
    },
    intents: [],
  }, null, 2)}\n`;
}

function boundaryPlan(): string {
  return `${JSON.stringify({
    $schema: "https://nextjshx.dev/schemas/boundary-plan-v1.json",
    schemaVersion: 1,
    boundaries: [],
  }, null, 2)}\n`;
}

test("private compiler values become typed NextJsHx plans", () => {
  const plans = parseCompilerDataPlans([
    compilerValue(BOUNDARY_PLAN_COMPILER_DATA_ID, boundaryPlan()),
    compilerValue(ADAPTER_PLAN_COMPILER_DATA_ID, adapterPlan()),
  ]);
  assert.equal(plans.adapter.schemaVersion, 2);
  assert.deepEqual(plans.adapter.intents, []);
  assert.equal(plans.boundary.schemaVersion, 1);
  assert.deepEqual(plans.boundary.boundaries, []);
});

test("a missing private plan fails before generated files are replaced", () => {
  assert.throws(
    () =>
      parseCompilerDataPlans([
        compilerValue(ADAPTER_PLAN_COMPILER_DATA_ID, adapterPlan()),
      ]),
    (error) => {
      assert(error instanceof CliDiagnosticError);
      assert.equal(error.diagnostic.code, "NXHX-CLI-BOUNDARY-0013");
      assert.equal(error.diagnostic.actual, "missing");
      return true;
    },
  );
});

test("two values with the same plan name are rejected", () => {
  assert.throws(
    () =>
      parseCompilerDataPlans([
        compilerValue(ADAPTER_PLAN_COMPILER_DATA_ID, adapterPlan()),
        compilerValue(ADAPTER_PLAN_COMPILER_DATA_ID, adapterPlan()),
        compilerValue(BOUNDARY_PLAN_COMPILER_DATA_ID, boundaryPlan()),
      ]),
    (error) => {
      assert(error instanceof CliDiagnosticError);
      assert.equal(error.diagnostic.code, "NXHX-CLI-PLAN-0004");
      assert.equal(error.diagnostic.actual, "2 values");
      return true;
    },
  );
});

test("invalid UTF-8 fails with the owning plan diagnostic", () => {
  assert.throws(
    () =>
      parseCompilerDataPlans([
        compilerValue(ADAPTER_PLAN_COMPILER_DATA_ID, new Uint8Array([0xff])),
        compilerValue(BOUNDARY_PLAN_COMPILER_DATA_ID, boundaryPlan()),
      ]),
    (error) => {
      assert(error instanceof CliDiagnosticError);
      assert.equal(error.diagnostic.code, "NXHX-CLI-PLAN-0004");
      assert.match(error.diagnostic.message, /unreadable adapter plan/u);
      return true;
    },
  );
});
