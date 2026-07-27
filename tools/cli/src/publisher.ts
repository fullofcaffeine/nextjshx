import { createHash, randomUUID } from "node:crypto";
import {
  chmodSync,
  closeSync,
  constants,
  copyFileSync,
  existsSync,
  fsyncSync,
  lstatSync,
  linkSync,
  mkdirSync,
  openSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  type Stats,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { hostname } from "node:os";
import path from "node:path";

import {
  encodeGeneratedOutputManifest,
  parseGeneratedOutputManifest,
  type GeneratedOutputManifest,
} from "./manifest.js";
import {
  formatGeneratedOutput,
  type GeneratedOutputFormatter,
} from "./output-formatter.js";
import type {
  OwnershipTransferRequest,
  OutputDisposition,
  OwnershipPreflightOptions,
  OwnershipPreflightResult,
  PlannedGeneratedOutput,
} from "./ownership-preflight.js";
import {
  preflightGeneratedOutputs,
  preflightOwnershipTransfer,
} from "./ownership-preflight.js";
import { OwnershipDiagnosticError } from "./ownership-diagnostic.js";
import { validateOutputPath } from "./ownership-path.js";
import {
  createPublicationJournal,
  encodePublicationJournal,
  parsePublicationJournal,
  type PublicationJournal,
  type PublicationJournalChange,
  withPublicationPhase,
} from "./publication-journal.js";
import {
  PublicationDiagnosticError,
  publicationFailure,
} from "./publication-diagnostic.js";

const CONTROL_DIRECTORY = ".nextjshx";
const LOCK_PATH = ".nextjshx/publish.lock";
const JOURNAL_PATH = ".nextjshx/transaction.json";
const JOURNAL_TEMP_PATH = ".nextjshx/transaction.json.tmp";
const TRANSACTION_ROOT = ".nextjshx/transactions";
const GENERATED_MODE = 0o644;
const CONTROL_MODE = 0o600;
const CONTROL_DIRECTORY_MODE = 0o700;
const OUTPUT_DIRECTORY_MODE = 0o755;
const LOCK_PROTOCOL = "nextjshx.generated-output-lock";
const LOCK_VERSION = 1;
const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const ACTIVE_LOCKS = new Set<string>();

export type PublicationFaultPoint =
  | { readonly kind: "journal-prepared" }
  | { readonly kind: "phase-publishing" }
  | { readonly kind: "output-published"; readonly path: string }
  | { readonly kind: "manifest-published" }
  | { readonly kind: "phase-published" }
  | { readonly kind: "phase-rolling-back" }
  | { readonly kind: "output-restored"; readonly path: string }
  | { readonly kind: "manifest-restored" }
  | { readonly kind: "phase-committed" };

export class PublicationCrashSimulationError extends Error {
  readonly point: PublicationFaultPoint;

  constructor(point: PublicationFaultPoint) {
    super(`simulated publication crash at ${point.kind}`);
    this.name = "PublicationCrashSimulationError";
    this.point = point;
  }
}

export interface PublishGeneratedOutputsOptions extends OwnershipPreflightOptions {
  readonly formatter?: GeneratedOutputFormatter;
  readonly postValidate?: () => void | Promise<void>;
  /** @internal Deterministic crash injection used by the recovery test corpus. */
  readonly faultInjector?: (point: PublicationFaultPoint) => void;
  /** Exact single-path transfer; unrelated ownership must remain unchanged. */
  readonly transfer?: OwnershipTransferRequest;
}

export interface RecoverGeneratedOutputsOptions {
  readonly projectRoot: string;
  readonly postValidate?: () => void | Promise<void>;
  /** @internal Deterministic crash injection used by the recovery test corpus. */
  readonly faultInjector?: (point: PublicationFaultPoint) => void;
}

export interface PublicationResult {
  readonly transactionId: string | null;
  readonly action: "published" | "unchanged";
  readonly created: readonly string[];
  readonly updated: readonly string[];
  readonly unchanged: readonly string[];
  readonly removed: readonly string[];
}

export interface RecoveryResult {
  readonly transactionId: string | null;
  readonly action: "none" | "rolled-back" | "committed";
}

interface LockRecord {
  readonly protocol: typeof LOCK_PROTOCOL;
  readonly version: typeof LOCK_VERSION;
  readonly nonce: string;
  readonly transactionId: string;
  readonly pid: number;
  readonly hostname: string;
}

interface PublicationLock {
  readonly record: LockRecord;
  release(): void;
}

interface FileState {
  readonly sha256: string;
  readonly mode: number;
}

class PostValidationFailure extends Error {
  constructor(readonly validationError: unknown) {
    super("post-publication validation failed");
    this.name = "PostValidationFailure";
  }
}

function errorCode(error: unknown): string | undefined {
  return typeof error === "object" && error !== null && "code" in error
    ? (error as { readonly code?: string }).code
    : undefined;
}

function lstatIfPresent(candidate: string): Stats | null {
  try {
    return lstatSync(candidate);
  } catch (error) {
    if (errorCode(error) === "ENOENT") {
      return null;
    }
    publicationFailure(
      "NXHX-TRANSACTION-FILESYSTEM-0009",
      "Cannot inspect transactional filesystem state.",
      candidate,
      "readable filesystem metadata",
      error instanceof Error ? error.message : "unknown filesystem error",
      "Fix filesystem permissions or I/O errors before retrying publication or recovery.",
    );
  }
}

function canonicalProjectRoot(candidate: string): string {
  const absolute = path.resolve(candidate);
  let root: string;
  try {
    root = realpathSync.native(absolute);
  } catch (error) {
    publicationFailure(
      "NXHX-TRANSACTION-FILESYSTEM-0009",
      "The publication project root cannot be canonicalized.",
      absolute,
      "an existing real project directory",
      error instanceof Error ? error.message : "missing or unreadable",
      "Run publication against the discovered application package root.",
    );
  }
  if (!statSync(root).isDirectory()) {
    publicationFailure(
      "NXHX-TRANSACTION-FILESYSTEM-0009",
      "The publication project root is not a directory.",
      root,
      "an existing real project directory",
      "non-directory filesystem entry",
      "Run publication against the discovered application package root.",
    );
  }
  return root;
}

function absolutePath(root: string, relative: string): string {
  const absolute = path.resolve(root, ...relative.split("/"));
  const back = path.relative(root, absolute);
  if (
    back === ".." ||
    back.startsWith(`..${path.sep}`) ||
    path.isAbsolute(back)
  ) {
    publicationFailure(
      "NXHX-TRANSACTION-FILESYSTEM-0009",
      "A transactional path escapes the canonical project root.",
      relative,
      `a path contained by ${root}`,
      absolute,
      "Preserve the journal and inspect the path before attempting recovery.",
    );
  }
  return absolute;
}

function relativePath(root: string, absolute: string): string {
  const relative = path.relative(root, absolute);
  return relative === "" ? "" : relative.split(path.sep).join("/");
}

function ensureDirectory(
  root: string,
  relative: string,
  mode = CONTROL_DIRECTORY_MODE,
): string {
  let current = root;
  for (const segment of relative.split("/")) {
    if (segment.length === 0) {
      continue;
    }
    current = path.join(current, segment);
    let stats = lstatIfPresent(current);
    if (stats === null) {
      try {
        mkdirSync(current, { mode });
        chmodSync(current, mode);
        fsyncDirectory(path.dirname(current));
      } catch (error) {
        if (errorCode(error) !== "EEXIST") {
          publicationFailure(
            "NXHX-TRANSACTION-FILESYSTEM-0009",
            "Cannot create a transactional directory.",
            current,
            "a real private directory",
            error instanceof Error ? error.message : "unknown filesystem error",
            "Fix filesystem permissions and retry before any live output is published.",
          );
        }
      }
      stats = lstatIfPresent(current);
    }
    if (stats === null || stats.isSymbolicLink() || !stats.isDirectory()) {
      publicationFailure(
        "NXHX-TRANSACTION-FILESYSTEM-0009",
        "A transactional directory component is unsafe.",
        current,
        "a real directory with no symbolic-link traversal",
        stats === null
          ? "missing after creation"
          : stats.isSymbolicLink()
            ? "symbolic link"
            : "non-directory filesystem entry",
        "Move the blocking entry and retry; publication never follows control or output symlinks.",
      );
    }
  }
  return current;
}

function assertRealParents(root: string, relative: string): string {
  const segments = relative.split("/");
  const parent = segments.slice(0, -1).join("/");
  return ensureDirectory(
    root,
    parent,
    relative.startsWith(`${CONTROL_DIRECTORY}/`)
      ? CONTROL_DIRECTORY_MODE
      : OUTPUT_DIRECTORY_MODE,
  );
}

function fsyncDirectory(directory: string): void {
  let descriptor: number | null = null;
  try {
    descriptor = openSync(directory, constants.O_RDONLY);
    fsyncSync(descriptor);
  } catch (error) {
    if (!["EINVAL", "ENOTSUP", "EISDIR"].includes(errorCode(error) ?? "")) {
      publicationFailure(
        "NXHX-TRANSACTION-FILESYSTEM-0009",
        "Cannot durably synchronize a publication directory.",
        directory,
        "a successful directory fsync",
        error instanceof Error ? error.message : "unknown filesystem error",
        "Use a local filesystem that supports durable atomic publication.",
      );
    }
  } finally {
    if (descriptor !== null) {
      closeSync(descriptor);
    }
  }
}

function sha256(content: string | Uint8Array): string {
  return createHash("sha256").update(content).digest("hex");
}

function inspectFile(root: string, relative: string): FileState | null {
  const absolute = absolutePath(root, relative);
  const segments = relative.split("/");
  let current = root;
  for (const segment of segments.slice(0, -1)) {
    current = path.join(current, segment);
    const stats = lstatIfPresent(current);
    if (stats === null) {
      return null;
    }
    if (stats.isSymbolicLink() || !stats.isDirectory()) {
      publicationFailure(
        "NXHX-TRANSACTION-STATE-0003",
        "A live publication path crosses an unsafe parent.",
        relative,
        "real directory parents",
        stats.isSymbolicLink()
          ? `symbolic link at ${current}`
          : `non-directory at ${current}`,
        "Preserve the journal and remove the ambiguity before explicit recovery.",
      );
    }
  }
  const stats = lstatIfPresent(absolute);
  if (stats === null) {
    return null;
  }
  if (stats.isSymbolicLink() || !stats.isFile()) {
    publicationFailure(
      "NXHX-TRANSACTION-STATE-0003",
      "A live publication target is not a regular file.",
      relative,
      "a missing target or regular file with an expected digest",
      stats.isSymbolicLink() ? "symbolic link" : "non-regular filesystem entry",
      "Preserve the target and journal for inspection; recovery never follows or replaces ambiguous entries.",
    );
  }
  return Object.freeze({
    sha256: sha256(readFileSync(absolute)),
    mode: stats.mode & 0o777,
  });
}

function describeState(state: FileState | null): string {
  return state === null
    ? "missing"
    : `${state.sha256} mode ${state.mode.toString(8)}`;
}

function sameState(
  state: FileState | null,
  expectedSha256: string | null,
  expectedMode: number | null,
): boolean {
  return expectedSha256 === null
    ? state === null && expectedMode === null
    : state !== null &&
        state.sha256 === expectedSha256 &&
        state.mode === expectedMode;
}

function expectedState(sha: string | null, mode: number | null): string {
  return sha === null
    ? "missing"
    : `${sha} mode ${(mode as number).toString(8)}`;
}

function assertState(
  root: string,
  relative: string,
  expectedSha: string | null,
  expectedMode: number | null,
  context: string,
): void {
  const actual = inspectFile(root, relative);
  if (!sameState(actual, expectedSha, expectedMode)) {
    publicationFailure(
      "NXHX-TRANSACTION-STATE-0003",
      `Live bytes do not match the ${context} transaction state.`,
      relative,
      expectedState(expectedSha, expectedMode),
      describeState(actual),
      "Preserve the unexpected file and .nextjshx journal; review ownership before explicit repair.",
    );
  }
}

function writeExactFile(
  root: string,
  relative: string,
  content: string | Uint8Array,
  mode: number,
): void {
  const parent = assertRealParents(root, relative);
  const absolute = absolutePath(root, relative);
  let descriptor: number | null = null;
  try {
    descriptor = openSync(
      absolute,
      constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL,
      mode,
    );
    writeFileSync(descriptor, content);
    fsyncSync(descriptor);
    chmodSync(absolute, mode);
  } catch (error) {
    publicationFailure(
      "NXHX-TRANSACTION-STAGING-0004",
      "Cannot write an exact transaction artifact.",
      relative,
      "a new durable private staging or backup file",
      error instanceof Error ? error.message : "unknown filesystem error",
      "Preserve any existing control entry and inspect it before retrying.",
    );
  } finally {
    if (descriptor !== null) {
      closeSync(descriptor);
    }
  }
  fsyncDirectory(parent);
}

function replaceFromArtifact(
  root: string,
  artifactRelative: string,
  targetRelative: string,
  temporaryRelative: string,
  expectedSha: string,
  artifactMode: number,
  targetMode: number,
): void {
  assertState(
    root,
    artifactRelative,
    expectedSha,
    artifactMode,
    "transaction artifact",
  );
  const targetParent = assertRealParents(root, targetRelative);
  assertRealParents(root, temporaryRelative);
  assertState(root, temporaryRelative, null, null, "unused temporary-path");
  const artifact = absolutePath(root, artifactRelative);
  const temporary = absolutePath(root, temporaryRelative);
  const target = absolutePath(root, targetRelative);
  try {
    // Hard-linking complete staged bytes avoids a partially written live-directory temp file.
    // The subsequent same-directory rename is the only operation that replaces the target.
    linkSync(artifact, temporary);
    chmodSync(temporary, targetMode);
    fsyncDirectory(targetParent);
    renameSync(temporary, target);
    fsyncDirectory(targetParent);
  } catch (error) {
    publicationFailure(
      "NXHX-TRANSACTION-FILESYSTEM-0009",
      "Atomic publication from the staged artifact failed.",
      targetRelative,
      "a hard link and same-directory atomic rename on one filesystem",
      error instanceof Error ? error.message : "unknown filesystem error",
      "Keep control data and outputs on the same local filesystem, then run recovery.",
    );
  }
}

function replaceFromBackup(
  root: string,
  backupRelative: string,
  targetRelative: string,
  temporaryRelative: string,
  expectedSha: string,
  targetMode: number,
): void {
  assertState(
    root,
    backupRelative,
    expectedSha,
    CONTROL_MODE,
    "rollback backup",
  );
  const targetParent = assertRealParents(root, targetRelative);
  assertRealParents(root, temporaryRelative);
  assertState(root, temporaryRelative, null, null, "unused temporary-path");
  const backup = absolutePath(root, backupRelative);
  const temporary = absolutePath(root, temporaryRelative);
  const target = absolutePath(root, targetRelative);
  let descriptor: number | null = null;
  try {
    copyFileSync(backup, temporary, constants.COPYFILE_EXCL);
    chmodSync(temporary, targetMode);
    descriptor = openSync(temporary, constants.O_RDONLY);
    fsyncSync(descriptor);
    closeSync(descriptor);
    descriptor = null;
    fsyncDirectory(targetParent);
    renameSync(temporary, target);
    fsyncDirectory(targetParent);
  } catch (error) {
    publicationFailure(
      "NXHX-TRANSACTION-FILESYSTEM-0009",
      "Atomic restoration from a rollback backup failed.",
      targetRelative,
      "a durable private copy and same-directory atomic rename",
      error instanceof Error ? error.message : "unknown filesystem error",
      "Preserve the journal and transaction backup, then retry recovery after fixing the filesystem.",
    );
  } finally {
    if (descriptor !== null) {
      closeSync(descriptor);
    }
  }
}

function unlinkExact(
  root: string,
  relative: string,
  expectedSha: string,
  expectedMode: number,
): void {
  assertState(root, relative, expectedSha, expectedMode, "removable");
  const absolute = absolutePath(root, relative);
  const parent = path.dirname(absolute);
  try {
    unlinkSync(absolute);
  } catch (error) {
    publicationFailure(
      "NXHX-TRANSACTION-FILESYSTEM-0009",
      "Cannot remove a verified stale generated output.",
      relative,
      "an atomic unlink of the exact manifest-owned bytes",
      error instanceof Error ? error.message : "unknown filesystem error",
      "Preserve the journal and fix filesystem permissions before recovery.",
    );
  }
  fsyncDirectory(parent);
}

function atomicControlWrite(
  root: string,
  relative: string,
  content: string,
): void {
  removeJournalTemporary(root);
  writeExactFile(root, JOURNAL_TEMP_PATH, content, CONTROL_MODE);
  const temporary = absolutePath(root, JOURNAL_TEMP_PATH);
  const target = absolutePath(root, relative);
  try {
    renameSync(temporary, target);
  } catch (error) {
    publicationFailure(
      "NXHX-TRANSACTION-FILESYSTEM-0009",
      "Cannot atomically replace transaction control data.",
      relative,
      "a durable same-directory atomic rename",
      error instanceof Error ? error.message : "unknown filesystem error",
      "Preserve the previous journal and retry recovery after fixing the filesystem.",
    );
  }
  fsyncDirectory(path.dirname(target));
}

function removeJournalTemporary(root: string): void {
  const temporary = inspectFile(root, JOURNAL_TEMP_PATH);
  if (temporary !== null) {
    unlinkSync(absolutePath(root, JOURNAL_TEMP_PATH));
    fsyncDirectory(absolutePath(root, CONTROL_DIRECTORY));
  }
}

function transactionDirectory(id: string): string {
  return `${TRANSACTION_ROOT}/${id}`;
}

function stagedOutput(id: string, outputPath: string): string {
  return `${transactionDirectory(id)}/stage/outputs/${outputPath}`;
}

function backedUpOutput(id: string, outputPath: string): string {
  return `${transactionDirectory(id)}/backup/outputs/${outputPath}`;
}

function stagedManifest(id: string): string {
  return `${transactionDirectory(id)}/stage/manifest.json`;
}

function backedUpManifest(id: string): string {
  return `${transactionDirectory(id)}/backup/manifest.json`;
}

function outputTemporary(id: string, outputPath: string): string {
  const directory = outputPath.split("/").slice(0, -1).join("/");
  const identity = sha256(outputPath).slice(0, 16);
  return `${directory}/.nextjshx-${id}-${identity}.tmp`;
}

function manifestTemporary(id: string, manifestPath: string): string {
  const directory = manifestPath.split("/").slice(0, -1).join("/");
  return `${directory}/.nextjshx-manifest-${id}.tmp`;
}

function parseLock(decoded: unknown): LockRecord {
  if (
    typeof decoded !== "object" ||
    decoded === null ||
    Array.isArray(decoded)
  ) {
    publicationFailure(
      "NXHX-TRANSACTION-LOCKED-0001",
      "The publication lock is malformed.",
      LOCK_PATH,
      "a closed versioned lock record",
      typeof decoded,
      "Preserve the lock and journal for inspection; do not guess whether a publisher is active.",
    );
  }
  const value = decoded as Record<string, unknown>;
  const keys = [
    "hostname",
    "nonce",
    "pid",
    "protocol",
    "transactionId",
    "version",
  ];
  if (
    Object.keys(value).sort().join("\0") !== [...keys].sort().join("\0") ||
    value.protocol !== LOCK_PROTOCOL ||
    value.version !== LOCK_VERSION ||
    typeof value.nonce !== "string" ||
    !UUID_V4.test(value.nonce) ||
    typeof value.transactionId !== "string" ||
    !UUID_V4.test(value.transactionId) ||
    !Number.isSafeInteger(value.pid) ||
    (value.pid as number) <= 0 ||
    typeof value.hostname !== "string" ||
    value.hostname.length === 0 ||
    value.hostname.length > 255 ||
    /[\u0000-\u001f\u007f]/.test(value.hostname)
  ) {
    publicationFailure(
      "NXHX-TRANSACTION-LOCKED-0001",
      "The publication lock is malformed.",
      LOCK_PATH,
      "protocol, version, UUID identities, positive PID, and hostname",
      JSON.stringify(value),
      "Preserve the lock and journal for inspection; do not guess whether a publisher is active.",
    );
  }
  return Object.freeze({
    protocol: LOCK_PROTOCOL,
    version: LOCK_VERSION,
    nonce: value.nonce,
    transactionId: value.transactionId,
    pid: value.pid,
    hostname: value.hostname,
  } as LockRecord);
}

function readLock(root: string): LockRecord | null {
  const state = inspectFile(root, LOCK_PATH);
  if (state === null) {
    return null;
  }
  try {
    return parseLock(
      JSON.parse(readFileSync(absolutePath(root, LOCK_PATH), "utf8")),
    );
  } catch (error) {
    if (error instanceof PublicationDiagnosticError) {
      throw error;
    }
    publicationFailure(
      "NXHX-TRANSACTION-LOCKED-0001",
      "The publication lock is not valid JSON.",
      LOCK_PATH,
      "a closed versioned lock record",
      "malformed JSON",
      "Preserve the lock and journal for inspection; do not guess whether a publisher is active.",
    );
  }
}

function processIsAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return errorCode(error) !== "ESRCH";
  }
}

