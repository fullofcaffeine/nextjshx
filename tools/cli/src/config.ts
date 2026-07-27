import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

import { configFailure } from "./diagnostic.js";

export const CONFIG_FILE_NAME = "nextjshx.config.json";
export const CONFIG_SCHEMA_ID = "https://nextjshx.dev/schemas/config-v2.json";
export const CONFIG_SCHEMA_VERSION = 2 as const;
export const LEGACY_CONFIG_SCHEMA_ID =
  "https://nextjshx.dev/schemas/config-v1.json";
export const LEGACY_CONFIG_SCHEMA_VERSION = 1 as const;

export type OutputLanguage = "typescript" | "javascript";
export type OutputIntent = "reviewable" | "optimized";
export type SourceMapMode = "external" | "inline" | "none";
export type DeclarationMode = "public" | "all" | "none";
export type JsxRuntime = "automatic" | "classic";

export interface OutputProfile {
  readonly language: OutputLanguage;
  readonly intent: OutputIntent;
  readonly profileVersion: 1;
  readonly sourceMaps: SourceMapMode;
  readonly sourcesContent: boolean;
  readonly declarations: DeclarationMode;
  readonly jsxRuntime: JsxRuntime;
}

export interface ConfigMigrationReport {
  readonly fromSchemaVersion: typeof LEGACY_CONFIG_SCHEMA_VERSION;
  readonly toSchemaVersion: typeof CONFIG_SCHEMA_VERSION;
  readonly effectiveProfile: OutputProfile;
  readonly removedCompilerOwnedDefines: readonly string[];
  readonly retainedApplicationDefines: readonly string[];
}

export interface HaxeConfig {
  readonly hxml: string;
  readonly generatedRoot: string;
  readonly defines: readonly string[];
  readonly extraInputs: readonly string[];
}

export interface NextConfig {
  readonly package: string;
  readonly upstreamDir?: string;
  readonly typedRoutes: boolean;
  readonly cacheComponents: boolean;
  readonly experimentalCacheDirectives: readonly ExperimentalCacheDirective[];
}

export type ExperimentalCacheDirective = "private" | "remote";

export interface OutputConfig {
  readonly manifest: string;
  readonly format: "project";
  readonly profile?: OutputProfile;
}

export interface BoundaryReportConfig {
  readonly maxDirectDependencies?: number;
  readonly maxObservedClientBytes?: number;
}

export interface NextJsHxConfig {
  readonly $schema?: typeof CONFIG_SCHEMA_ID | typeof LEGACY_CONFIG_SCHEMA_ID;
  readonly schemaVersion:
    | typeof CONFIG_SCHEMA_VERSION
    | typeof LEGACY_CONFIG_SCHEMA_VERSION;
  readonly appRoot?: string;
  readonly boundaries: BoundaryReportConfig;
  readonly haxe: HaxeConfig;
  readonly next: NextConfig;
  readonly output: OutputConfig;
  readonly migration?: ConfigMigrationReport;
}

type JsonObject = Record<string, unknown>;

const ROOT_KEYS = [
  "$schema",
  "appRoot",
  "boundaries",
  "haxe",
  "next",
  "output",
  "schemaVersion",
];
const BOUNDARY_KEYS = ["maxDirectDependencies", "maxObservedClientBytes"];
const HAXE_KEYS = ["defines", "extraInputs", "generatedRoot", "hxml"];
const NEXT_KEYS = [
  "cacheComponents",
  "experimentalCacheDirectives",
  "package",
  "typedRoutes",
  "upstreamDir",
];
const OUTPUT_KEYS_V1 = ["format", "manifest"];
const OUTPUT_KEYS_V2 = [
  "declarations",
  "format",
  "intent",
  "jsxRuntime",
  "language",
  "manifest",
  "profileVersion",
  "sourceMaps",
  "sourcesContent",
];
export const DEFAULT_OUTPUT_PROFILE: OutputProfile = Object.freeze({
  language: "typescript",
  intent: "reviewable",
  profileVersion: 1,
  sourceMaps: "external",
  sourcesContent: true,
  declarations: "public",
  jsxRuntime: "automatic",
});

