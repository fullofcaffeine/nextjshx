import {
  closeSync,
  constants,
  fstatSync,
  openSync,
  readFileSync,
} from "node:fs";

import { cliFailure } from "./cli-diagnostic.js";
import { validatePortableProjectPath } from "./ownership-path.js";

export const ADAPTER_PLAN_SCHEMA_ID =
  "https://nextjshx.dev/schemas/adapter-plan.schema.json";
export const ADAPTER_PLAN_SCHEMA_VERSION = 1 as const;

export type AdapterKind =
  | "page"
  | "layout"
  | "loading"
  | "error"
  | "not-found"
  | "default"
  | "route-handler"
  | "client-component"
  | "react-hook"
  | "server-function"
  | "cache-function"
  | "proxy"
  | "mdx-components";

export interface AdapterToolchain {
  readonly nextjshx: string;
  readonly haxe: string;
  readonly genesTs: string;
  readonly next: string;
}

export interface AdapterSourcePosition {
  readonly file: string;
  readonly startLine: number;
  readonly startCharacter: number;
  readonly endLine: number;
  readonly endCharacter: number;
}

export interface AdapterSource {
  readonly typeName: string;
  readonly fieldName: string;
  readonly typePosition: AdapterSourcePosition;
  readonly fieldPosition: AdapterSourcePosition;
  readonly metadataPosition: AdapterSourcePosition;
}

export interface AdapterImplementation {
  readonly modulePath: string;
  readonly symbol: string;
}

export interface AdapterImport {
  readonly modulePath: string;
  readonly symbol: string;
  readonly alias: string | null;
  readonly typeOnly: boolean;
}

export interface AdapterExport {
  readonly kind: "default" | "named";
  readonly name: string;
  readonly sourceField: string;
  readonly signature: string;
}

export type AdapterConfigValue =
  | { readonly kind: "string"; readonly value: string }
  | { readonly kind: "integer"; readonly value: number }
  | { readonly kind: "boolean"; readonly value: boolean }
  | { readonly kind: "string-array"; readonly value: readonly string[] };

export interface AdapterConfigEntry {
  readonly name: string;
  readonly value: AdapterConfigValue;
}

export interface AdapterIntent {
  readonly kind: AdapterKind;
  readonly source: AdapterSource;
  readonly segmentPath: string;
  readonly targetPath: string;
  readonly implementation: AdapterImplementation;
  readonly imports: readonly AdapterImport[];
  readonly directives: readonly string[];
  readonly exports: readonly AdapterExport[];
  readonly config: readonly AdapterConfigEntry[];
}

export interface AdapterPlan {
  readonly $schema: typeof ADAPTER_PLAN_SCHEMA_ID;
  readonly schemaVersion: typeof ADAPTER_PLAN_SCHEMA_VERSION;
  readonly toolchain: AdapterToolchain;
  readonly intents: readonly AdapterIntent[];
}

type JsonObject = Record<string, unknown>;

const ROOT_KEYS = ["$schema", "intents", "schemaVersion", "toolchain"];
const TOOLCHAIN_KEYS = ["genesTs", "haxe", "next", "nextjshx"];
const INTENT_KEYS = [
  "config",
  "directives",
  "exports",
  "implementation",
  "imports",
  "kind",
  "segmentPath",
  "source",
  "targetPath",
];
const SOURCE_KEYS = [
  "fieldName",
  "fieldPosition",
  "metadataPosition",
  "typeName",
  "typePosition",
];
const POSITION_KEYS = [
  "endCharacter",
  "endLine",
  "file",
  "startCharacter",
  "startLine",
];
const IMPLEMENTATION_KEYS = ["modulePath", "symbol"];
const IMPORT_KEYS = ["alias", "modulePath", "symbol", "typeOnly"];
const EXPORT_KEYS = ["kind", "name", "signature", "sourceField"];
const CONFIG_KEYS = ["name", "value"];
const CONFIG_VALUE_KEYS = ["kind", "value"];
const KINDS = new Set<AdapterKind>([
  "page",
  "layout",
  "loading",
  "error",
  "not-found",
  "default",
  "route-handler",
  "client-component",
  "react-hook",
  "server-function",
  "cache-function",
  "proxy",
  "mdx-components",
]);
const IDENTIFIER = /^[$A-Z_a-z][$\w]*$/;
const QUALIFIED_HAXE_TYPE =
  /^[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*$/;
const COMPACT_TEXT = /^[^\u0000-\u001f\u007f]{1,512}$/;

function planFailure(subject: string, expected: string, actual: string): never {
  cliFailure(
    "NXHX-CLI-PLAN-0004",
    "The adapter plan is malformed, non-canonical, or unsupported.",
    subject,
    expected,
    actual,
    "Regenerate the plan with the pinned NextJsHx Haxe macros; never edit plan JSON by hand.",
  );
}

function objectValue(value: unknown, subject: string): JsonObject {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    planFailure(subject, "a closed JSON object", typeof value);
  }
  return value as JsonObject;
}