function clearProvablyStaleLock(root: string): void {
  const lock = readLock(root);
  if (lock === null) {
    return;
  }
  if (
    ACTIVE_LOCKS.has(root) ||
    lock.hostname !== hostname() ||
    processIsAlive(lock.pid)
  ) {
    publicationFailure(
      "NXHX-TRANSACTION-LOCKED-0001",
      "Another generated-output publisher may still be active.",
      LOCK_PATH,
      "no active local or unprovable foreign-host lock",
      `pid ${lock.pid} on ${lock.hostname}`,
      "Wait for the active publisher; only recovery may clear a provably dead same-host PID.",
    );
  }
  const current = readLock(root);
  if (current?.nonce !== lock.nonce) {
    publicationFailure(
      "NXHX-TRANSACTION-LOCKED-0001",
      "The publication lock changed during stale-lock inspection.",
      LOCK_PATH,
      lock.nonce,
      current?.nonce ?? "missing",
      "Retry recovery; never remove a lock whose identity changed.",
    );
  }
  unlinkSync(absolutePath(root, LOCK_PATH));
  fsyncDirectory(absolutePath(root, CONTROL_DIRECTORY));
}

function acquireLock(root: string, transactionId: string): PublicationLock {
  ensureDirectory(root, CONTROL_DIRECTORY);
  if (ACTIVE_LOCKS.has(root)) {
    publicationFailure(
      "NXHX-TRANSACTION-LOCKED-0001",
      "This process already owns the project publication lock.",
      LOCK_PATH,
      "one serialized publisher",
      "a second in-process publisher",
      "Wait for the first transaction to finish before publishing again.",
    );
  }
  const record: LockRecord = Object.freeze({
    protocol: LOCK_PROTOCOL,
    version: LOCK_VERSION,
    nonce: randomUUID(),
    transactionId,
    pid: process.pid,
    hostname: hostname(),
  });
  try {
    writeExactFile(
      root,
      LOCK_PATH,
      `${JSON.stringify(record, null, 2)}\n`,
      CONTROL_MODE,
    );
  } catch (error) {
    if (
      error instanceof PublicationDiagnosticError &&
      existsSync(absolutePath(root, LOCK_PATH))
    ) {
      const current = readLock(root);
      publicationFailure(
        "NXHX-TRANSACTION-LOCKED-0001",
        "Another generated-output publisher owns the project lock.",
        LOCK_PATH,
        "no existing publication lock",
        current === null
          ? "an unreadable concurrent lock"
          : `transaction ${current.transactionId}, pid ${current.pid} on ${current.hostname}`,
        "Wait for the active publisher or run recovery if its same-host PID is provably dead.",
      );
    }
    throw error;
  }
  ACTIVE_LOCKS.add(root);
  let released = false;
  return Object.freeze({
    record,
    release(): void {
      if (released) {
        return;
      }
      const current = readLock(root);
      if (current?.nonce !== record.nonce) {
        publicationFailure(
          "NXHX-TRANSACTION-LOCKED-0001",
          "The publication lock identity changed before release.",
          LOCK_PATH,
          record.nonce,
          current?.nonce ?? "missing",
          "Preserve the lock and journal; another process may have interfered.",
        );
      }
      unlinkSync(absolutePath(root, LOCK_PATH));
      fsyncDirectory(absolutePath(root, CONTROL_DIRECTORY));
      ACTIVE_LOCKS.delete(root);
      released = true;
    },
  });
}

