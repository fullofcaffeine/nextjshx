import { readFileSync } from "node:fs";

import { cliFailure } from "./cli-diagnostic.js";
import type { AdapterSourcePosition } from "./adapter-plan.js";
import { validatePortableProjectPath } from "./ownership-path.js";

export const BOUNDARY_PLAN_SCHEMA_ID =
  "https://nextjshx.dev/schemas/boundary-plan-v1.json";
export const BOUNDARY_PLAN_SCHEMA_VERSION = 1 as const;

export type BoundaryClassification =
  | "server-default"
  | "client"
  | "Server Function"
  | "shared cache"
  | "private cache"
  | "remote cache"
  | "shared-pure"
  | "server-only"
  | "client-only"
  | "unclassified";

export interface BoundaryDependencyEvidence {
  readonly moduleName: string;
  readonly classification: BoundaryClassification;
  readonly position: AdapterSourcePosition;
}

export interface BoundaryEvidence {
  readonly kind: Exclude<BoundaryClassification, "unclassified">;
  readonly moduleName: string;
  readonly ownerName: string;
  readonly signal: string;
  readonly position: AdapterSourcePosition;
  readonly references: readonly BoundaryReferenceEvidence[];
  readonly dependencies: readonly BoundaryDependencyEvidence[];
}

export interface BoundaryReferenceEvidence {
  readonly kind: "client-component" | "server-function";
  readonly targetOwner: string;
  readonly targetField: string;
  readonly targetPath: string;
  readonly position: AdapterSourcePosition;
}

export interface BoundaryPlan {
  readonly $schema: typeof BOUNDARY_PLAN_SCHEMA_ID;
  readonly schemaVersion: typeof BOUNDARY_PLAN_SCHEMA_VERSION;
  readonly boundaries: readonly BoundaryEvidence[];
}

type JsonObject = Record<string, unknown>;

const ROOT_KEYS = ["$schema", "boundaries", "schemaVersion"];
const BOUNDARY_KEYS = [
  "dependencies",
  "kind",
  "moduleName",
  "ownerName",
  "position",
  "references",
  "signal",
];
const DEPENDENCY_KEYS = ["classification", "moduleName", "position"];
const REFERENCE_KEYS = ["kind", "position", "targetField", "targetOwner", "targetPath"];
const POSITION_KEYS = [
  "endCharacter",
  "endLine",
  "file",
  "startCharacter",
  "startLine",
];
const CLASSIFICATIONS = new Set<BoundaryClassification>([
  "server-default",
  "client",
  "Server Function",
  "shared cache",
  "private cache",
  "remote cache",
  "shared-pure",
  "server-only",
  "client-only",
  "unclassified",
]);
const HAXE_MODULE = /^[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*$/;
const SIGNAL = /^:next\.[A-Za-z][A-Za-z0-9]*$/;
const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

function planFailure(subject: string, expected: string, actual: string): never {
  cliFailure(
    "NXHX-CLI-BOUNDARY-0013",
    "The Haxe boundary evidence plan is malformed, non-canonical, or unsupported.",
    subject,
    expected,
    actual,
    "Regenerate boundary evidence with the pinned NextJsHx Haxe macros; never edit plan JSON by hand.",
  );
}

// JSON is the one intentionally broad input. Every value is checked below and
// converted immediately into this closed immutable report model.
function objectValue(value: unknown, subject: string): JsonObject {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    planFailure(subject, "a closed JSON object", typeof value);
  }
  return value as JsonObject;
}

function exactKeys(value: JsonObject, expected: readonly string[], subject: string): void {
  const actual = Object.keys(value).sort();
  const canonical = [...expected].sort();
  if (actual.join("\0") !== canonical.join("\0")) {
    planFailure(subject, `exact keys ${canonical.join(", ")}`, actual.join(", "));
  }
}

function stringValue(value: unknown, subject: string, pattern: RegExp): string {
  if (typeof value !== "string" || !pattern.test(value)) {
    planFailure(subject, pattern.source, JSON.stringify(value));
  }
  return value;
}

function positiveInteger(value: unknown, subject: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 1) {
    planFailure(subject, "a positive safe integer", JSON.stringify(value));
  }
  return value as number;
}

function positionValue(value: unknown, subject: string): AdapterSourcePosition {
  const position = objectValue(value, subject);
  exactKeys(position, POSITION_KEYS, subject);
  const startLine = positiveInteger(position.startLine, `${subject}.startLine`);
  const startCharacter = positiveInteger(
    position.startCharacter,
    `${subject}.startCharacter`,
  );
  const endLine = positiveInteger(position.endLine, `${subject}.endLine`);
  const endCharacter = positiveInteger(position.endCharacter, `${subject}.endCharacter`);
  if (endLine < startLine || (endLine === startLine && endCharacter <= startCharacter)) {
    planFailure(subject, "a non-empty ordered source range", JSON.stringify(position));
  }
  let file: string;
  if (typeof position.file !== "string") {
    planFailure(`${subject}.file`, "a portable project-relative path", typeof position.file);
  }
  try {
    file = validatePortableProjectPath(position.file, `${subject}.file`, false);
  } catch {
    planFailure(`${subject}.file`, "a portable project-relative path", JSON.stringify(position.file));
  }
  return Object.freeze({ file, startLine, startCharacter, endLine, endCharacter });
}