function exactKeys(value: JsonObject, keys: readonly string[], subject: string): void {
  const expected = [...keys].sort();
  const actual = Object.keys(value).sort();
  if (expected.join("\0") !== actual.join("\0")) {
    planFailure(subject, `exact keys ${expected.join(", ")}`, actual.join(", "));
  }
}

function stringValue(value: unknown, subject: string, max = 4096): string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > max ||
    value.trim() !== value ||
    /[\u0000-\u001f\u007f]/.test(value)
  ) {
    planFailure(subject, `a compact non-empty string of at most ${max} characters`, JSON.stringify(value));
  }
  return value;
}

function identifier(value: unknown, subject: string): string {
  const parsed = stringValue(value, subject, 256);
  if (!IDENTIFIER.test(parsed)) {
    planFailure(subject, "a TypeScript identifier", parsed);
  }
  return parsed;
}

function positiveInteger(value: unknown, subject: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 1) {
    planFailure(subject, "a positive safe integer", JSON.stringify(value));
  }
  return value as number;
}

function portablePath(
  value: unknown,
  subject: string,
  requireTypeScript: boolean,
): string {
  const parsed = stringValue(value, subject);
  try {
    return validatePortableProjectPath(parsed, subject, requireTypeScript);
  } catch {
    planFailure(
      subject,
      requireTypeScript
        ? "a normalized portable relative TypeScript path"
        : "a normalized portable relative path",
      parsed,
    );
  }
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
  return Object.freeze({
    file: portablePath(position.file, `${subject}.file`, false),
    startLine,
    startCharacter,
    endLine,
    endCharacter,
  });
}

function sourceValue(value: unknown, subject: string): AdapterSource {
  const source = objectValue(value, subject);
  exactKeys(source, SOURCE_KEYS, subject);
  const typeName = stringValue(source.typeName, `${subject}.typeName`, 512);
  if (!QUALIFIED_HAXE_TYPE.test(typeName)) {
    planFailure(`${subject}.typeName`, "a qualified Haxe type name", typeName);
  }
  return Object.freeze({
    typeName,
    fieldName: identifier(source.fieldName, `${subject}.fieldName`),
    typePosition: positionValue(source.typePosition, `${subject}.typePosition`),
    fieldPosition: positionValue(source.fieldPosition, `${subject}.fieldPosition`),
    metadataPosition: positionValue(
      source.metadataPosition,
      `${subject}.metadataPosition`,
    ),
  });
}

function modulePath(value: unknown, subject: string): string {
  const parsed = stringValue(value, subject, 2048);
  const segments = parsed.split("/");
  let sawNamedSegment = false;
  let invalidSegment = false;
  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index] as string;
    if (segment === "") {
      invalidSegment = true;
    } else if (segment === ".") {
      invalidSegment ||= index !== 0 || segments.length === 1;
    } else if (segment === "..") {
      invalidSegment ||= segments[0] === "." || sawNamedSegment;
    } else {
      sawNamedSegment = true;
    }
  }
  if (
    parsed.startsWith("/") ||
    /^[A-Za-z]:/.test(parsed) ||
    parsed.includes("\\") ||
    invalidSegment
  ) {
    planFailure(subject, "a normalized relative or package module specifier", parsed);
  }
  return parsed;
}

function implementationValue(value: unknown, subject: string): AdapterImplementation {
  const implementation = objectValue(value, subject);
  exactKeys(implementation, IMPLEMENTATION_KEYS, subject);
  return Object.freeze({
    modulePath: modulePath(implementation.modulePath, `${subject}.modulePath`),
    symbol: identifier(implementation.symbol, `${subject}.symbol`),
  });
}

function importValue(value: unknown, subject: string): AdapterImport {
  const imported = objectValue(value, subject);
  exactKeys(imported, IMPORT_KEYS, subject);
  if (typeof imported.typeOnly !== "boolean") {
    planFailure(`${subject}.typeOnly`, "a boolean", JSON.stringify(imported.typeOnly));
  }
  return Object.freeze({
    modulePath: modulePath(imported.modulePath, `${subject}.modulePath`),
    symbol: identifier(imported.symbol, `${subject}.symbol`),
    alias:
      imported.alias === null
        ? null
        : identifier(imported.alias, `${subject}.alias`),
    typeOnly: imported.typeOnly,
  });
}

