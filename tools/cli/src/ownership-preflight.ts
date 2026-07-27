import { createHash } from "node:crypto";
import {
  lstatSync,
  readFileSync,
  realpathSync,
  statSync,
  type Stats,
} from "node:fs";
import path from "node:path";

import {
  type GeneratedOutputManifest,
  type GeneratedOutputRecord,
  createGeneratedOutputManifest,
  parseGeneratedOutputManifest,
} from "./manifest.js";
import { ownershipFailure } from "./ownership-diagnostic.js";
import {
  validateOutputPath,
  validatePortableProjectPath,
} from "./ownership-path.js";

export interface PlannedGeneratedOutput {
  readonly path: string;
  readonly kind: string;
  readonly source: string;
  readonly content: string | Uint8Array;
}

export type OutputDisposition = "create" | "update" | "unchanged" | "remove";

export interface OutputPreflightChange {
  readonly path: string;
  readonly kind: string;
  readonly source: string;
  readonly disposition: OutputDisposition;
  readonly previousOwnershipSha256: string | null;
  readonly intendedOwnershipSha256: string | null;
  readonly previousSha256: string | null;
  readonly intendedSha256: string | null;
}

export type OwnershipTransferOperation = "adopt" | "release" | "repair";

export interface OwnershipTransferRequest {
  readonly operation: OwnershipTransferOperation;
  readonly path: string;
}

export interface OwnershipPreflightOptions {
  readonly projectRoot: string;
  readonly manifestPath: string;
  readonly allowedOutputRoots: readonly string[];
  readonly allowedOutputFiles?: readonly string[];
  readonly nextVersion: string;
  readonly genesVersion: string;
  readonly outputs: readonly PlannedGeneratedOutput[];
}

export interface OwnershipPreflightResult {
  readonly projectRoot: string;
  readonly manifestPath: string;
  readonly allowedOutputRoots: readonly string[];
  readonly allowedOutputFiles: readonly string[];
  readonly previousManifest: GeneratedOutputManifest | null;
  readonly intendedManifest: GeneratedOutputManifest;
  readonly changes: readonly OutputPreflightChange[];
}

interface CanonicalRoot {
  readonly relative: string;
  readonly absolute: string;
}

interface CanonicalFile {
  readonly relative: string;
  readonly absolute: string;
}

function lstatIfPresent(candidate: string): Stats | null {
  try {
    return lstatSync(candidate);
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { readonly code?: string }).code === "ENOENT"
    ) {
      return null;
    }
    ownershipFailure(
      "NXHX-OWNERSHIP-TARGET-0013",
      "Cannot inspect an output path safely.",
      candidate,
      "readable filesystem metadata",
      error instanceof Error ? error.message : "unknown filesystem error",
      "Fix path permissions or filesystem errors before retrying preflight.",
    );
  }
}

function containedBy(parent: string, child: string): boolean {
  const relative = path.relative(parent, child);
  return (
    relative === "" ||
    (!relative.startsWith(`..${path.sep}`) &&
      relative !== ".." &&
      !path.isAbsolute(relative))
  );
}

function projectRoot(candidate: string): string {
  const absolute = path.resolve(candidate);
  let real: string;
  try {
    real = realpathSync.native(absolute);
  } catch {
    ownershipFailure(
      "NXHX-OWNERSHIP-ROOT-0012",
      "The project root cannot be canonicalized.",
      absolute,
      "an existing real directory",
      "missing or unreadable",
      "Run preflight against the discovered application package root.",
    );
  }
  if (!statSync(real).isDirectory()) {
    ownershipFailure(
      "NXHX-OWNERSHIP-ROOT-0012",
      "The project root is not a directory.",
      real,
      "an existing real directory",
      "non-directory filesystem entry",
      "Run preflight against the discovered application package root.",
    );
  }
  return real;
}