function classificationValue(
  value: unknown,
  subject: string,
): BoundaryClassification {
  if (typeof value !== "string" || !CLASSIFICATIONS.has(value as BoundaryClassification)) {
    planFailure(subject, "a supported boundary classification", JSON.stringify(value));
  }
  return value as BoundaryClassification;
}

function dependencyValue(value: unknown, subject: string): BoundaryDependencyEvidence {
  const dependency = objectValue(value, subject);
  exactKeys(dependency, DEPENDENCY_KEYS, subject);
  return Object.freeze({
    moduleName: stringValue(dependency.moduleName, `${subject}.moduleName`, HAXE_MODULE),
    classification: classificationValue(
      dependency.classification,
      `${subject}.classification`,
    ),
    position: positionValue(dependency.position, `${subject}.position`),
  });
}

function referenceValue(value: unknown, subject: string): BoundaryReferenceEvidence {
  const reference = objectValue(value, subject);
  exactKeys(reference, REFERENCE_KEYS, subject);
  if (reference.kind !== "client-component" && reference.kind !== "server-function") {
    planFailure(`${subject}.kind`, "client-component or server-function", JSON.stringify(reference.kind));
  }
  let targetPath: string;
  if (typeof reference.targetPath !== "string") {
    planFailure(`${subject}.targetPath`, "a portable project-relative path", typeof reference.targetPath);
  }
  try {
    targetPath = validatePortableProjectPath(
      reference.targetPath,
      `${subject}.targetPath`,
      true,
    );
  } catch {
    planFailure(
      `${subject}.targetPath`,
      "a portable project-relative TypeScript path",
      JSON.stringify(reference.targetPath),
    );
  }
  return Object.freeze({
    kind: reference.kind,
    targetOwner: stringValue(reference.targetOwner, `${subject}.targetOwner`, HAXE_MODULE),
    targetField: stringValue(reference.targetField, `${subject}.targetField`, IDENTIFIER),
    targetPath,
    position: positionValue(reference.position, `${subject}.position`),
  });
}

function boundaryValue(value: unknown, subject: string): BoundaryEvidence {
  const boundary = objectValue(value, subject);
  exactKeys(boundary, BOUNDARY_KEYS, subject);
  const kind = classificationValue(boundary.kind, `${subject}.kind`);
  if (kind === "unclassified") {
    planFailure(`${subject}.kind`, "a declared boundary classification", kind);
  }
  if (!Array.isArray(boundary.dependencies)) {
    planFailure(`${subject}.dependencies`, "an array", typeof boundary.dependencies);
  }
  if (!Array.isArray(boundary.references)) {
    planFailure(`${subject}.references`, "an array", typeof boundary.references);
  }
  return Object.freeze({
    kind,
    moduleName: stringValue(boundary.moduleName, `${subject}.moduleName`, HAXE_MODULE),
    ownerName: stringValue(boundary.ownerName, `${subject}.ownerName`, HAXE_MODULE),
    signal: stringValue(boundary.signal, `${subject}.signal`, SIGNAL),
    position: positionValue(boundary.position, `${subject}.position`),
    references: Object.freeze(
      boundary.references.map((entry, index) =>
        referenceValue(entry, `${subject}.references[${index}]`),
      ),
    ),
    dependencies: Object.freeze(
      boundary.dependencies.map((entry, index) =>
        dependencyValue(entry, `${subject}.dependencies[${index}]`),
      ),
    ),
  });
}

export function parseBoundaryPlan(decoded: unknown): BoundaryPlan {
  const plan = objectValue(decoded, "$");
  exactKeys(plan, ROOT_KEYS, "$");
  if (plan.$schema !== BOUNDARY_PLAN_SCHEMA_ID) {
    planFailure("$.$schema", BOUNDARY_PLAN_SCHEMA_ID, JSON.stringify(plan.$schema));
  }
  if (plan.schemaVersion !== BOUNDARY_PLAN_SCHEMA_VERSION) {
    planFailure(
      "$.schemaVersion",
      String(BOUNDARY_PLAN_SCHEMA_VERSION),
      JSON.stringify(plan.schemaVersion),
    );
  }
  if (!Array.isArray(plan.boundaries)) {
    planFailure("$.boundaries", "an array", typeof plan.boundaries);
  }
  return Object.freeze({
    $schema: BOUNDARY_PLAN_SCHEMA_ID,
    schemaVersion: BOUNDARY_PLAN_SCHEMA_VERSION,
    boundaries: Object.freeze(
      plan.boundaries.map((entry, index) => boundaryValue(entry, `$.boundaries[${index}]`)),
    ),
  });
}

export function readBoundaryPlan(file: string): BoundaryPlan {
  let decoded: unknown;
  try {
    decoded = JSON.parse(readFileSync(file, "utf8"));
  } catch {
    planFailure(file, "readable strict JSON", "missing or malformed");
  }
  return parseBoundaryPlan(decoded);
}