function readJournal(root: string): PublicationJournal | null {
  const state = inspectFile(root, JOURNAL_PATH);
  if (state === null) {
    return null;
  }
  let decoded: unknown;
  try {
    decoded = JSON.parse(
      readFileSync(absolutePath(root, JOURNAL_PATH), "utf8"),
    );
  } catch {
    publicationFailure(
      "NXHX-TRANSACTION-JOURNAL-0002",
      "The active publication journal is not valid JSON.",
      JOURNAL_PATH,
      "strict schema-v1 transaction JSON",
      "malformed JSON",
      "Preserve control data for inspection; malformed state grants no recovery authority.",
    );
  }
  return parsePublicationJournal(decoded);
}

function writeJournal(root: string, journal: PublicationJournal): void {
  atomicControlWrite(root, JOURNAL_PATH, encodePublicationJournal(journal));
}

function readManifestArtifact(
  root: string,
  relative: string,
  expectedSha: string,
  expectedMode: number,
): GeneratedOutputManifest {
  assertState(
    root,
    relative,
    expectedSha,
    expectedMode,
    "transaction artifact",
  );
  try {
    return parseGeneratedOutputManifest(
      JSON.parse(readFileSync(absolutePath(root, relative), "utf8")),
    );
  } catch (error) {
    if (error instanceof PublicationDiagnosticError) {
      throw error;
    }
    publicationFailure(
      "NXHX-TRANSACTION-JOURNAL-0002",
      "A transaction manifest artifact is not valid ownership JSON.",
      relative,
      "a valid generated-output manifest",
      error instanceof Error ? error.message : "malformed JSON",
      "Preserve the transaction directory; recovery cannot infer file ownership.",
    );
  }
}