function objectValue(value: unknown, subject: string): JsonObject {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    configFailure(
      "NXHX-CONFIG-SHAPE-0003",
      `${subject} must be a JSON object.`,
      subject,
      "a JSON object",
      "Replace the value with an object containing only documented configuration keys.",
    );
  }
  return value as JsonObject;
}

function assertClosedKeys(value: JsonObject, allowed: readonly string[], subject: string): void {
  const allowedSet = new Set(allowed);
  const unknown = Object.keys(value)
    .filter((key) => !allowedSet.has(key))
    .sort();
  if (unknown.length > 0) {
    configFailure(
      "NXHX-CONFIG-UNKNOWN-0004",
      `${subject} contains unknown ${unknown.length === 1 ? "key" : "keys"}: ${unknown.join(", ")}.`,
      subject,
      `only ${allowed.join(", ")}`,
      "Remove the unknown key or update the config with a schema version that defines it.",
    );
  }
}

function assertRequiredKeys(value: JsonObject, required: readonly string[], subject: string): void {
  const missing = required.filter((key) => !Object.hasOwn(value, key)).sort();
  if (missing.length > 0) {
    configFailure(
      "NXHX-CONFIG-REQUIRED-0005",
      `${subject} is missing required ${missing.length === 1 ? "key" : "keys"}: ${missing.join(", ")}.`,
      subject,
      `required keys ${required.join(", ")}`,
      "Add every required key using the versioned configuration reference.",
    );
  }
}

function stringValue(value: unknown, subject: string): string {
  if (typeof value !== "string" || value.length === 0 || value.trim() !== value) {
    configFailure(
      "NXHX-CONFIG-VALUE-0007",
      `${subject} must be a non-empty string without surrounding whitespace.`,
      subject,
      "a non-empty string",
      "Provide the documented string value without leading or trailing whitespace.",
    );
  }
  return value;
}

function booleanValue(value: unknown, subject: string): boolean {
  if (typeof value !== "boolean") {
    configFailure(
      "NXHX-CONFIG-VALUE-0007",
      `${subject} must be a boolean.`,
      subject,
      "true or false",
      "Replace the value with a JSON boolean.",
    );
  }
  return value;
}

function literalValue<const Value extends string>(
  value: unknown,
  subject: string,
  allowed: readonly Value[],
): Value {
  if (typeof value !== "string" || !allowed.includes(value as Value)) {
    configFailure(
      "NXHX-CONFIG-VALUE-0007",
      `${subject} is unsupported.`,
      subject,
      allowed.map((entry) => JSON.stringify(entry)).join(" or "),
      "Select one documented literal; output policy never falls back silently.",
    );
  }
  return value as Value;
}

function positiveInteger(value: unknown, subject: string): number {
  if (!Number.isSafeInteger(value) || (value as number) <= 0) {
    configFailure(
      "NXHX-CONFIG-VALUE-0007",
      `${subject} must be a positive safe integer.`,
      subject,
      "a positive profile contract version",
      "Use profileVersion 1 for the currently defined output contract.",
    );
  }
  return value as number;
}

function nonNegativeInteger(value: unknown, subject: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    configFailure(
      "NXHX-CONFIG-VALUE-0007",
      `${subject} must be a non-negative safe integer.`,
      subject,
      "a non-negative integer",
      "Use an exact dependency count or byte budget; omit the key to disable that warning.",
    );
  }
  return value as number;
}

