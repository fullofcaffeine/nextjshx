import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { Ajv2020 } from "ajv/dist/2020.js";

import {
  BOUNDARY_PLAN_SCHEMA_ID,
  parseBoundaryPlan,
} from "../src/boundary-plan.js";
import { CliDiagnosticError } from "../src/cli-diagnostic.js";

const SCHEMA_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../..",
  "schemas/boundary-plan.schema.json",
);

function validPlan(): object {
  return {
    $schema: BOUNDARY_PLAN_SCHEMA_ID,
    schemaVersion: 1,
    boundaries: [
      {
        kind: "client",
        moduleName: "fixture.client.Counter",
        ownerName: "fixture.client.Counter",
        signal: ":next.clientComponent",
        position: {
          file: "haxe/fixture/client/Counter.hx",
          startLine: 7,
          startCharacter: 1,
          endLine: 7,
          endCharacter: 23,
        },
        references: [
          {
            kind: "client-component",
            targetOwner: "fixture.client.Leaf",
            targetField: "render",
            targetPath: "_nextjshx/client/abc/Leaf.tsx",
            position: {
              file: "haxe/fixture/client/Counter.hx",
              startLine: 12,
              startCharacter: 5,
              endLine: 12,
              endCharacter: 17,
            },
          },
        ],
        dependencies: [
          {
            moduleName: "fixture.shared.Label",
            classification: "shared-pure",
            position: {
              file: "haxe/fixture/client/Counter.hx",
              startLine: 14,
              startCharacter: 5,
              endLine: 14,
              endCharacter: 17,
            },
          },
        ],
      },
    ],
  };
}

test("decodes one closed, path-sanitized Haxe boundary plan", () => {
  const decodedSchema: unknown = JSON.parse(readFileSync(SCHEMA_PATH, "utf8"));
  assert(
    typeof decodedSchema === "object" &&
      decodedSchema !== null &&
      !Array.isArray(decodedSchema),
    "boundary schema is a JSON object",
  );
  const validate = new Ajv2020({ allErrors: true, strict: true }).compile(decodedSchema);
  assert.equal(validate(validPlan()), true, JSON.stringify(validate.errors));
  const plan = parseBoundaryPlan(validPlan());
  assert.equal(plan.boundaries[0]?.ownerName, "fixture.client.Counter");
  assert.equal(plan.boundaries[0]?.dependencies[0]?.classification, "shared-pure");
  assert(Object.isFrozen(plan));
  assert(Object.isFrozen(plan.boundaries));
});

test("rejects host paths, unknown keys, and undeclared owners", () => {
  for (const mutate of [
    (plan: Record<string, unknown>) => {
      const boundaries = plan.boundaries as Array<Record<string, unknown>>;
      const position = boundaries[0]?.position as Record<string, unknown>;
      position.file = "/outside/Counter.hx";
    },
    (plan: Record<string, unknown>) => {
      plan.extra = true;
    },
    (plan: Record<string, unknown>) => {
      const boundaries = plan.boundaries as Array<Record<string, unknown>>;
      boundaries[0]!.kind = "unclassified";
    },
  ]) {
    const candidate = structuredClone(validPlan()) as Record<string, unknown>;
    mutate(candidate);
    assert.throws(
      () => parseBoundaryPlan(candidate),
      (error: unknown) =>
        error instanceof CliDiagnosticError &&
        error.diagnostic.code === "NXHX-CLI-BOUNDARY-0013",
    );
  }
});
