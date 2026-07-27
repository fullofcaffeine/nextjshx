import { createHash } from "node:crypto";

import {
  DEFAULT_OUTPUT_PROFILE,
  type OutputProfile,
  outputProfileFingerprint,
} from "./config.js";
import { ownershipFailure } from "./ownership-diagnostic.js";
import { validateOutputPath } from "./ownership-path.js";

export const OUTPUT_MANIFEST_PROTOCOL = "nextjshx.generated-output";
export const OUTPUT_MANIFEST_VERSION = 2 as const;
export const LEGACY_OUTPUT_MANIFEST_VERSION = 1 as const;
export const OUTPUT_MANIFEST_SCHEMA_ID =
  "https://nextjshx.dev/schemas/generated-output-manifest-v2.json";

export interface GeneratedOutputRecord {
  readonly path: string;
  readonly kind: string;
  readonly source: string;
  readonly sha256: string;
}

export interface GeneratedOutputManifest {
  readonly protocol: typeof OUTPUT_MANIFEST_PROTOCOL;
  readonly version: typeof OUTPUT_MANIFEST_VERSION;
  readonly generation: string;
  readonly nextVersion: string;
  readonly genesVersion: string;
  readonly outputProfile: OutputProfile;
  readonly outputProfileFingerprint: string;
  readonly outputs: readonly GeneratedOutputRecord[];
}

export interface GeneratedOutputIdentity {
  readonly path: string;
  readonly kind: string;
  readonly source: string;
  readonly sha256: string;
}

type JsonObject = Record<string, unknown>;

const MANIFEST_KEYS = [
  "generation",
  "genesVersion",
  "nextVersion",
  "outputProfile",
  "outputProfileFingerprint",
  "outputs",
  "protocol",
  "version",
];
const LEGACY_MANIFEST_KEYS = [
  "generation",
  "genesVersion",
  "nextVersion",
  "outputs",
  "protocol",
  "version",
];
const OUTPUT_PROFILE_KEYS = [
  "declarations",
  "intent",
  "jsxRuntime",
  "language",
  "profileVersion",
  "sourceMaps",
  "sourcesContent",
];
const OUTPUT_KEYS = ["kind", "path", "sha256", "source"];
const SHA256 = /^[0-9a-f]{64}$/;
const OUTPUT_KIND = /^[a-z][a-z0-9-]*$/;
const OUTPUT_SOURCE =
  /^[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*$/;
const TOOL_VERSION = /^[^\s\u0000-\u001f]{1,256}$/;

function objectValue(value: unknown, subject: string): JsonObject {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    ownershipFailure(
      "NXHX-OWNERSHIP-MANIFEST-0001",
      `${subject} must be a JSON object.`,
      subject,
      "a closed generated-output manifest object",
      typeof value,
      "Restore or repair the manifest before generating or cleaning outputs.",
    );
  }
  return value as JsonObject;
}

function closedKeys(value: JsonObject, allowed: readonly string[], subject: string): void {
  const allowedSet = new Set(allowed);
  const unknown = Object.keys(value)
    .filter((key) => !allowedSet.has(key))
    .sort();
  if (unknown.length > 0) {
    ownershipFailure(
      "NXHX-OWNERSHIP-MANIFEST-0001",
      `${subject} contains unknown ${unknown.length === 1 ? "key" : "keys"}: ${unknown.join(", ")}.`,
      subject,
      `only ${allowed.join(", ")}`,
      unknown.join(", "),
      "Do not guess at unknown ownership data; use a CLI version that supports this manifest.",
    );
  }
}

function requiredKeys(value: JsonObject, required: readonly string[], subject: string): void {
  const missing = required.filter((key) => !Object.hasOwn(value, key)).sort();
  if (missing.length > 0) {
    ownershipFailure(
      "NXHX-OWNERSHIP-MANIFEST-0001",
      `${subject} is missing required ${missing.length === 1 ? "key" : "keys"}: ${missing.join(", ")}.`,
      subject,
      `required keys ${required.join(", ")}`,
      missing.join(", "),
      "Restore the complete manifest rather than inferring ownership from live files.",
    );
  }
}

function stringValue(value: unknown, subject: string): string {
  if (typeof value !== "string" || value.length === 0 || value.trim() !== value) {
    ownershipFailure(
      "NXHX-OWNERSHIP-MANIFEST-0001",
      `${subject} must be a non-empty string without surrounding whitespace.`,
      subject,
      "a non-empty string",
      JSON.stringify(value),
      "Repair the manifest from known generated state before continuing.",
    );
  }
  return value;
}