function expectedDisposition(
  previous: string | undefined,
  intended: string | undefined,
): OutputDisposition {
  if (previous === undefined) {
    return "create";
  }
  if (intended === undefined) {
    return "remove";
  }
  return previous === intended ? "unchanged" : "update";
}

function verifyJournalArtifacts(
  root: string,
  journal: PublicationJournal,
): void {
  const intendedManifest = readManifestArtifact(
    root,
    stagedManifest(journal.transactionId),
    journal.intendedManifestSha256,
    journal.intendedManifestMode,
  );
  const previousManifest =
    journal.previousManifestSha256 === null
      ? null
      : readManifestArtifact(
          root,
          backedUpManifest(journal.transactionId),
          journal.previousManifestSha256,
          CONTROL_MODE,
        );
  const previousByPath = new Map(
    previousManifest?.outputs.map((output) => [output.path, output.sha256]) ??
      [],
  );
  const intendedByPath = new Map(
    intendedManifest.outputs.map((output) => [output.path, output.sha256]),
  );
  const allPaths = [
    ...new Set([...previousByPath.keys(), ...intendedByPath.keys()]),
  ].sort((left, right) => Buffer.from(left).compare(Buffer.from(right)));
  if (allPaths.length !== journal.changes.length) {
    publicationFailure(
      "NXHX-TRANSACTION-JOURNAL-0002",
      "Journal changes do not cover the complete manifest transition.",
      JOURNAL_PATH,
      `${allPaths.length} manifest-derived changes`,
      `${journal.changes.length} journal changes`,
      "Preserve the transaction; never recover from an incomplete change list.",
    );
  }
  for (let index = 0; index < allPaths.length; index += 1) {
    const outputPath = allPaths[index] as string;
    const change = journal.changes[index] as PublicationJournalChange;
    const previous = previousByPath.get(outputPath);
    const intended = intendedByPath.get(outputPath);
    if (
      change.path !== outputPath ||
      change.previousOwnershipSha256 !== (previous ?? null) ||
      change.intendedOwnershipSha256 !== (intended ?? null) ||
      change.disposition !==
        expectedDisposition(
          change.previousSha256 ?? undefined,
          change.intendedSha256 ?? undefined,
        )
    ) {
      publicationFailure(
        "NXHX-TRANSACTION-JOURNAL-0002",
        "A journal change disagrees with its exact manifest artifacts.",
        change.path,
        `${outputPath}: ownership ${previous ?? "missing"} -> ${intended ?? "missing"}`,
        `${change.disposition}; ownership ${change.previousOwnershipSha256 ?? "missing"} -> ${change.intendedOwnershipSha256 ?? "missing"}; file ${change.previousSha256 ?? "missing"} -> ${change.intendedSha256 ?? "missing"}`,
        "Preserve the transaction; do not recover from inconsistent ownership evidence.",
      );
    }
    if (intended !== undefined && change.disposition !== "unchanged") {
      assertState(
        root,
        stagedOutput(journal.transactionId, outputPath),
        change.intendedSha256,
        change.intendedMode as number,
        "staged output",
      );
    }
    if (change.disposition === "update" || change.disposition === "remove") {
      assertState(
        root,
        backedUpOutput(journal.transactionId, outputPath),
        change.previousSha256 as string,
        CONTROL_MODE,
        "backup output",
      );
    }
  }
}