function assertSafeComponents(
  root: string,
  absolute: string,
  includeTarget: boolean,
): Stats | null {
  if (!containedBy(root, absolute)) {
    ownershipFailure(
      "NXHX-OWNERSHIP-ESCAPE-0007",
      "An ownership path escapes the canonical project root.",
      absolute,
      `a path contained by ${root}`,
      path.relative(root, absolute),
      "Use a normalized project-relative target under an explicit output root.",
    );
  }
  const relative = path.relative(root, absolute);
  const segments = relative === "" ? [] : relative.split(path.sep);
  const stop = includeTarget ? segments.length : Math.max(segments.length - 1, 0);
  let current = root;
  for (let index = 0; index < stop; index += 1) {
    current = path.join(current, segments[index] as string);
    const stats = lstatIfPresent(current);
    if (stats === null) {
      return null;
    }
    if (stats.isSymbolicLink()) {
      ownershipFailure(
        "NXHX-OWNERSHIP-SYMLINK-0006",
        "An ownership path crosses a symbolic link.",
        current,
        "real directories and regular output files only",
        "symbolic link",
        "Move generated ownership under a real project directory; symlink traversal is never implicit.",
      );
    }
    const isTarget = includeTarget && index === segments.length - 1;
    if (!isTarget && !stats.isDirectory()) {
      ownershipFailure(
        "NXHX-OWNERSHIP-TARGET-0013",
        "An output parent is not a directory.",
        current,
        "a real parent directory",
        "non-directory filesystem entry",
        "Move or rename the blocking native entry before retrying.",
      );
    }
  }
  return includeTarget && segments.length > 0 ? lstatIfPresent(absolute) : null;
}

function canonicalAllowedRoots(root: string, configured: readonly string[]): readonly CanonicalRoot[] {
  if (configured.length === 0) {
    ownershipFailure(
      "NXHX-OWNERSHIP-ROOT-0012",
      "No generated-output root was allowlisted.",
      root,
      "at least one explicit project-relative output root",
      "empty allowlist",
      "Pass the discovered App Router root or another reviewed generated-output root.",
    );
  }
  const identities = new Set<string>();
  const roots = configured.map((entry, index): CanonicalRoot => {
    const relative =
      entry === ""
        ? ""
        : validatePortableProjectPath(entry, `allowedOutputRoots[${index}]`, false);
    const folded = relative.toLowerCase();
    if (identities.has(folded)) {
      ownershipFailure(
        "NXHX-OWNERSHIP-DUPLICATE-0005",
        "The output-root allowlist contains duplicate filesystem paths.",
        relative || ".",
        "unique portable output roots",
        relative || ".",
        "Remove the duplicate root before planning outputs.",
      );
    }
    identities.add(folded);
    const absolute = relative === "" ? root : path.resolve(root, relative);
    const stats = assertSafeComponents(root, absolute, true);
    if (stats !== null && !stats.isDirectory()) {
      ownershipFailure(
        "NXHX-OWNERSHIP-ROOT-0012",
        "An allowlisted generated-output root is not a directory.",
        relative || ".",
        "a real directory or a not-yet-created directory path",
        "non-directory filesystem entry",
        "Choose the discovered App Router or generated-source directory.",
      );
    }
    return Object.freeze({ relative, absolute });
  });
  return Object.freeze(roots);
}

function canonicalAllowedFiles(
  root: string,
  allowedRoots: readonly CanonicalRoot[],
  configured: readonly string[],
): readonly CanonicalFile[] {
  const identities = new Set<string>();
  const files = configured.map((entry, index): CanonicalFile => {
    const relative = validateOutputPath(entry, `allowedOutputFiles[${index}]`);
    const folded = relative.toLowerCase();
    if (identities.has(folded)) {
      ownershipFailure(
        "NXHX-OWNERSHIP-DUPLICATE-0005",
        "The exact-file output allowlist contains duplicate filesystem paths.",
        relative,
        "unique portable output files",
        relative,
        "Remove the duplicate exact-file entry before planning outputs.",
      );
    }
    const absolute = path.resolve(root, relative);
    if (
      allowedRoots.some((allowed) => {
        const rootIdentity = allowed.relative.toLowerCase();
        return (
          rootIdentity === "" ||
          folded === rootIdentity ||
          folded.startsWith(`${rootIdentity}/`)
        );
      })
    ) {
      ownershipFailure(
        "NXHX-OWNERSHIP-DUPLICATE-0005",
        "An exact output file is already covered by an allowlisted output root.",
        relative,
        "a non-redundant exact file outside every broad output root",
        relative,
        "Remove the redundant exact-file entry; use it only for isolated framework convention files.",
      );
    }
    identities.add(folded);
    assertSafeComponents(root, absolute, false);
    return Object.freeze({ relative, absolute });
  });
  files.sort((left, right) =>
    Buffer.from(left.relative).compare(Buffer.from(right.relative)),
  );
  return Object.freeze(files);
}