function exportValue(value: unknown, subject: string): AdapterExport {
  const exported = objectValue(value, subject);
  exactKeys(exported, EXPORT_KEYS, subject);
  if (exported.kind !== "default" && exported.kind !== "named") {
    planFailure(`${subject}.kind`, "default or named", JSON.stringify(exported.kind));
  }
  const name = exported.name === "default" ? "default" : identifier(exported.name, `${subject}.name`);
  if ((exported.kind === "default") !== (name === "default")) {
    planFailure(subject, "default kind only for the default export", `${exported.kind}/${name}`);
  }
  return Object.freeze({
    kind: exported.kind,
    name,
    sourceField: identifier(exported.sourceField, `${subject}.sourceField`),
    signature: stringValue(exported.signature, `${subject}.signature`, 4096),
  });
}

function configValue(value: unknown, subject: string): AdapterConfigValue {
  const config = objectValue(value, subject);
  exactKeys(config, CONFIG_VALUE_KEYS, subject);
  switch (config.kind) {
    case "string":
      return Object.freeze({
        kind: "string",
        value: stringValue(config.value, `${subject}.value`, 2048),
      });
    case "integer":
      if (!Number.isSafeInteger(config.value)) {
        planFailure(`${subject}.value`, "a safe integer", JSON.stringify(config.value));
      }
      return Object.freeze({ kind: "integer", value: config.value as number });
    case "boolean":
      if (typeof config.value !== "boolean") {
        planFailure(`${subject}.value`, "a boolean", JSON.stringify(config.value));
      }
      return Object.freeze({ kind: "boolean", value: config.value });
    case "string-array":
      if (!Array.isArray(config.value)) {
        planFailure(`${subject}.value`, "an array of compact strings", typeof config.value);
      }
      return Object.freeze({
        kind: "string-array",
        value: Object.freeze(
          config.value.map((entry, index) =>
            stringValue(entry, `${subject}.value[${index}]`, 2048),
          ),
        ),
      });
    default:
      planFailure(`${subject}.kind`, "string, integer, boolean, or string-array", JSON.stringify(config.kind));
  }
}

function configEntryValue(value: unknown, subject: string): AdapterConfigEntry {
  const config = objectValue(value, subject);
  exactKeys(config, CONFIG_KEYS, subject);
  return Object.freeze({
    name: identifier(config.name, `${subject}.name`),
    value: configValue(config.value, `${subject}.value`),
  });
}

function canonicalUnique<T>(
  values: readonly T[],
  identity: (value: T) => string,
  subject: string,
): void {
  let previous: string | null = null;
  for (const value of values) {
    const current = identity(value);
    if (previous !== null && Buffer.from(previous).compare(Buffer.from(current)) >= 0) {
      planFailure(subject, "strict canonical bytewise order with no duplicates", current);
    }
    previous = current;
  }
}

function intentValue(value: unknown, index: number): AdapterIntent {
  const subject = `$.intents[${index}]`;
  const intent = objectValue(value, subject);
  exactKeys(intent, INTENT_KEYS, subject);
  if (!KINDS.has(intent.kind as AdapterKind)) {
    planFailure(`${subject}.kind`, [...KINDS].join(", "), JSON.stringify(intent.kind));
  }
  const imports = Array.isArray(intent.imports)
    ? intent.imports.map((entry, importIndex) =>
        importValue(entry, `${subject}.imports[${importIndex}]`),
      )
    : planFailure(`${subject}.imports`, "an array", typeof intent.imports);
  canonicalUnique(
    imports,
    (entry) =>
      `${entry.modulePath}\0${entry.symbol}\0${entry.alias ?? ""}\0${entry.typeOnly}`,
    `${subject}.imports`,
  );
  if (!Array.isArray(intent.directives)) {
    planFailure(`${subject}.directives`, "an array", typeof intent.directives);
  }
  const directives = intent.directives.map((entry, directiveIndex) =>
    stringValue(entry, `${subject}.directives[${directiveIndex}]`, 256),
  );
  if (new Set(directives).size !== directives.length) {
    planFailure(`${subject}.directives`, "unique ordered directive strings", "duplicate directive");
  }
  const exports = Array.isArray(intent.exports)
    ? intent.exports.map((entry, exportIndex) =>
        exportValue(entry, `${subject}.exports[${exportIndex}]`),
      )
    : planFailure(`${subject}.exports`, "an array", typeof intent.exports);
  canonicalUnique(
    exports,
    (entry) => `${entry.kind === "default" ? "0" : "1"}\0${entry.name}`,
    `${subject}.exports`,
  );
  const config = Array.isArray(intent.config)
    ? intent.config.map((entry, configIndex) =>
        configEntryValue(entry, `${subject}.config[${configIndex}]`),
      )
    : planFailure(`${subject}.config`, "an array", typeof intent.config);
  canonicalUnique(config, (entry) => entry.name, `${subject}.config`);
  const segmentPath =
    intent.segmentPath === ""
      ? ""
      : portablePath(intent.segmentPath, `${subject}.segmentPath`, false);
  return Object.freeze({
    kind: intent.kind as AdapterKind,
    source: sourceValue(intent.source, `${subject}.source`),
    segmentPath,
    targetPath: portablePath(intent.targetPath, `${subject}.targetPath`, true),
    implementation: implementationValue(
      intent.implementation,
      `${subject}.implementation`,
    ),
    imports: Object.freeze(imports),
    directives: Object.freeze(directives),
    exports: Object.freeze(exports),
    config: Object.freeze(config),
  });
}