function changePreviousState(
  root: string,
  change: PublicationJournalChange,
): void {
  assertState(
    root,
    change.path,
    change.previousSha256,
    change.previousMode,
    "previous",
  );
}

function changeIntendedState(
  root: string,
  change: PublicationJournalChange,
): void {
  assertState(
    root,
    change.path,
    change.intendedSha256,
    change.intendedMode,
    "intended",
  );
}

function stateMatchesEither(
  root: string,
  change: PublicationJournalChange,
): boolean {
  const state = inspectFile(root, change.path);
  return (
    sameState(state, change.previousSha256, change.previousMode) ||
    sameState(state, change.intendedSha256, change.intendedMode)
  );
}

function assertPreviousState(root: string, journal: PublicationJournal): void {
  for (const change of journal.changes) {
    changePreviousState(root, change);
  }
  assertState(
    root,
    journal.manifestPath,
    journal.previousManifestSha256,
    journal.previousManifestMode,
    "previous manifest",
  );
}

function assertIntendedState(root: string, journal: PublicationJournal): void {
  for (const change of journal.changes) {
    changeIntendedState(root, change);
  }
  assertState(
    root,
    journal.manifestPath,
    journal.intendedManifestSha256,
    journal.intendedManifestMode,
    "intended manifest",
  );
}

function removeTransactionTemporary(root: string, relative: string): void {
  const state = inspectFile(root, relative);
  if (state === null) {
    return;
  }
  // The UUID-scoped path was proven absent before the journal granted this
  // transaction ownership. A crash can leave a partial copy, so its digest is
  // deliberately not used as a cleanup precondition.
  unlinkSync(absolutePath(root, relative));
  fsyncDirectory(path.dirname(absolutePath(root, relative)));
}

function clearPublicationTemporaries(
  root: string,
  journal: PublicationJournal,
): void {
  for (const change of journal.changes) {
    if (change.intendedSha256 !== null && change.disposition !== "unchanged") {
      removeTransactionTemporary(
        root,
        outputTemporary(journal.transactionId, change.path),
      );
    }
  }
  removeTransactionTemporary(
    root,
    manifestTemporary(journal.transactionId, journal.manifestPath),
  );
}

function assertRecoverableState(
  root: string,
  journal: PublicationJournal,
): void {
  clearPublicationTemporaries(root, journal);
  if (journal.phase === "prepared") {
    assertPreviousState(root, journal);
    return;
  }
  if (journal.phase === "published" || journal.phase === "committed") {
    assertIntendedState(root, journal);
    return;
  }
  for (const change of journal.changes) {
    if (!stateMatchesEither(root, change)) {
      const actual = inspectFile(root, change.path);
      publicationFailure(
        "NXHX-TRANSACTION-STATE-0003",
        "An interrupted output matches neither journaled state.",
        change.path,
        `${expectedState(change.previousSha256, change.previousMode)} or ${expectedState(change.intendedSha256, change.intendedMode)}`,
        describeState(actual),
        "Preserve the unexpected bytes and journal; resolve ownership explicitly before recovery.",
      );
    }
  }
  const manifestState = inspectFile(root, journal.manifestPath);
  const previousManifest = sameState(
    manifestState,
    journal.previousManifestSha256,
    journal.previousManifestMode,
  );
  const intendedManifest = sameState(
    manifestState,
    journal.intendedManifestSha256,
    journal.intendedManifestMode,
  );
  if (!previousManifest && !intendedManifest) {
    publicationFailure(
      "NXHX-TRANSACTION-STATE-0003",
      "The interrupted manifest matches neither journaled state.",
      journal.manifestPath,
      `${expectedState(journal.previousManifestSha256, journal.previousManifestMode)} or ${expectedState(journal.intendedManifestSha256, journal.intendedManifestMode)}`,
      describeState(manifestState),
      "Preserve the manifest and journal; resolve ownership explicitly before recovery.",
    );
  }
  if (intendedManifest) {
    for (const change of journal.changes) {
      changeIntendedState(root, change);
    }
  }
}