function profileLiteral<const Value extends string>(
  value: unknown,
  subject: string,
  allowed: readonly Value[],
): Value {
  if (typeof value !== "string" || !allowed.includes(value as Value)) {
    ownershipFailure(
      "NXHX-OWNERSHIP-MANIFEST-0001",
      `${subject} is not a supported output-profile value.`,
      subject,
      allowed.map((entry) => JSON.stringify(entry)).join(" or "),
      JSON.stringify(value),
      "Restore the exact configured output profile before touching generated files.",
    );
  }
  return value as Value;
}

function parseOutputProfile(value: unknown, subject: string): OutputProfile {
  const profile = objectValue(value, subject);
  closedKeys(profile, OUTPUT_PROFILE_KEYS, subject);
  requiredKeys(profile, OUTPUT_PROFILE_KEYS, subject);
  if (profile.profileVersion !== 1) {
    ownershipFailure(
      "NXHX-OWNERSHIP-MANIFEST-0001",
      `${subject}.profileVersion is unsupported.`,
      `${subject}.profileVersion`,
      "the integer 1",
      JSON.stringify(profile.profileVersion),
      "Use a CLI that supports the recorded profile contract or migrate it explicitly.",
    );
  }
  if (typeof profile.sourcesContent !== "boolean") {
    ownershipFailure(
      "NXHX-OWNERSHIP-MANIFEST-0001",
      `${subject}.sourcesContent must be a boolean.`,
      `${subject}.sourcesContent`,
      "true or false",
      JSON.stringify(profile.sourcesContent),
      "Restore the exact configured source-map policy before touching generated files.",
    );
  }
  return Object.freeze({
    language: profileLiteral(
      profile.language,
      `${subject}.language`,
      ["typescript", "javascript"] as const,
    ),
    intent: profileLiteral(
      profile.intent,
      `${subject}.intent`,
      ["reviewable", "optimized"] as const,
    ),
    profileVersion: 1,
    sourceMaps: profileLiteral(
      profile.sourceMaps,
      `${subject}.sourceMaps`,
      ["external", "inline", "none"] as const,
    ),
    sourcesContent: profile.sourcesContent,
    declarations: profileLiteral(
      profile.declarations,
      `${subject}.declarations`,
      ["public", "all", "none"] as const,
    ),
    jsxRuntime: profileLiteral(
      profile.jsxRuntime,
      `${subject}.jsxRuntime`,
      ["automatic", "classic"] as const,
    ),
  });
}

function outputRecord(value: unknown, index: number): GeneratedOutputRecord {
  const subject = `$.outputs[${index}]`;
  const record = objectValue(value, subject);
  closedKeys(record, OUTPUT_KEYS, subject);
  requiredKeys(record, OUTPUT_KEYS, subject);
  const kind = stringValue(record.kind, `${subject}.kind`);
  if (!OUTPUT_KIND.test(kind)) {
    ownershipFailure(
      "NXHX-OWNERSHIP-MANIFEST-0001",
      `${subject}.kind is not a normalized output kind.`,
      `${subject}.kind`,
      "a lowercase kebab-case kind",
      kind,
      "Repair the manifest with the adapter kind recorded by the renderer.",
    );
  }
  const sha256 = stringValue(record.sha256, `${subject}.sha256`);
  if (!SHA256.test(sha256)) {
    ownershipFailure(
      "NXHX-OWNERSHIP-MANIFEST-0001",
      `${subject}.sha256 is not a lowercase SHA-256 digest.`,
      `${subject}.sha256`,
      "64 lowercase hexadecimal characters",
      sha256,
      "Repair or regenerate the manifest through an explicit recovery workflow.",
    );
  }
  const source = stringValue(record.source, `${subject}.source`);
  if (!OUTPUT_SOURCE.test(source)) {
    ownershipFailure(
      "NXHX-OWNERSHIP-MANIFEST-0001",
      `${subject}.source is not a qualified Haxe type name.`,
      `${subject}.source`,
      "a dot-separated qualified Haxe type",
      source,
      "Record the declaration type that requested this adapter, without a host path.",
    );
  }
  return Object.freeze({
    path: validateOutputPath(stringValue(record.path, `${subject}.path`), `${subject}.path`),
    kind,
    source,
    sha256,
  });
}