function outputProfile(output: JsonObject): OutputProfile {
  const profileVersion = positiveInteger(
    output.profileVersion,
    "$.output.profileVersion",
  );
  if (profileVersion !== 1) {
    configFailure(
      "NXHX-CONFIG-VALUE-0007",
      `$.output.profileVersion ${profileVersion} is unsupported.`,
      "$.output.profileVersion",
      "the integer 1",
      "Keep the project pinned to a released profile contract until an explicit migration exists.",
    );
  }
  const declarations = literalValue(
    output.declarations,
    "$.output.declarations",
    ["public", "all", "none"] as const,
  );
  return Object.freeze({
    language: literalValue(
      output.language,
      "$.output.language",
      ["typescript", "javascript"] as const,
    ),
    intent: literalValue(
      output.intent,
      "$.output.intent",
      ["reviewable", "optimized"] as const,
    ),
    profileVersion: 1,
    sourceMaps: literalValue(
      output.sourceMaps,
      "$.output.sourceMaps",
      ["external", "inline", "none"] as const,
    ),
    sourcesContent: booleanValue(
      output.sourcesContent,
      "$.output.sourcesContent",
    ),
    declarations,
    jsxRuntime: literalValue(
      output.jsxRuntime,
      "$.output.jsxRuntime",
      ["automatic", "classic"] as const,
    ),
  });
}

function experimentalCacheDirectivesValue(
  value: unknown,
): readonly ExperimentalCacheDirective[] {
  if (!Array.isArray(value)) {
    configFailure(
      "NXHX-CONFIG-VALUE-0007",
      "$.next.experimentalCacheDirectives must be an array.",
      "$.next.experimentalCacheDirectives",
      'a unique array containing only "private" and/or "remote"',
      "Use an empty array for stable shared caching, and opt into each experimental directive explicitly.",
    );
  }
  const parsed = value.map((entry, index) => {
    if (entry !== "private" && entry !== "remote") {
      configFailure(
        "NXHX-CONFIG-VALUE-0007",
        `$.next.experimentalCacheDirectives[${index}] is unsupported.`,
        `$.next.experimentalCacheDirectives[${index}]`,
        'the literal "private" or "remote"',
        "Remove the value or select an experimental cache directive supported by this release.",
      );
    }
    return entry;
  });
  if (new Set(parsed).size !== parsed.length) {
    configFailure(
      "NXHX-CONFIG-VALUE-0007",
      "$.next.experimentalCacheDirectives contains a duplicate.",
      "$.next.experimentalCacheDirectives",
      "unique explicit capability names",
      "List each experimental cache directive at most once.",
    );
  }
  return Object.freeze(parsed);
}

function projectPath(value: unknown, subject: string): string {
  const candidate = stringValue(value, subject);
  const segments = candidate.split("/");
  if (
    path.posix.isAbsolute(candidate) ||
    path.win32.isAbsolute(candidate) ||
    candidate.includes("\\") ||
    candidate.includes("\0") ||
    segments.some((segment) => segment === "" || segment === "." || segment === "..")
  ) {
    configFailure(
      "NXHX-CONFIG-PATH-0008",
      `${subject} must be a portable path contained by the project package root.`,
      subject,
      "a slash-separated relative path with no dot or parent segments",
      "Move the target under the package root and configure its project-relative path.",
    );
  }
  return candidate;
}

function externalRelativePath(value: unknown, subject: string): string {
  const candidate = stringValue(value, subject);
  const segments = candidate.split("/");
  if (
    path.posix.isAbsolute(candidate) ||
    path.win32.isAbsolute(candidate) ||
    candidate.includes("\\") ||
    candidate.includes("\0") ||
    segments.some((segment) => segment === "" || segment === ".")
  ) {
    configFailure(
      "NXHX-CONFIG-PATH-0008",
      `${subject} must be a portable relative path.`,
      subject,
      "a slash-separated relative path; parent segments are allowed only for this read-only oracle",
      "Configure a relative path such as ../next.js, or remove the optional upstreamDir key.",
    );
  }
  return candidate;
}

function packageName(value: unknown, subject: string): string {
  const candidate = stringValue(value, subject);
  if (!/^(?:@[a-z0-9][a-z0-9._~-]*\/)?[a-z0-9][a-z0-9._~-]*$/.test(candidate)) {
    configFailure(
      "NXHX-CONFIG-PACKAGE-0009",
      `${subject} is not a valid npm package name.`,
      subject,
      "next or a lowercase npm package name such as @scope/next",
      "Use the dependency name from this project's package.json, not a filesystem path or URL.",
    );
  }
  return candidate;
}

