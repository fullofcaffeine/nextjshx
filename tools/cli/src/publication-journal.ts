import {
  validateOutputPath,
  validatePortableProjectPath,
} from "./ownership-path.js";
import { publicationFailure } from "./publication-diagnostic.js";

export const PUBLICATION_JOURNAL_PROTOCOL =
  "nextjshx.generated-output-transaction";
export const PUBLICATION_JOURNAL_VERSION = 1 as const;
export const PUBLICATION_JOURNAL_SCHEMA_ID =
  "https://nextjshx.dev/schemas/generated-output-transaction-v1.json";

export type PublicationPhase =
  "prepared" | "publishing" | "published" | "rolling-back" | "committed";

export type PublicationDisposition =
  "create" | "update" | "unchanged" | "remove";

export interface PublicationJournalChange {
  readonly path: string;
  readonly disposition: PublicationDisposition;
  readonly previousOwnershipSha256: string | null;
  readonly intendedOwnershipSha256: string | null;
  readonly previousSha256: string | null;
  readonly intendedSha256: string | null;
  readonly previousMode: number | null;
  readonly intendedMode: number | null;
}

export interface PublicationJournal {
  readonly protocol: typeof PUBLICATION_JOURNAL_PROTOCOL;
  readonly version: typeof PUBLICATION_JOURNAL_VERSION;
  readonly transactionId: string;
  readonly phase: PublicationPhase;
  readonly manifestPath: string;
  readonly allowedOutputRoots: readonly string[];
  readonly allowedOutputFiles: readonly string[];
  readonly previousManifestSha256: string | null;
  readonly previousManifestMode: number | null;
  readonly intendedManifestSha256: string;
  readonly intendedManifestMode: number;
  readonly changes: readonly PublicationJournalChange[];
}

export type PublicationJournalInput = Omit<
  PublicationJournal,
  "protocol" | "version"
>;

type JsonObject = Record<string, unknown>;

const JOURNAL_KEYS = [
  "allowedOutputFiles",
  "allowedOutputRoots",
  "changes",
  "intendedManifestMode",
  "intendedManifestSha256",
  "manifestPath",
  "phase",
  "previousManifestMode",
  "previousManifestSha256",
  "protocol",
  "transactionId",
  "version",
];
const CHANGE_KEYS = [
  "disposition",
  "intendedOwnershipSha256",
  "intendedMode",
  "intendedSha256",
  "path",
  "previousOwnershipSha256",
  "previousMode",
  "previousSha256",
];
const LEGACY_CHANGE_KEYS = CHANGE_KEYS.filter(
  (key) =>
    key !== "previousOwnershipSha256" &&
    key !== "intendedOwnershipSha256",
);
const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const PHASES = new Set<PublicationPhase>([
  "prepared",
  "publishing",
  "published",
  "rolling-back",
  "committed",
]);
const DISPOSITIONS = new Set<PublicationDisposition>([
  "create",
  "update",
  "unchanged",
  "remove",
]);

function journalFailure(
  subject: string,
  expected: string,
  actual: string,
): never {
  publicationFailure(
    "NXHX-TRANSACTION-JOURNAL-0002",
    "The publication journal is malformed or internally inconsistent.",
    subject,
    expected,
    actual,
    "Preserve .nextjshx transaction data for inspection; never infer recovery authority from malformed state.",
  );
}

function objectValue(value: unknown, subject: string): JsonObject {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    journalFailure(subject, "a closed JSON object", typeof value);
  }
  return value as JsonObject;
}

function assertKeys(
  value: JsonObject,
  allowed: readonly string[],
  subject: string,
): void {
  const allowedSet = new Set(allowed);
  const unknown = Object.keys(value)
    .filter((key) => !allowedSet.has(key))
    .sort();
  const missing = allowed.filter((key) => !Object.hasOwn(value, key)).sort();
  if (unknown.length > 0 || missing.length > 0) {
    journalFailure(
      subject,
      `exact keys ${allowed.join(", ")}`,
      [
        ...(unknown.length === 0 ? [] : [`unknown ${unknown.join(", ")}`]),
        ...(missing.length === 0 ? [] : [`missing ${missing.join(", ")}`]),
      ].join("; "),
    );
  }
}