function targetPath(
  root: string,
  allowedRoots: readonly CanonicalRoot[],
  allowedFiles: readonly CanonicalFile[],
  relative: string,
): { readonly absolute: string; readonly stats: Stats | null } {
  const validated = validateOutputPath(relative, "output path");
  const absolute = path.resolve(root, validated);
  if (
    !allowedRoots.some((allowed) => containedBy(allowed.absolute, absolute)) &&
    !allowedFiles.some((allowed) => allowed.absolute === absolute)
  ) {
    ownershipFailure(
      "NXHX-OWNERSHIP-ESCAPE-0007",
      "The output is outside every allowlisted generated-output root and exact file.",
      validated,
      [
        ...allowedRoots.map((allowed) => `${allowed.relative || "."}/**`),
        ...allowedFiles.map((allowed) => allowed.relative),
      ].join(", "),
      validated,
      "Move the adapter target under the discovered App Router root or " +
        "explicitly review one exact framework-convention output file.",
    );
  }
  const stats = assertSafeComponents(root, absolute, true);
  if (stats !== null && stats.isSymbolicLink()) {
    ownershipFailure(
      "NXHX-OWNERSHIP-SYMLINK-0006",
      "A generated-output target is a symbolic link.",
      validated,
      "a missing target or regular manifest-owned file",
      "symbolic link",
      "Remove the symlink or keep the target native-owned; ownership never follows links.",
    );
  }
  if (stats !== null && !stats.isFile()) {
    ownershipFailure(
      "NXHX-OWNERSHIP-TARGET-0013",
      "A generated-output target is not a regular file.",
      validated,
      "a missing target or regular manifest-owned file",
      stats.isDirectory() ? "directory" : "special filesystem entry",
      "Move the native entry or choose a different adapter target.",
    );
  }
  return { absolute, stats };
}

function fileSha256(file: string): string {
  return createHash("sha256").update(readFileSync(file)).digest("hex");
}

function contentSha256(content: string | Uint8Array, target: string): string {
  if (typeof content !== "string" && !(content instanceof Uint8Array)) {
    ownershipFailure(
      "NXHX-OWNERSHIP-TARGET-0013",
      "A planned output has unsupported content bytes.",
      target,
      "a UTF-8 string or Uint8Array",
      typeof content,
      "Render the complete adapter into deterministic bytes before preflight.",
    );
  }
  return createHash("sha256").update(content).digest("hex");
}

function manifestFile(root: string, relative: string): string {
  const validated = validatePortableProjectPath(relative, "manifestPath", false);
  if (!validated.startsWith(".nextjshx/") || !validated.endsWith(".json")) {
    ownershipFailure(
      "NXHX-OWNERSHIP-MANIFEST-0001",
      "The ownership manifest must remain under the reserved .nextjshx control directory.",
      validated,
      "a path such as .nextjshx/manifest.json",
      validated,
      "Move ownership control data under .nextjshx before running preflight.",
    );
  }
  if (
    validated === ".nextjshx/transaction.json" ||
    validated.startsWith(".nextjshx/transactions/") ||
    validated.startsWith(".nextjshx/plans/")
  ) {
    ownershipFailure(
      "NXHX-OWNERSHIP-MANIFEST-0001",
      "The ownership manifest collides with transactional recovery control data.",
      validated,
      "a dedicated path such as .nextjshx/manifest.json",
      "reserved transaction journal or workspace path",
      "Keep ownership identity separate from transaction.json, transactions/, and plans/.",
    );
  }
  const absolute = path.resolve(root, validated);
  assertSafeComponents(root, absolute, true);
  return absolute;
}