function definesValue(
  value: unknown,
  allowCompilerOwned = false,
): readonly string[] {
  if (!Array.isArray(value)) {
    configFailure(
      "NXHX-CONFIG-VALUE-0007",
      "$.haxe.defines must be an array.",
      "$.haxe.defines",
      "an array of unique non-empty strings",
      "List each Haxe define once as a JSON string.",
    );
  }
  const defines = value.map((entry, index) => {
    const define = stringValue(entry, `$.haxe.defines[${index}]`);
    if (
      !/^[A-Za-z0-9_.-]+(?:=[^\s\u0000-\u001f\u007f]+)?$/.test(define) ||
      (!allowCompilerOwned &&
        isCompilerOwnedDefine(defineName(define)))
    ) {
      configFailure(
        "NXHX-CONFIG-VALUE-0007",
        `$.haxe.defines[${index}] is malformed or reserved by the CLI.`,
        `$.haxe.defines[${index}]`,
        "a compact non-CLI-owned Haxe define",
        "Use name or name=value syntax; the CLI alone owns adapter-plan and discovered-root defines.",
      );
    }
    return define;
  });
  if (new Set(defines).size !== defines.length) {
    configFailure(
      "NXHX-CONFIG-VALUE-0007",
      "$.haxe.defines contains a duplicate define.",
      "$.haxe.defines",
      "an array of unique non-empty strings",
      "Remove the duplicate so build inputs remain deterministic.",
    );
  }
  return Object.freeze(defines);
}

function defineName(define: string): string {
  return define.split("=", 1)[0] ?? define;
}

function isCompilerOwnedDefine(name: string): boolean {
  return (
    name === "dts" ||
    name.startsWith("genes.") ||
    name.startsWith("nextjshx.")
  );
}

function isSupportedLegacyCompilerDefine(define: string): boolean {
  return (
    [
      "dts",
      "genes.no_extension",
      "genes.react.inline_markup",
      "genes.react.jsx_runtime_module=react",
      "genes.ts",
      "genes.ts.jsx_classic",
      "genes.ts.jsx_import_source=react",
      "genes.ts.no_extension",
    ].includes(define)
  );
}

function legacyMigration(defines: readonly string[]): ConfigMigrationReport {
  const compilerOwnedDefines = defines.filter((define) =>
    isCompilerOwnedDefine(defineName(define)),
  );
  const unsupported = compilerOwnedDefines.filter(
    (define) => !isSupportedLegacyCompilerDefine(define),
  );
  const importSource = compilerOwnedDefines.find((define) =>
    define.startsWith("genes.ts.jsx_import_source="),
  );
  const classic = compilerOwnedDefines.includes("genes.ts.jsx_classic");
  const typescript = compilerOwnedDefines.some(
    (define) =>
      defineName(define) === "genes.ts" ||
      defineName(define).startsWith("genes.ts."),
  );
  const javascript = compilerOwnedDefines.some(
    (define) =>
      defineName(define) === "genes.no_extension" ||
      defineName(define).startsWith("genes.react."),
  );
  if (
    (typescript && javascript) ||
    (classic && importSource !== undefined) ||
    (importSource !== undefined &&
      importSource !== "genes.ts.jsx_import_source=react") ||
    unsupported.length > 0
  ) {
    configFailure(
      "NXHX-CONFIG-VALUE-0007",
      "Schema-v1 compiler defines do not map to one closed schema-v2 output profile.",
      "$.haxe.defines",
      "one unambiguous TypeScript or JavaScript profile using the React JSX runtime",
      `Remove contradictory or unsupported compiler defines (${unsupported.join(", ") || "conflicting language/JSX settings"}) or migrate the custom compiler policy explicitly.`,
    );
  }
  const effectiveProfile: OutputProfile = Object.freeze({
    ...DEFAULT_OUTPUT_PROFILE,
    language: javascript ? "javascript" : "typescript",
    jsxRuntime: classic ? "classic" : "automatic",
    declarations:
      javascript && !compilerOwnedDefines.includes("dts") ? "none" : "public",
  });
  const removedCompilerOwnedDefines = defines.filter((define) =>
    isCompilerOwnedDefine(defineName(define)),
  );
  const retainedApplicationDefines = defines.filter(
    (define) => !isCompilerOwnedDefine(defineName(define)),
  );
  return Object.freeze({
    fromSchemaVersion: LEGACY_CONFIG_SCHEMA_VERSION,
    toSchemaVersion: CONFIG_SCHEMA_VERSION,
    effectiveProfile,
    removedCompilerOwnedDefines: Object.freeze(removedCompilerOwnedDefines),
    retainedApplicationDefines: Object.freeze(retainedApplicationDefines),
  });
}