function stringValue(value: unknown, subject: string): string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.trim() !== value
  ) {
    journalFailure(
      subject,
      "a non-empty string without surrounding whitespace",
      JSON.stringify(value),
    );
  }
  return value;
}

function digest(
  value: unknown,
  subject: string,
  nullable: boolean,
): string | null {
  if (nullable && value === null) {
    return null;
  }
  if (typeof value !== "string" || !SHA256.test(value)) {
    journalFailure(
      subject,
      "64 lowercase hexadecimal SHA-256 characters",
      JSON.stringify(value),
    );
  }
  return value;
}

function mode(
  value: unknown,
  subject: string,
  nullable: boolean,
): number | null {
  if (nullable && value === null) {
    return null;
  }
  if (
    !Number.isInteger(value) ||
    (value as number) < 0 ||
    (value as number) > 0o777
  ) {
    journalFailure(
      subject,
      "an integer Unix mode from 0 through 511",
      JSON.stringify(value),
    );
  }
  return value as number;
}

function changeValue(value: unknown, index: number): PublicationJournalChange {
  const subject = `$.changes[${index}]`;
  const change = objectValue(value, subject);
  const hasPreviousOwnership = Object.hasOwn(
    change,
    "previousOwnershipSha256",
  );
  const hasIntendedOwnership = Object.hasOwn(
    change,
    "intendedOwnershipSha256",
  );
  if (hasPreviousOwnership !== hasIntendedOwnership) {
    journalFailure(
      subject,
      "both ownership digests present or both absent in a legacy v1 entry",
      "one ownership digest is missing",
    );
  }
  assertKeys(
    change,
    hasPreviousOwnership ? CHANGE_KEYS : LEGACY_CHANGE_KEYS,
    subject,
  );
  const candidateDisposition = stringValue(
    change.disposition,
    `${subject}.disposition`,
  );
  if (!DISPOSITIONS.has(candidateDisposition as PublicationDisposition)) {
    journalFailure(
      `${subject}.disposition`,
      [...DISPOSITIONS].join(", "),
      candidateDisposition,
    );
  }
  const disposition = candidateDisposition as PublicationDisposition;
  const previousSha256 = digest(
    change.previousSha256,
    `${subject}.previousSha256`,
    true,
  );
  const intendedSha256 = digest(
    change.intendedSha256,
    `${subject}.intendedSha256`,
    true,
  );
  const parsed: PublicationJournalChange = Object.freeze({
    path: validateOutputPath(
      stringValue(change.path, `${subject}.path`),
      `${subject}.path`,
    ),
    disposition,
    previousOwnershipSha256: hasPreviousOwnership
      ? digest(
          change.previousOwnershipSha256,
          `${subject}.previousOwnershipSha256`,
          true,
        )
      : previousSha256,
    intendedOwnershipSha256: hasIntendedOwnership
      ? digest(
          change.intendedOwnershipSha256,
          `${subject}.intendedOwnershipSha256`,
          true,
        )
      : intendedSha256,
    previousSha256,
    intendedSha256,
    previousMode: mode(change.previousMode, `${subject}.previousMode`, true),
    intendedMode: mode(change.intendedMode, `${subject}.intendedMode`, true),
  });
  const previousPair =
    (parsed.previousSha256 === null) === (parsed.previousMode === null);
  const intendedPair =
    (parsed.intendedSha256 === null) === (parsed.intendedMode === null);
  const validDisposition =
    previousPair &&
    intendedPair &&
    (parsed.previousOwnershipSha256 !== null ||
      parsed.intendedOwnershipSha256 !== null) &&
    ((disposition === "create" &&
      parsed.previousSha256 === null &&
      parsed.intendedSha256 !== null) ||
      (disposition === "update" &&
        parsed.previousSha256 !== null &&
        parsed.intendedSha256 !== null &&
        parsed.previousSha256 !== parsed.intendedSha256) ||
      (disposition === "unchanged" &&
        parsed.previousSha256 !== null &&
        parsed.previousSha256 === parsed.intendedSha256 &&
        parsed.previousMode === parsed.intendedMode) ||
      (disposition === "remove" &&
        parsed.previousSha256 !== null &&
        parsed.intendedSha256 === null));
  if (!validDisposition) {
    journalFailure(
      subject,
      "digest and mode nullability consistent with its disposition",
      JSON.stringify(parsed),
    );
  }
  return parsed;
}