function readPreviousManifest(file: string): GeneratedOutputManifest | null {
  const stats = lstatIfPresent(file);
  if (stats === null) {
    return null;
  }
  if (stats.isSymbolicLink()) {
    ownershipFailure(
      "NXHX-OWNERSHIP-SYMLINK-0006",
      "The ownership manifest is a symbolic link.",
      file,
      "a regular manifest file",
      "symbolic link",
      "Replace the link only through an explicit verified recovery workflow.",
    );
  }
  if (!stats.isFile()) {
    ownershipFailure(
      "NXHX-OWNERSHIP-MANIFEST-0001",
      "The ownership manifest is not a regular file.",
      file,
      "a regular JSON manifest file",
      stats.isDirectory() ? "directory" : "special filesystem entry",
      "Preserve the entry for inspection and repair the control directory explicitly.",
    );
  }
  let decoded: unknown;
  try {
    decoded = JSON.parse(readFileSync(file, "utf8"));
  } catch {
    ownershipFailure(
      "NXHX-OWNERSHIP-MANIFEST-0001",
      "The ownership manifest is not valid JSON.",
      file,
      "strict schema-v1 JSON",
      "malformed JSON",
      "Preserve the file and use explicit repair; malformed control data proves no ownership.",
    );
  }
  return parseGeneratedOutputManifest(decoded);
}

function outputChange(
  output: GeneratedOutputRecord,
  disposition: OutputDisposition,
  previousOwnershipSha256: string | null,
  intendedOwnershipSha256: string | null,
  previousSha256 = previousOwnershipSha256,
  intendedSha256 = intendedOwnershipSha256,
): OutputPreflightChange {
  return Object.freeze({
    path: output.path,
    kind: output.kind,
    source: output.source,
    disposition,
    previousOwnershipSha256,
    intendedOwnershipSha256,
    previousSha256,
    intendedSha256,
  });
}

function transferFailure(
  path: string,
  message: string,
  expected: string,
  actual: string,
  resolution: string,
  source?: string,
): never {
  ownershipFailure(
    "NXHX-OWNERSHIP-TRANSFER-0014",
    message,
    path,
    expected,
    actual,
    resolution,
    source,
  );
}

function requiredTransferRecord(
  value: GeneratedOutputRecord | undefined,
  path: string,
  side: "previous" | "intended",
): GeneratedOutputRecord {
  if (value === undefined) {
    transferFailure(
      path,
      "The validated transfer state lost a required manifest record.",
      `a ${side} ownership record`,
      "missing",
      "Retry from a stable manifest and fresh adapter plan.",
    );
  }
  return value;
}