function removeTransactionDirectory(root: string, id: string): void {
  const relative = transactionDirectory(id);
  const absolute = absolutePath(root, relative);
  const stats = lstatIfPresent(absolute);
  if (stats === null) {
    return;
  }
  if (stats.isSymbolicLink() || !stats.isDirectory()) {
    publicationFailure(
      "NXHX-TRANSACTION-RECOVERY-0007",
      "The transaction workspace is not a real directory.",
      relative,
      "a private control directory",
      stats.isSymbolicLink() ? "symbolic link" : "non-directory entry",
      "Preserve the entry for inspection; cleanup never recursively follows ambiguous state.",
    );
  }
  rmSync(absolute, { recursive: true, force: true });
  fsyncDirectory(absolutePath(root, TRANSACTION_ROOT));
}

function cleanupWithoutJournal(root: string, transactionId: string): void {
  removeJournalTemporary(root);
  removeTransactionDirectory(root, transactionId);
}

function cleanupTerminal(root: string, journal: PublicationJournal): void {
  const current = readJournal(root);
  if (current?.transactionId !== journal.transactionId) {
    publicationFailure(
      "NXHX-TRANSACTION-RECOVERY-0007",
      "The active journal identity changed before cleanup.",
      JOURNAL_PATH,
      journal.transactionId,
      current?.transactionId ?? "missing",
      "Preserve control data; never clean a transaction whose identity changed.",
    );
  }
  unlinkSync(absolutePath(root, JOURNAL_PATH));
  fsyncDirectory(absolutePath(root, CONTROL_DIRECTORY));
  removeJournalTemporary(root);
  removeTransactionDirectory(root, journal.transactionId);
}

function fault(
  injector: ((point: PublicationFaultPoint) => void) | undefined,
  point: PublicationFaultPoint,
): void {
  injector?.(point);
}

function restorePreviousState(
  root: string,
  inputJournal: PublicationJournal,
  injector: ((point: PublicationFaultPoint) => void) | undefined,
): PublicationJournal {
  let journal = inputJournal;
  if (journal.phase !== "rolling-back") {
    journal = withPublicationPhase(journal, "rolling-back");
    writeJournal(root, journal);
    fault(injector, { kind: "phase-rolling-back" });
  }
  verifyJournalArtifacts(root, journal);
  assertRecoverableState(root, journal);

  const manifestState = inspectFile(root, journal.manifestPath);
  if (
    !sameState(
      manifestState,
      journal.previousManifestSha256,
      journal.previousManifestMode,
    )
  ) {
    if (journal.previousManifestSha256 === null) {
      unlinkExact(
        root,
        journal.manifestPath,
        journal.intendedManifestSha256,
        journal.intendedManifestMode,
      );
    } else {
      replaceFromBackup(
        root,
        backedUpManifest(journal.transactionId),
        journal.manifestPath,
        manifestTemporary(journal.transactionId, journal.manifestPath),
        journal.previousManifestSha256,
        journal.previousManifestMode as number,
      );
    }
    fault(injector, { kind: "manifest-restored" });
  }

  for (const change of [...journal.changes].reverse()) {
    const state = inspectFile(root, change.path);
    if (sameState(state, change.previousSha256, change.previousMode)) {
      continue;
    }
    if (change.previousSha256 === null) {
      unlinkExact(
        root,
        change.path,
        change.intendedSha256 as string,
        change.intendedMode as number,
      );
    } else {
      replaceFromBackup(
        root,
        backedUpOutput(journal.transactionId, change.path),
        change.path,
        outputTemporary(journal.transactionId, change.path),
        change.previousSha256,
        change.previousMode as number,
      );
    }
    fault(injector, { kind: "output-restored", path: change.path });
  }
  assertPreviousState(root, journal);
  return journal;
}

function categorizedResult(
  transactionId: string | null,
  action: PublicationResult["action"],
  preflight: OwnershipPreflightResult,
): PublicationResult {
  const paths = (disposition: OutputDisposition): readonly string[] =>
    Object.freeze(
      preflight.changes
        .filter((change) => change.disposition === disposition)
        .map((change) => change.path),
    );
  return Object.freeze({
    transactionId,
    action,
    created: paths("create"),
    updated: paths("update"),
    unchanged: paths("unchanged"),
    removed: paths("remove"),
  });
}

function initialJournal(
  root: string,
  transactionId: string,
  options: PublishGeneratedOutputsOptions,
  preflight: OwnershipPreflightResult,
  intendedManifestBytes: string,
  previousManifestBytes: Buffer | null,
): PublicationJournal {
  const changes = preflight.changes.map((change): PublicationJournalChange => {
    const previousState =
      change.previousSha256 === null ? null : inspectFile(root, change.path);
    if (
      change.previousSha256 !== null &&
      (previousState === null || previousState.sha256 !== change.previousSha256)
    ) {
      publicationFailure(
        "NXHX-TRANSACTION-STATE-0003",
        "An owned output changed between preflight and journaling.",
        change.path,
        change.previousSha256,
        describeState(previousState),
        "Preserve the live file and retry only after explicit ownership review.",
      );
    }
    return Object.freeze({
      path: change.path,
      disposition: change.disposition,
      previousOwnershipSha256: change.previousOwnershipSha256,
      intendedOwnershipSha256: change.intendedOwnershipSha256,
      previousSha256: change.previousSha256,
      intendedSha256: change.intendedSha256,
      previousMode: previousState?.mode ?? null,
      intendedMode:
        change.intendedSha256 === null
          ? null
          : change.disposition === "unchanged"
            ? (previousState as FileState).mode
            : GENERATED_MODE,
    });
  });
  const previousManifestState = inspectFile(
    root,
    relativePath(root, preflight.manifestPath),
  );
  if (previousManifestBytes === null && previousManifestState !== null) {
    publicationFailure(
      "NXHX-TRANSACTION-STATE-0003",
      "An ownership manifest appeared between preflight and journaling.",
      options.manifestPath,
      "missing",
      describeState(previousManifestState),
      "Preserve the manifest and retry only after explicit ownership review.",
    );
  }
  if (
    previousManifestBytes !== null &&
    previousManifestState?.sha256 !== sha256(previousManifestBytes)
  ) {
    publicationFailure(
      "NXHX-TRANSACTION-STATE-0003",
      "The ownership manifest changed between preflight and journaling.",
      options.manifestPath,
      sha256(previousManifestBytes),
      describeState(previousManifestState),
      "Preserve the manifest and retry only after explicit ownership review.",
    );
  }
  const allowedOutputRoots = preflight.allowedOutputRoots
    .map((allowed) => relativePath(root, allowed))
    .sort((left, right) => Buffer.from(left).compare(Buffer.from(right)));
  const allowedOutputFiles = preflight.allowedOutputFiles
    .map((allowed) => relativePath(root, allowed))
    .sort((left, right) => Buffer.from(left).compare(Buffer.from(right)));
  return createPublicationJournal({
    transactionId,
    phase: "prepared",
    manifestPath: relativePath(root, preflight.manifestPath),
    allowedOutputRoots,
    allowedOutputFiles,
    previousManifestSha256:
      previousManifestBytes === null ? null : sha256(previousManifestBytes),
    previousManifestMode: previousManifestState?.mode ?? null,
    intendedManifestSha256: sha256(intendedManifestBytes),
    intendedManifestMode:
      previousManifestBytes !== null &&
      sha256(previousManifestBytes) === sha256(intendedManifestBytes)
        ? (previousManifestState as FileState).mode
        : GENERATED_MODE,
    changes,
  });
}