function rootContains(root: string, candidate: string): boolean {
  return root === "" || candidate === root || candidate.startsWith(`${root}/`);
}

export function parsePublicationJournal(decoded: unknown): PublicationJournal {
  const journal = objectValue(decoded, "$");
  assertKeys(journal, JOURNAL_KEYS, "$");
  if (journal.protocol !== PUBLICATION_JOURNAL_PROTOCOL) {
    journalFailure(
      "$.protocol",
      PUBLICATION_JOURNAL_PROTOCOL,
      JSON.stringify(journal.protocol),
    );
  }
  if (journal.version !== PUBLICATION_JOURNAL_VERSION) {
    journalFailure(
      "$.version",
      String(PUBLICATION_JOURNAL_VERSION),
      JSON.stringify(journal.version),
    );
  }
  const transactionId = stringValue(journal.transactionId, "$.transactionId");
  if (!UUID_V4.test(transactionId)) {
    journalFailure("$.transactionId", "a lowercase UUID v4", transactionId);
  }
  const candidatePhase = stringValue(journal.phase, "$.phase");
  if (!PHASES.has(candidatePhase as PublicationPhase)) {
    journalFailure("$.phase", [...PHASES].join(", "), candidatePhase);
  }
  const manifestPath = validatePortableProjectPath(
    stringValue(journal.manifestPath, "$.manifestPath"),
    "$.manifestPath",
    false,
  );
  if (
    !manifestPath.startsWith(".nextjshx/") ||
    !manifestPath.endsWith(".json")
  ) {
    journalFailure(
      "$.manifestPath",
      "a JSON file under .nextjshx/",
      manifestPath,
    );
  }
  if (
    manifestPath === ".nextjshx/transaction.json" ||
    manifestPath.startsWith(".nextjshx/transactions/") ||
    manifestPath.startsWith(".nextjshx/plans/")
  ) {
    journalFailure(
      "$.manifestPath",
      "a dedicated manifest outside transaction and adapter-plan workspaces",
      manifestPath,
    );
  }
  if (
    !Array.isArray(journal.allowedOutputRoots) ||
    journal.allowedOutputRoots.length === 0
  ) {
    journalFailure(
      "$.allowedOutputRoots",
      "a non-empty array",
      typeof journal.allowedOutputRoots,
    );
  }
  const roots = journal.allowedOutputRoots.map((value, index) => {
    if (value === "") {
      return "";
    }
    return validatePortableProjectPath(
      stringValue(value, `$.allowedOutputRoots[${index}]`),
      `$.allowedOutputRoots[${index}]`,
      false,
    );
  });
  const rootIdentities = new Set<string>();
  let previousRoot: string | null = null;
  for (const root of roots) {
    const folded = root.toLowerCase();
    if (
      rootIdentities.has(folded) ||
      (previousRoot !== null &&
        Buffer.from(previousRoot).compare(Buffer.from(root)) >= 0)
    ) {
      journalFailure(
        "$.allowedOutputRoots",
        "case-distinct paths in canonical bytewise order",
        root || ".",
      );
    }
    rootIdentities.add(folded);
    previousRoot = root;
  }
  if (!Array.isArray(journal.allowedOutputFiles)) {
    journalFailure(
      "$.allowedOutputFiles",
      "an array",
      typeof journal.allowedOutputFiles,
    );
  }
  const files = journal.allowedOutputFiles.map((value, index) =>
    validateOutputPath(
      stringValue(value, `$.allowedOutputFiles[${index}]`),
      `$.allowedOutputFiles[${index}]`,
    ),
  );
  const fileIdentities = new Set<string>();
  let previousFile: string | null = null;
  for (const file of files) {
    const folded = file.toLowerCase();
    if (
      fileIdentities.has(folded) ||
      (previousFile !== null &&
        Buffer.from(previousFile).compare(Buffer.from(file)) >= 0)
    ) {
      journalFailure(
        "$.allowedOutputFiles",
        "case-distinct paths in canonical bytewise order",
        file,
      );
    }
    if (
      roots.some((root) => rootContains(root.toLowerCase(), file.toLowerCase()))
    ) {
      journalFailure(
        "$.allowedOutputFiles",
        "non-redundant exact files outside every allowed output root",
        file,
      );
    }
    fileIdentities.add(folded);
    previousFile = file;
  }
  if (!Array.isArray(journal.changes)) {
    journalFailure("$.changes", "an array", typeof journal.changes);
  }
  const changes = journal.changes.map(changeValue);
  let previousPath: string | null = null;
  const identities = new Set<string>();
  for (const change of changes) {
    if (
      !roots.some((root) => rootContains(root, change.path)) &&
      !files.includes(change.path)
    ) {
      journalFailure(
        change.path,
        `a path under ${roots.join(", ")} or one of ${files.join(", ") || "no exact files"}`,
        change.path,
      );
    }
    const folded = change.path.toLowerCase();
    if (
      identities.has(folded) ||
      (previousPath !== null &&
        Buffer.from(previousPath).compare(Buffer.from(change.path)) >= 0)
    ) {
      journalFailure(
        "$.changes",
        "unique canonical bytewise path order",
        change.path,
      );
    }
    identities.add(folded);
    previousPath = change.path;
  }
  const previousManifestSha256 = digest(
    journal.previousManifestSha256,
    "$.previousManifestSha256",
    true,
  );
  const previousManifestMode = mode(
    journal.previousManifestMode,
    "$.previousManifestMode",
    true,
  );
  if ((previousManifestSha256 === null) !== (previousManifestMode === null)) {
    journalFailure(
      "$.previousManifestSha256/$.previousManifestMode",
      "both null or both populated",
      `${previousManifestSha256}/${previousManifestMode}`,
    );
  }
  return Object.freeze({
    protocol: PUBLICATION_JOURNAL_PROTOCOL,
    version: PUBLICATION_JOURNAL_VERSION,
    transactionId,
    phase: candidatePhase as PublicationPhase,
    manifestPath,
    allowedOutputRoots: Object.freeze(roots),
    allowedOutputFiles: Object.freeze(files),
    previousManifestSha256,
    previousManifestMode,
    intendedManifestSha256: digest(
      journal.intendedManifestSha256,
      "$.intendedManifestSha256",
      false,
    ) as string,
    intendedManifestMode: mode(
      journal.intendedManifestMode,
      "$.intendedManifestMode",
      false,
    ) as number,
    changes: Object.freeze(changes),
  });
}

export function createPublicationJournal(
  input: PublicationJournalInput,
): PublicationJournal {
  return parsePublicationJournal({
    protocol: PUBLICATION_JOURNAL_PROTOCOL,
    version: PUBLICATION_JOURNAL_VERSION,
    ...input,
  });
}

export function withPublicationPhase(
  journal: PublicationJournal,
  phase: PublicationPhase,
): PublicationJournal {
  return createPublicationJournal({ ...journal, phase });
}

export function encodePublicationJournal(journal: PublicationJournal): string {
  const canonical = createPublicationJournal(journal);
  return `${JSON.stringify(canonical, null, 2)}\n`;
}