function extraInputsValue(value: unknown): readonly string[] {
  if (!Array.isArray(value)) {
    configFailure(
      "NXHX-CONFIG-VALUE-0007",
      "$.haxe.extraInputs must be an array.",
      "$.haxe.extraInputs",
      "an array of unique project-relative files or directories",
      "List only non-generated build inputs that should trigger Haxe development rebuilds.",
    );
  }
  const inputs = value.map((entry, index) =>
    projectPath(entry, `$.haxe.extraInputs[${index}]`),
  );
  if (new Set(inputs.map((entry) => entry.toLowerCase())).size !== inputs.length) {
    configFailure(
      "NXHX-CONFIG-VALUE-0007",
      "$.haxe.extraInputs contains a filesystem-equivalent duplicate.",
      "$.haxe.extraInputs",
      "unique portable project-relative paths",
      "Remove duplicate paths so watch identity remains deterministic across filesystems.",
    );
  }
  return Object.freeze(inputs);
}

export function parseNextJsHxConfig(decoded: unknown): NextJsHxConfig {
  const root = objectValue(decoded, "$");
  assertClosedKeys(root, ROOT_KEYS, "$");
  assertRequiredKeys(root, ["schemaVersion", "haxe", "next", "output"], "$");

  if (
    root.schemaVersion !== CONFIG_SCHEMA_VERSION &&
    root.schemaVersion !== LEGACY_CONFIG_SCHEMA_VERSION
  ) {
    configFailure(
      "NXHX-CONFIG-VERSION-0006",
      `$.schemaVersion must be ${LEGACY_CONFIG_SCHEMA_VERSION} or ${CONFIG_SCHEMA_VERSION}; received ${JSON.stringify(root.schemaVersion)}.`,
      "$.schemaVersion",
      `the integer ${LEGACY_CONFIG_SCHEMA_VERSION} or ${CONFIG_SCHEMA_VERSION}`,
      "Migrate through the bounded schema-v1 report or use the current schema-v2 configuration.",
    );
  }
  const schemaVersion = root.schemaVersion;
  const expectedSchema =
    schemaVersion === CONFIG_SCHEMA_VERSION
      ? CONFIG_SCHEMA_ID
      : LEGACY_CONFIG_SCHEMA_ID;
  if (Object.hasOwn(root, "$schema") && root.$schema !== expectedSchema) {
    configFailure(
      "NXHX-CONFIG-VERSION-0006",
      `$.$schema must identify ${expectedSchema}.`,
      "$.$schema",
      expectedSchema,
      `Use the schema identifier matching schemaVersion ${schemaVersion}, or omit the optional $schema key.`,
    );
  }

  const haxe = objectValue(root.haxe, "$.haxe");
  assertClosedKeys(haxe, HAXE_KEYS, "$.haxe");
  assertRequiredKeys(haxe, ["defines", "generatedRoot", "hxml"], "$.haxe");
  const hxml = projectPath(haxe.hxml, "$.haxe.hxml");
  if (!hxml.endsWith(".hxml")) {
    configFailure(
      "NXHX-CONFIG-VALUE-0007",
      "$.haxe.hxml must name an .hxml file.",
      "$.haxe.hxml",
      "a project-relative path ending in .hxml",
      "Point hxml at the Haxe build file used for NextJsHx generation.",
    );
  }

  const next = objectValue(root.next, "$.next");
  assertClosedKeys(next, NEXT_KEYS, "$.next");
  assertRequiredKeys(next, ["package", "typedRoutes"], "$.next");

  const output = objectValue(root.output, "$.output");
  const outputKeys =
    schemaVersion === CONFIG_SCHEMA_VERSION ? OUTPUT_KEYS_V2 : OUTPUT_KEYS_V1;
  assertClosedKeys(output, outputKeys, "$.output");
  assertRequiredKeys(output, outputKeys, "$.output");
  const manifest = projectPath(output.manifest, "$.output.manifest");
  if (!manifest.startsWith(".nextjshx/") || !manifest.endsWith(".json")) {
    configFailure(
      "NXHX-CONFIG-VALUE-0007",
      "$.output.manifest must name a .json control file under .nextjshx/.",
      "$.output.manifest",
      "a path such as .nextjshx/manifest.json",
      "Keep ownership control data under the reserved .nextjshx directory.",
    );
  }
  if (
    manifest === ".nextjshx/transaction.json" ||
    manifest.startsWith(".nextjshx/transactions/") ||
    manifest.startsWith(".nextjshx/plans/")
  ) {
    configFailure(
      "NXHX-CONFIG-VALUE-0007",
      "$.output.manifest collides with the transactional journal workspace.",
      "$.output.manifest",
      "a dedicated JSON file such as .nextjshx/manifest.json",
      "Keep the ownership manifest separate from publish.lock, transaction.json, transactions/, and plans/.",
    );
  }
  if (output.format !== "project") {
    configFailure(
      "NXHX-CONFIG-VALUE-0007",
      `$.output.format must be "project".`,
      "$.output.format",
      "project",
      "Use project formatting until a later schema explicitly adds another mode.",
    );
  }

  const appRoot = Object.hasOwn(root, "appRoot")
    ? projectPath(root.appRoot, "$.appRoot")
    : undefined;
  const boundaries = Object.hasOwn(root, "boundaries")
    ? objectValue(root.boundaries, "$.boundaries")
    : {};
  assertClosedKeys(boundaries, BOUNDARY_KEYS, "$.boundaries");
  const upstreamDir = Object.hasOwn(next, "upstreamDir")
    ? externalRelativePath(next.upstreamDir, "$.next.upstreamDir")
    : undefined;
  const cacheComponents = Object.hasOwn(next, "cacheComponents")
    ? booleanValue(next.cacheComponents, "$.next.cacheComponents")
    : false;
  const experimentalCacheDirectives = Object.hasOwn(
    next,
    "experimentalCacheDirectives",
  )
    ? experimentalCacheDirectivesValue(next.experimentalCacheDirectives)
    : Object.freeze([] as ExperimentalCacheDirective[]);
  if (!cacheComponents && experimentalCacheDirectives.length > 0) {
    configFailure(
      "NXHX-CONFIG-VALUE-0007",
      "$.next.experimentalCacheDirectives requires $.next.cacheComponents to be true.",
      "$.next.experimentalCacheDirectives",
      "an empty array unless Cache Components are enabled",
      "Enable cacheComponents deliberately or remove the experimental cache capabilities.",
    );
  }
  const parsedDefines = definesValue(
    haxe.defines,
    schemaVersion === LEGACY_CONFIG_SCHEMA_VERSION,
  );
  const migration =
    schemaVersion === LEGACY_CONFIG_SCHEMA_VERSION
      ? legacyMigration(parsedDefines)
      : undefined;
  const profile =
    migration === undefined
      ? outputProfile(output)
      : migration.effectiveProfile;

  return Object.freeze({
    ...(Object.hasOwn(root, "$schema") ? { $schema: expectedSchema } : {}),
    schemaVersion,
    ...(appRoot === undefined ? {} : { appRoot }),
    boundaries: Object.freeze({
      ...(Object.hasOwn(boundaries, "maxDirectDependencies")
        ? {
            maxDirectDependencies: nonNegativeInteger(
              boundaries.maxDirectDependencies,
              "$.boundaries.maxDirectDependencies",
            ),
          }
        : {}),
      ...(Object.hasOwn(boundaries, "maxObservedClientBytes")
        ? {
            maxObservedClientBytes: nonNegativeInteger(
              boundaries.maxObservedClientBytes,
              "$.boundaries.maxObservedClientBytes",
            ),
          }
        : {}),
    }),
    haxe: Object.freeze({
      hxml,
      generatedRoot: projectPath(haxe.generatedRoot, "$.haxe.generatedRoot"),
      defines:
        migration === undefined
          ? parsedDefines
          : migration.retainedApplicationDefines,
      extraInputs: Object.hasOwn(haxe, "extraInputs")
        ? extraInputsValue(haxe.extraInputs)
        : Object.freeze([] as string[]),
    }),
    next: Object.freeze({
      package: packageName(next.package, "$.next.package"),
      ...(upstreamDir === undefined ? {} : { upstreamDir }),
      typedRoutes: booleanValue(next.typedRoutes, "$.next.typedRoutes"),
      cacheComponents,
      experimentalCacheDirectives,
    }),
    output: Object.freeze({
      manifest,
      format: "project" as const,
      profile,
    }),
    ...(migration === undefined ? {} : { migration }),
  });
}