async function formattedOutputs(
  outputs: readonly PlannedGeneratedOutput[],
  formatter: GeneratedOutputFormatter | undefined,
): Promise<readonly PlannedGeneratedOutput[]> {
  const seen = new Set<string>();
  const formatted: PlannedGeneratedOutput[] = [];
  for (const output of outputs) {
    const validated = validateOutputPath(output.path, "planned output path");
    const folded = validated.toLowerCase();
    if (seen.has(folded)) {
      // The pure preflight owns the stable duplicate diagnostic and runs below.
      formatted.push(await formatGeneratedOutput(output, formatter));
      continue;
    }
    seen.add(folded);
    formatted.push(await formatGeneratedOutput(output, formatter));
  }
  return Object.freeze(formatted);
}

function stageAndBackUp(
  root: string,
  journal: PublicationJournal,
  formatted: readonly PlannedGeneratedOutput[],
  intendedManifestBytes: string,
  previousManifestBytes: Buffer | null,
): void {
  const contentByPath = new Map(
    formatted.map((output) => [output.path, output.content]),
  );
  ensureDirectory(
    root,
    `${transactionDirectory(journal.transactionId)}/stage/outputs`,
  );
  ensureDirectory(
    root,
    `${transactionDirectory(journal.transactionId)}/backup/outputs`,
  );
  for (const change of journal.changes) {
    if (
      change.intendedSha256 !== null &&
      change.disposition !== "unchanged"
    ) {
      const content = contentByPath.get(change.path);
      if (content === undefined) {
        publicationFailure(
          "NXHX-TRANSACTION-STAGING-0004",
          "The complete formatted output tree is missing a journaled path.",
          change.path,
          change.intendedSha256,
          "missing staged content",
          "Regenerate the complete adapter plan before publication.",
        );
      }
      writeExactFile(
        root,
        stagedOutput(journal.transactionId, change.path),
        content,
        change.intendedMode as number,
      );
    }
    if (change.disposition === "update" || change.disposition === "remove") {
      const live = readFileSync(absolutePath(root, change.path));
      if (sha256(live) !== change.previousSha256) {
        publicationFailure(
          "NXHX-TRANSACTION-STATE-0003",
          "An owned output changed while its rollback backup was prepared.",
          change.path,
          change.previousSha256 as string,
          sha256(live),
          "Preserve the live file and retry only after explicit ownership review.",
        );
      }
      writeExactFile(
        root,
        backedUpOutput(journal.transactionId, change.path),
        live,
        CONTROL_MODE,
      );
    }
  }
  writeExactFile(
    root,
    stagedManifest(journal.transactionId),
    intendedManifestBytes,
    journal.intendedManifestMode,
  );
  if (previousManifestBytes !== null) {
    writeExactFile(
      root,
      backedUpManifest(journal.transactionId),
      previousManifestBytes,
      CONTROL_MODE,
    );
  }
  verifyJournalArtifacts(root, journal);
}

function assertTemporaryPathsUnused(
  root: string,
  journal: PublicationJournal,
): void {
  for (const change of journal.changes) {
    if (change.intendedSha256 !== null && change.disposition !== "unchanged") {
      assertState(
        root,
        outputTemporary(journal.transactionId, change.path),
        null,
        null,
        "unused temporary-path",
      );
    }
  }
  assertState(
    root,
    manifestTemporary(journal.transactionId, journal.manifestPath),
    null,
    null,
    "unused manifest temporary-path",
  );
}

function publishLiveState(
  root: string,
  inputJournal: PublicationJournal,
  injector: ((point: PublicationFaultPoint) => void) | undefined,
): PublicationJournal {
  let journal = withPublicationPhase(inputJournal, "publishing");
  writeJournal(root, journal);
  fault(injector, { kind: "phase-publishing" });
  assertPreviousState(root, journal);
  for (const change of journal.changes) {
    if (change.disposition === "unchanged") {
      continue;
    }
    changePreviousState(root, change);
    if (change.disposition === "remove") {
      unlinkExact(
        root,
        change.path,
        change.previousSha256 as string,
        change.previousMode as number,
      );
    } else {
      replaceFromArtifact(
        root,
        stagedOutput(journal.transactionId, change.path),
        change.path,
        outputTemporary(journal.transactionId, change.path),
        change.intendedSha256 as string,
        change.intendedMode as number,
        change.intendedMode as number,
      );
    }
    changeIntendedState(root, change);
    fault(injector, { kind: "output-published", path: change.path });
  }
  assertState(
    root,
    journal.manifestPath,
    journal.previousManifestSha256,
    journal.previousManifestMode,
    "previous manifest",
  );
  if (journal.previousManifestSha256 !== journal.intendedManifestSha256) {
    replaceFromArtifact(
      root,
      stagedManifest(journal.transactionId),
      journal.manifestPath,
      manifestTemporary(journal.transactionId, journal.manifestPath),
      journal.intendedManifestSha256,
      journal.intendedManifestMode,
      journal.intendedManifestMode,
    );
  }
  fault(injector, { kind: "manifest-published" });
  assertIntendedState(root, journal);
  journal = withPublicationPhase(journal, "published");
  writeJournal(root, journal);
  fault(injector, { kind: "phase-published" });
  return journal;
}

function wrapFilesystemFailure(error: unknown): never {
  if (
    error instanceof PublicationDiagnosticError ||
    error instanceof OwnershipDiagnosticError
  ) {
    throw error;
  }
  publicationFailure(
    "NXHX-TRANSACTION-FILESYSTEM-0009",
    "Generated-output publication failed after safe cleanup or rollback.",
    ".nextjshx",
    "a complete atomic publication transaction",
    error instanceof Error ? error.message : "unknown publication error",
    "Fix the reported filesystem or tooling failure and retry from the verified live state.",
  );
}