export function preflightOwnershipTransfer(
  options: OwnershipPreflightOptions,
  request: OwnershipTransferRequest,
): OwnershipPreflightResult {
  const root = projectRoot(options.projectRoot);
  const allowedRoots = canonicalAllowedRoots(root, options.allowedOutputRoots);
  const allowedFiles = canonicalAllowedFiles(
    root,
    allowedRoots,
    options.allowedOutputFiles ?? [],
  );
  const absoluteManifest = manifestFile(root, options.manifestPath);
  const transferPath = validateOutputPath(request.path, "ownership transfer path");
  const intendedManifest = createGeneratedOutputManifest(
    options.nextVersion,
    options.genesVersion,
    options.outputs.map((output) => ({
      path: validateOutputPath(output.path, "planned output path"),
      kind: output.kind,
      source: output.source,
      sha256: contentSha256(output.content, output.path),
    })),
  );
  const previousManifest = readPreviousManifest(absoluteManifest);
  const previousByPath = new Map(
    previousManifest?.outputs.map((output) => [output.path, output]) ?? [],
  );
  const intendedByPath = new Map(
    intendedManifest.outputs.map((output) => [output.path, output]),
  );
  const previousTransfer = previousByPath.get(transferPath);
  const intendedTransfer = intendedByPath.get(transferPath);

  if (request.operation === "adopt") {
    if (previousTransfer !== undefined || intendedTransfer === undefined) {
      transferFailure(
        transferPath,
        "Adopt requires one unowned target requested by the fresh Haxe plan.",
        "absent from the previous manifest and present in the intended manifest",
        `previous ${previousTransfer === undefined ? "absent" : "present"}; intended ${intendedTransfer === undefined ? "absent" : "present"}`,
        "Keep the native file unchanged, add the matching Haxe declaration, and retry adopt.",
        intendedTransfer?.source,
      );
    }
  } else if (request.operation === "release") {
    if (previousTransfer === undefined || intendedTransfer !== undefined) {
      transferFailure(
        transferPath,
        "Release requires one verified owned target omitted by the fresh Haxe plan.",
        "present in the previous manifest and absent from the intended manifest",
        `previous ${previousTransfer === undefined ? "absent" : "present"}; intended ${intendedTransfer === undefined ? "absent" : "present"}`,
        "Remove the owning Haxe declaration while preserving the live adapter, then retry release.",
        previousTransfer?.source,
      );
    }
  } else if (previousTransfer === undefined || intendedTransfer === undefined) {
    transferFailure(
      transferPath,
      "Repair requires one target in both the verified manifest and fresh Haxe plan.",
      "the same owned path in both manifests",
      `previous ${previousTransfer === undefined ? "absent" : "present"}; intended ${intendedTransfer === undefined ? "absent" : "present"}`,
      "Restore the owning Haxe declaration and manifest before retrying repair.",
      intendedTransfer?.source ?? previousTransfer?.source,
    );
  }

  if (
    request.operation === "repair" &&
    previousTransfer !== undefined &&
    intendedTransfer !== undefined &&
    (previousTransfer.kind !== intendedTransfer.kind ||
      previousTransfer.source !== intendedTransfer.source)
  ) {
    transferFailure(
      transferPath,
      "Repair cannot change the owning Haxe declaration identity or adapter kind.",
      `${previousTransfer.source} (${previousTransfer.kind})`,
      `${intendedTransfer.source} (${intendedTransfer.kind})`,
      "Use release and adopt as separate reviewed ownership changes.",
      intendedTransfer.source,
    );
  }

  const allPaths = [...new Set([
    ...previousByPath.keys(),
    ...intendedByPath.keys(),
  ])].sort((left, right) => Buffer.from(left).compare(Buffer.from(right)));
  const changes: OutputPreflightChange[] = [];
  for (const outputPath of allPaths) {
    const previous = previousByPath.get(outputPath);
    const intended = intendedByPath.get(outputPath);
    const target = targetPath(root, allowedRoots, allowedFiles, outputPath);
    const actualSha =
      target.stats === null ? null : fileSha256(target.absolute);

    if (outputPath !== transferPath) {
      if (
        previous === undefined ||
        intended === undefined ||
        previous.sha256 !== intended.sha256 ||
        previous.kind !== intended.kind ||
        previous.source !== intended.source ||
        actualSha !== previous.sha256
      ) {
        transferFailure(
          transferPath,
          "Ownership transfer refused unrelated output drift.",
          "every non-target output unchanged in its manifest identity and live bytes",
          outputPath,
          "Run generate or resolve unrelated ownership drift before transferring one path.",
        );
      }
      changes.push(
        outputChange(
          intended,
          "unchanged",
          previous.sha256,
          intended.sha256,
        ),
      );
      continue;
    }

    const identity = intended ?? previous;
    if (identity === undefined) {
      transferFailure(
        transferPath,
        "The transfer target has no reviewed ownership identity.",
        "a previous or intended manifest record",
        "absent from both manifests",
        "Choose the exact adapter path named by the fresh plan or manifest.",
      );
    }
    if (request.operation === "adopt") {
      const adopted = requiredTransferRecord(
        intended,
        transferPath,
        "intended",
      );
      if (actualSha !== adopted.sha256) {
        transferFailure(
          transferPath,
          "Adopt requires byte-for-byte equality with the freshly rendered adapter.",
          adopted.sha256,
          actualSha ?? "missing",
          "Review and replace the native file with the exact previewed adapter before adopting it.",
          identity.source,
        );
      }
      changes.push(
        outputChange(
          identity,
          "unchanged",
          null,
          adopted.sha256,
          actualSha,
          actualSha,
        ),
      );
    } else if (request.operation === "release") {
      const released = requiredTransferRecord(
        previous,
        transferPath,
        "previous",
      );
      if (actualSha !== released.sha256) {
        transferFailure(
          transferPath,
          "Release requires the live owned file to match its manifest digest.",
          released.sha256,
          actualSha ?? "missing",
          "Repair or review the modified output before releasing ownership.",
          identity.source,
        );
      }
      changes.push(
        outputChange(
          identity,
          "unchanged",
          released.sha256,
          null,
          actualSha,
          actualSha,
        ),
      );
    } else {
      const repairedPrevious = requiredTransferRecord(
        previous,
        transferPath,
        "previous",
      );
      const repairedIntended = requiredTransferRecord(
        intended,
        transferPath,
        "intended",
      );
      const intendedSha = repairedIntended.sha256;
      changes.push(
        outputChange(
          identity,
          actualSha === null
            ? "create"
            : actualSha === intendedSha
              ? "unchanged"
              : "update",
          repairedPrevious.sha256,
          intendedSha,
          actualSha,
          intendedSha,
        ),
      );
    }
  }

  return Object.freeze({
    projectRoot: root,
    manifestPath: absoluteManifest,
    allowedOutputRoots: Object.freeze(
      allowedRoots.map((allowed) => allowed.absolute),
    ),
    allowedOutputFiles: Object.freeze(
      allowedFiles.map((allowed) => allowed.absolute),
    ),
    previousManifest,
    intendedManifest,
    changes: Object.freeze(changes),
  });
}