export function parseAdapterPlan(decoded: unknown): AdapterPlan {
  const plan = objectValue(decoded, "$");
  exactKeys(plan, ROOT_KEYS, "$");
  if (plan.$schema !== ADAPTER_PLAN_SCHEMA_ID) {
    planFailure("$.$schema", ADAPTER_PLAN_SCHEMA_ID, JSON.stringify(plan.$schema));
  }
  if (plan.schemaVersion !== ADAPTER_PLAN_SCHEMA_VERSION) {
    planFailure("$.schemaVersion", String(ADAPTER_PLAN_SCHEMA_VERSION), JSON.stringify(plan.schemaVersion));
  }
  const toolchain = objectValue(plan.toolchain, "$.toolchain");
  exactKeys(toolchain, TOOLCHAIN_KEYS, "$.toolchain");
  const parsedToolchain: AdapterToolchain = Object.freeze({
    nextjshx: stringValue(toolchain.nextjshx, "$.toolchain.nextjshx", 256),
    haxe: stringValue(toolchain.haxe, "$.toolchain.haxe", 256),
    genesTs: stringValue(toolchain.genesTs, "$.toolchain.genesTs", 256),
    next: stringValue(toolchain.next, "$.toolchain.next", 256),
  });
  if (!Object.values(parsedToolchain).every((value) => COMPACT_TEXT.test(value))) {
    planFailure("$.toolchain", "compact toolchain identities", JSON.stringify(toolchain));
  }
  if (!Array.isArray(plan.intents)) {
    planFailure("$.intents", "an array", typeof plan.intents);
  }
  const intents = plan.intents.map(intentValue);
  canonicalUnique(
    intents,
    (intent) => `${intent.targetPath}\0${intent.kind}\0${intent.source.typeName}.${intent.source.fieldName}`,
    "$.intents",
  );
  const targetIdentities = new Set<string>();
  for (const intent of intents) {
    const folded = intent.targetPath.toLowerCase();
    if (targetIdentities.has(folded)) {
      planFailure("$.intents", "one portable filesystem target per intent", intent.targetPath);
    }
    targetIdentities.add(folded);
  }
  return Object.freeze({
    $schema: ADAPTER_PLAN_SCHEMA_ID,
    schemaVersion: ADAPTER_PLAN_SCHEMA_VERSION,
    toolchain: parsedToolchain,
    intents: Object.freeze(intents),
  });
}

export function readAdapterPlan(file: string): AdapterPlan {
  let descriptor: number;
  try {
    descriptor = openSync(
      file,
      constants.O_RDONLY |
        constants.O_NONBLOCK |
        constants.O_NOFOLLOW,
    );
  } catch (error) {
    planFailure(
      file,
      "a readable non-symlink regular adapter-plan file",
      error instanceof Error ? error.message : "cannot open plan",
    );
  }
  let decoded: unknown;
  try {
    const stats = fstatSync(descriptor);
    if (!stats.isFile() || stats.nlink !== 1 || stats.size > 16 * 1024 * 1024) {
      planFailure(
        file,
        "one regular adapter-plan file of at most 16 MiB with no hard links",
        !stats.isFile()
          ? "non-regular filesystem entry"
          : stats.nlink !== 1
            ? `${stats.nlink} hard links`
            : `${stats.size} bytes`,
      );
    }
    try {
      decoded = JSON.parse(readFileSync(descriptor, "utf8"));
    } catch (error) {
      planFailure(
        file,
        "readable strict adapter-plan JSON",
        error instanceof Error ? error.message : "malformed JSON",
      );
    }
  } finally {
    closeSync(descriptor);
  }
  return parseAdapterPlan(decoded);
}