function legacyManifestGeneration(
  outputs: readonly GeneratedOutputIdentity[],
): string {
  const canonical = [...outputs]
    .sort((left, right) => Buffer.from(left.path).compare(Buffer.from(right.path)))
    .map((output) => `${output.path}\0${output.sha256}\n`)
    .join("");
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

export function manifestGeneration(
  outputProfileFingerprintValue: string,
  outputs: readonly GeneratedOutputIdentity[],
): string {
  const canonical = [...outputs]
    .sort((left, right) => Buffer.from(left.path).compare(Buffer.from(right.path)))
    .map((output) => `${output.path}\0${output.sha256}\n`)
    .join("");
  return createHash("sha256")
    .update(`${outputProfileFingerprintValue}\n${canonical}`, "utf8")
    .digest("hex");
}

function assertCanonicalOutputs(outputs: readonly GeneratedOutputRecord[]): void {
  const identities = new Map<string, string>();
  let previous: string | null = null;
  for (const output of outputs) {
    const folded = output.path.toLowerCase();
    const duplicate = identities.get(folded);
    if (duplicate !== undefined) {
      ownershipFailure(
        "NXHX-OWNERSHIP-DUPLICATE-0005",
        `The manifest contains filesystem-equivalent output paths ${duplicate} and ${output.path}.`,
        output.path,
        "one unique portable output path",
        duplicate,
        "Repair the manifest; a directory never grants ownership of colliding files.",
        output.source,
      );
    }
    if (
      previous !== null &&
      Buffer.from(previous).compare(Buffer.from(output.path)) >= 0
    ) {
      ownershipFailure(
        "NXHX-OWNERSHIP-MANIFEST-0001",
        "Manifest outputs are not in canonical bytewise path order.",
        output.path,
        "strictly increasing bytewise paths",
        `previous path ${previous}`,
        "Restore the canonical manifest rather than accepting ambiguous ownership bytes.",
        output.source,
      );
    }
    identities.set(folded, output.path);
    previous = output.path;
  }
}

export function createGeneratedOutputManifest(
  nextVersion: string,
  genesVersion: string,
  outputProfile: OutputProfile,
  outputs: readonly GeneratedOutputIdentity[],
): GeneratedOutputManifest {
  const canonical = outputs
    .map((output, index) => outputRecord(output, index))
    .sort((left, right) => Buffer.from(left.path).compare(Buffer.from(right.path)));
  assertCanonicalOutputs(canonical);
  const validatedNextVersion = stringValue(nextVersion, "nextVersion");
  const validatedGenesVersion = stringValue(genesVersion, "genesVersion");
  if (
    !TOOL_VERSION.test(validatedNextVersion) ||
    !TOOL_VERSION.test(validatedGenesVersion)
  ) {
    ownershipFailure(
      "NXHX-OWNERSHIP-MANIFEST-0001",
      "Toolchain versions must be compact package identities.",
      "nextVersion/genesVersion",
      "non-whitespace package versions of at most 256 characters",
      `${JSON.stringify(nextVersion)} / ${JSON.stringify(genesVersion)}`,
      "Record the exact Next.js and Genes versions without paths or log text.",
    );
  }
  const validatedOutputProfile = parseOutputProfile(
    outputProfile,
    "outputProfile",
  );
  const fingerprint = outputProfileFingerprint(validatedOutputProfile);
  return Object.freeze({
    protocol: OUTPUT_MANIFEST_PROTOCOL,
    version: OUTPUT_MANIFEST_VERSION,
    generation: manifestGeneration(fingerprint, canonical),
    nextVersion: validatedNextVersion,
    genesVersion: validatedGenesVersion,
    outputProfile: validatedOutputProfile,
    outputProfileFingerprint: fingerprint,
    outputs: Object.freeze(canonical),
  });
}

export function parseGeneratedOutputManifest(decoded: unknown): GeneratedOutputManifest {
  const manifest = objectValue(decoded, "$");
  requiredKeys(manifest, ["version"], "$");
  if (
    manifest.version !== OUTPUT_MANIFEST_VERSION &&
    manifest.version !== LEGACY_OUTPUT_MANIFEST_VERSION
  ) {
    ownershipFailure(
      "NXHX-OWNERSHIP-VERSION-0002",
      `Manifest version ${JSON.stringify(manifest.version)} is not supported.`,
      "$.version",
      `the integer ${LEGACY_OUTPUT_MANIFEST_VERSION} or ${OUTPUT_MANIFEST_VERSION}`,
      JSON.stringify(manifest.version),
      "Use a compatible CLI or explicitly migrate the manifest before touching live outputs.",
    );
  }
  const legacy = manifest.version === LEGACY_OUTPUT_MANIFEST_VERSION;
  const manifestKeys = legacy ? LEGACY_MANIFEST_KEYS : MANIFEST_KEYS;
  closedKeys(manifest, manifestKeys, "$");
  requiredKeys(manifest, manifestKeys, "$");
  if (manifest.protocol !== OUTPUT_MANIFEST_PROTOCOL) {
    ownershipFailure(
      "NXHX-OWNERSHIP-MANIFEST-0001",
      "The ownership manifest protocol is not recognized.",
      "$.protocol",
      OUTPUT_MANIFEST_PROTOCOL,
      JSON.stringify(manifest.protocol),
      "Use the configured NextJsHx manifest; never treat an unrelated JSON file as ownership proof.",
    );
  }
  if (!Array.isArray(manifest.outputs)) {
    ownershipFailure(
      "NXHX-OWNERSHIP-MANIFEST-0001",
      "$.outputs must be an array.",
      "$.outputs",
      "a canonical output record array",
      typeof manifest.outputs,
      "Restore the complete output list; a malformed manifest owns nothing safely.",
    );
  }
  const outputs = manifest.outputs.map(outputRecord);
  assertCanonicalOutputs(outputs);
  const generation = stringValue(manifest.generation, "$.generation");
  const outputProfile = legacy
    ? DEFAULT_OUTPUT_PROFILE
    : parseOutputProfile(manifest.outputProfile, "$.outputProfile");
  const fingerprint = outputProfileFingerprint(outputProfile);
  if (!legacy) {
    const recordedFingerprint = stringValue(
      manifest.outputProfileFingerprint,
      "$.outputProfileFingerprint",
    );
    if (
      !SHA256.test(recordedFingerprint) ||
      recordedFingerprint !== fingerprint
    ) {
      ownershipFailure(
        "NXHX-OWNERSHIP-GENERATION-0011",
        "The output-profile fingerprint does not match the recorded profile.",
        "$.outputProfileFingerprint",
        fingerprint,
        recordedFingerprint,
        "Restore the manifest from the exact configured profile before publishing output.",
      );
    }
  }
  const expectedGeneration = legacy
    ? legacyManifestGeneration(outputs)
    : manifestGeneration(fingerprint, outputs);
  if (!SHA256.test(generation) || generation !== expectedGeneration) {
    ownershipFailure(
      "NXHX-OWNERSHIP-GENERATION-0011",
      "The manifest generation digest does not match its canonical output records.",
      "$.generation",
      expectedGeneration,
      generation,
      "Preserve the manifest for inspection and use explicit repair after verifying every live output.",
    );
  }
  const nextVersion = stringValue(manifest.nextVersion, "$.nextVersion");
  const genesVersion = stringValue(manifest.genesVersion, "$.genesVersion");
  if (!TOOL_VERSION.test(nextVersion) || !TOOL_VERSION.test(genesVersion)) {
    ownershipFailure(
      "NXHX-OWNERSHIP-MANIFEST-0001",
      "Manifest toolchain versions are not compact package identities.",
      "$.nextVersion/$.genesVersion",
      "non-whitespace package versions of at most 256 characters",
      `${JSON.stringify(nextVersion)} / ${JSON.stringify(genesVersion)}`,
      "Repair the manifest from exact package identities before continuing.",
    );
  }
  return Object.freeze({
    protocol: OUTPUT_MANIFEST_PROTOCOL,
    version: OUTPUT_MANIFEST_VERSION,
    generation: manifestGeneration(fingerprint, outputs),
    nextVersion,
    genesVersion,
    outputProfile,
    outputProfileFingerprint: fingerprint,
    outputs: Object.freeze(outputs),
  });
}

export function encodeGeneratedOutputManifest(manifest: GeneratedOutputManifest): string {
  const canonical = createGeneratedOutputManifest(
    manifest.nextVersion,
    manifest.genesVersion,
    manifest.outputProfile,
    manifest.outputs,
  );
  if (canonical.generation !== manifest.generation) {
    ownershipFailure(
      "NXHX-OWNERSHIP-GENERATION-0011",
      "Refusing to encode a manifest with a stale generation digest.",
      "$.generation",
      canonical.generation,
      manifest.generation,
      "Recreate the manifest from the complete intended output set.",
    );
  }
  return `${JSON.stringify(canonical, null, 2)}\n`;
}