export function preflightGeneratedOutputs(
  options: OwnershipPreflightOptions,
): OwnershipPreflightResult {
  const root = projectRoot(options.projectRoot);
  const allowedRoots = canonicalAllowedRoots(root, options.allowedOutputRoots);
  const allowedFiles = canonicalAllowedFiles(
    root,
    allowedRoots,
    options.allowedOutputFiles ?? [],
  );
  const absoluteManifest = manifestFile(root, options.manifestPath);

  const intendedRecords = options.outputs.map((output) =>
    Object.freeze({
      path: validateOutputPath(output.path, "planned output path"),
      kind: output.kind,
      source: output.source,
      sha256: contentSha256(output.content, output.path),
    }),
  );
  const intendedManifest = createGeneratedOutputManifest(
    options.nextVersion,
    options.genesVersion,
    intendedRecords,
  );
  const previousManifest = readPreviousManifest(absoluteManifest);
  const previousByPath = new Map(
    previousManifest?.outputs.map((output) => [output.path, output]) ?? [],
  );

  for (const previous of previousManifest?.outputs ?? []) {
    const target = targetPath(root, allowedRoots, allowedFiles, previous.path);
    if (target.stats === null) {
      ownershipFailure(
        "NXHX-OWNERSHIP-MISSING-0010",
        "A manifest-owned output is missing.",
        previous.path,
        previous.sha256,
        "missing",
        "Use explicit repair or ownership release; do not infer that another file can replace it.",
        previous.source,
      );
    }
    const actual = fileSha256(target.absolute);
    if (actual !== previous.sha256) {
      ownershipFailure(
        "NXHX-OWNERSHIP-MODIFIED-0009",
        "A manifest-owned output has changed since publication.",
        previous.path,
        previous.sha256,
        actual,
        "Preserve the file and use explicit repair, adopt, or release after reviewing the modification.",
        previous.source,
      );
    }
  }

  const changes: OutputPreflightChange[] = [];
  const intendedPaths = new Set<string>();
  for (const intended of intendedManifest.outputs) {
    intendedPaths.add(intended.path);
    const target = targetPath(root, allowedRoots, allowedFiles, intended.path);
    const previous = previousByPath.get(intended.path);
    if (target.stats !== null && previous === undefined) {
      ownershipFailure(
        "NXHX-OWNERSHIP-UNOWNED-0008",
        "The planned target already exists without verified NextJsHx " +
          `ownership. Source ${intended.source} cannot claim it.`,
        intended.path,
        "a missing target or an exact record in the verified previous manifest",
        "existing unowned native file",
        "Rename or move the Haxe route, keep the native route, explicitly " +
          "adopt ownership, or remove one source.",
        intended.source,
      );
    }
    const disposition: OutputDisposition =
      previous === undefined
        ? "create"
        : previous.sha256 === intended.sha256
          ? "unchanged"
          : "update";
    changes.push(
      outputChange(
        intended,
        disposition,
        previous?.sha256 ?? null,
        intended.sha256,
      ),
    );
  }
  for (const previous of previousManifest?.outputs ?? []) {
    if (!intendedPaths.has(previous.path)) {
      changes.push(outputChange(previous, "remove", previous.sha256, null));
    }
  }
  changes.sort((left, right) => Buffer.from(left.path).compare(Buffer.from(right.path)));

  return Object.freeze({
    projectRoot: root,
    manifestPath: absoluteManifest,
    allowedOutputRoots: Object.freeze(
      allowedRoots.map((allowed) => allowed.absolute),
    ),
    allowedOutputFiles: Object.freeze(
      allowedFiles.map((allowed) => allowed.absolute),
    ),
    previousManifest,
    intendedManifest,
    changes: Object.freeze(changes),
  });
}