export async function publishGeneratedOutputs(
  options: PublishGeneratedOutputsOptions,
): Promise<PublicationResult> {
  const root = canonicalProjectRoot(options.projectRoot);
  const transactionId = randomUUID();
  const lock = acquireLock(root, transactionId);
  let journal: PublicationJournal | null = null;
  let journalPersisted = false;
  let preflight: OwnershipPreflightResult | null = null;
  try {
    removeJournalTemporary(root);
    const existingJournal = readJournal(root);
    if (existingJournal !== null) {
      publicationFailure(
        "NXHX-TRANSACTION-RECOVERY-0007",
        "An interrupted publication must be recovered before starting another.",
        JOURNAL_PATH,
        "no active transaction journal",
        `${existingJournal.transactionId} in phase ${existingJournal.phase}`,
        "Run generated-output recovery, inspect any unexpected bytes, then retry publication.",
      );
    }
    ensureDirectory(root, transactionDirectory(transactionId));
    const formatted = await formattedOutputs(
      options.outputs,
      options.formatter,
    );
    const preflightOptions = {
      projectRoot: root,
      manifestPath: options.manifestPath,
      allowedOutputRoots: options.allowedOutputRoots,
      allowedOutputFiles: options.allowedOutputFiles ?? [],
      nextVersion: options.nextVersion,
      genesVersion: options.genesVersion,
      outputProfile: options.outputProfile,
      outputs: formatted,
    };
    preflight =
      options.transfer === undefined
        ? preflightGeneratedOutputs(preflightOptions)
        : preflightOwnershipTransfer(preflightOptions, options.transfer);
    const intendedManifestBytes = encodeGeneratedOutputManifest(
      preflight.intendedManifest,
    );
    const previousManifestBytes =
      preflight.previousManifest === null
        ? null
        : readFileSync(preflight.manifestPath);
    journal = initialJournal(
      root,
      transactionId,
      options,
      preflight,
      intendedManifestBytes,
      previousManifestBytes,
    );
    stageAndBackUp(
      root,
      journal,
      formatted,
      intendedManifestBytes,
      previousManifestBytes,
    );
    assertTemporaryPathsUnused(root, journal);
    assertPreviousState(root, journal);
    const materialOutput = journal.changes.some(
      (change) => change.disposition !== "unchanged",
    );
    const materialManifest =
      journal.previousManifestSha256 !== journal.intendedManifestSha256;
    if (!materialOutput && !materialManifest) {
      cleanupWithoutJournal(root, transactionId);
      return categorizedResult(null, "unchanged", preflight);
    }

    writeJournal(root, journal);
    journalPersisted = true;
    fault(options.faultInjector, { kind: "journal-prepared" });
    journal = publishLiveState(root, journal, options.faultInjector);
    if (options.postValidate !== undefined) {
      try {
        await options.postValidate();
      } catch (error) {
        throw new PostValidationFailure(error);
      }
    }
    assertIntendedState(root, journal);
    journal = withPublicationPhase(journal, "committed");
    writeJournal(root, journal);
    fault(options.faultInjector, { kind: "phase-committed" });
    cleanupTerminal(root, journal);
    journalPersisted = false;
    return categorizedResult(transactionId, "published", preflight);
  } catch (error) {
    if (error instanceof PublicationCrashSimulationError) {
      if (!journalPersisted) {
        cleanupWithoutJournal(root, transactionId);
      }
      throw error;
    }
    try {
      if (journalPersisted && journal !== null) {
        const current = readJournal(root) ?? journal;
        if (current.phase === "prepared") {
          verifyJournalArtifacts(root, current);
          assertPreviousState(root, current);
          cleanupTerminal(root, current);
        } else if (current.phase === "committed") {
          verifyJournalArtifacts(root, current);
          assertIntendedState(root, current);
          cleanupTerminal(root, current);
        } else {
          const rolling = restorePreviousState(
            root,
            current,
            options.faultInjector,
          );
          cleanupTerminal(root, rolling);
        }
        journalPersisted = false;
      } else {
        cleanupWithoutJournal(root, transactionId);
      }
    } catch (recoveryError) {
      throw recoveryError;
    }
    if (error instanceof PostValidationFailure) {
      publicationFailure(
        "NXHX-TRANSACTION-VALIDATION-0008",
        "Post-publication validation failed and prior adapters were restored.",
        ".nextjshx",
        "a successful Next typecheck or configured validation oracle",
        error.validationError instanceof Error
          ? error.validationError.message
          : "unknown validation failure",
        "Fix the generated adapters or application types, then publish the complete tree again.",
      );
    }
    wrapFilesystemFailure(error);
  } finally {
    lock.release();
  }
}

export async function recoverGeneratedOutputPublication(
  options: RecoverGeneratedOutputsOptions,
): Promise<RecoveryResult> {
  const root = canonicalProjectRoot(options.projectRoot);
  ensureDirectory(root, CONTROL_DIRECTORY);
  clearProvablyStaleLock(root);
  const recoveryId = randomUUID();
  const lock = acquireLock(root, recoveryId);
  try {
    removeJournalTemporary(root);
    let journal = readJournal(root);
    if (journal === null) {
      return Object.freeze({ transactionId: null, action: "none" });
    }
    verifyJournalArtifacts(root, journal);
    assertRecoverableState(root, journal);
    if (journal.phase === "prepared") {
      cleanupTerminal(root, journal);
      return Object.freeze({
        transactionId: journal.transactionId,
        action: "rolled-back",
      });
    }
    if (journal.phase === "committed") {
      cleanupTerminal(root, journal);
      return Object.freeze({
        transactionId: journal.transactionId,
        action: "committed",
      });
    }
    if (journal.phase === "published" && options.postValidate !== undefined) {
      try {
        await options.postValidate();
      } catch (error) {
        const rolling = restorePreviousState(
          root,
          journal,
          options.faultInjector,
        );
        cleanupTerminal(root, rolling);
        publicationFailure(
          "NXHX-TRANSACTION-VALIDATION-0008",
          "Recovered post-publication validation failed and prior adapters were restored.",
          ".nextjshx",
          "a successful Next typecheck or configured validation oracle",
          error instanceof Error ? error.message : "unknown validation failure",
          "Fix generated or application types before publishing again.",
        );
      }
      assertIntendedState(root, journal);
      journal = withPublicationPhase(journal, "committed");
      writeJournal(root, journal);
      fault(options.faultInjector, { kind: "phase-committed" });
      cleanupTerminal(root, journal);
      return Object.freeze({
        transactionId: journal.transactionId,
        action: "committed",
      });
    }
    const rolling = restorePreviousState(root, journal, options.faultInjector);
    cleanupTerminal(root, rolling);
    return Object.freeze({
      transactionId: journal.transactionId,
      action: "rolled-back",
    });
  } finally {
    lock.release();
  }
}