export function effectiveOutputProfile(
  config: NextJsHxConfig,
): OutputProfile {
  return config.output.profile ?? DEFAULT_OUTPUT_PROFILE;
}

export function outputProfileFingerprint(profile: OutputProfile): string {
  const canonical = [
    profile.language,
    profile.intent,
    profile.profileVersion.toString(10),
    profile.sourceMaps,
    profile.sourcesContent ? "true" : "false",
    profile.declarations,
    profile.jsxRuntime,
  ].join("\0");
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

export function effectiveOutputProfileFingerprint(
  config: NextJsHxConfig,
): string {
  return outputProfileFingerprint(effectiveOutputProfile(config));
}

export function effectiveHaxeDefines(
  config: NextJsHxConfig,
): readonly string[] {
  const profile = effectiveOutputProfile(config);
  const compilerOwned =
    profile.language === "typescript"
      ? [
          "genes.ts",
          "genes.ts.no_extension",
          ...(profile.jsxRuntime === "classic"
            ? ["genes.ts.jsx_classic"]
            : ["genes.ts.jsx_import_source=react"]),
        ]
      : [
          "genes.no_extension",
          "genes.react.inline_markup",
          "genes.react.jsx_runtime_module=react",
        ];
  const declarationDefines =
    profile.language === "javascript" && profile.declarations !== "none"
      ? ["dts"]
      : [];
  return Object.freeze([
    ...config.haxe.defines,
    ...compilerOwned,
    ...declarationDefines,
  ]);
}

export function readNextJsHxConfig(configPath: string): NextJsHxConfig {
  let source: string;
  try {
    source = readFileSync(configPath, "utf8");
  } catch {
    configFailure(
      "NXHX-CONFIG-READ-0001",
      `Cannot read ${CONFIG_FILE_NAME}.`,
      configPath,
      `a readable ${CONFIG_FILE_NAME}`,
      `Create ${CONFIG_FILE_NAME} at the package root or pass its exact path.`,
    );
  }

  let decoded: unknown;
  try {
    decoded = JSON.parse(source);
  } catch {
    configFailure(
      "NXHX-CONFIG-JSON-0002",
      `${CONFIG_FILE_NAME} is not valid JSON.`,
      configPath,
      "strict JSON data, not JavaScript or JSON5",
      "Fix the JSON syntax; executable configuration is intentionally unsupported.",
    );
  }

  return parseNextJsHxConfig(decoded);
}
