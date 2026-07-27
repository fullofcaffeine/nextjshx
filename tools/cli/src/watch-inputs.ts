import { createHash } from "node:crypto";
import {
  existsSync,
  lstatSync,
  readFileSync,
  readdirSync,
  realpathSync,
  watch,
  type FSWatcher,
} from "node:fs";
import path from "node:path";

import type { NextProjectDiscovery } from "./discovery.js";

export type WatchChangeKind = "source" | "identity";

export interface WatchChange {
  readonly kind: WatchChangeKind;
  readonly path: string;
}

interface ExactWatchInput {
  readonly path: string;
  readonly kind: WatchChangeKind;
}

interface TreeWatchInput extends ExactWatchInput {
  readonly haxeOnly: boolean;
}

export interface HaxeWatchPlan {
  readonly projectRoot: string;
  readonly identity: string;
  readonly hxmlFiles: readonly string[];
  readonly classPaths: readonly string[];
  readonly resourceInputs: readonly string[];
  readonly exactInputs: readonly ExactWatchInput[];
  readonly treeInputs: readonly TreeWatchInput[];
}

export interface WatchSession {
  close(): void;
}

export interface WatchSessionOptions {
  /** Reconcile native watcher state at this interval so a coalesced event cannot lose an edit. */
  readonly pollIntervalMs?: number;
  /** @internal Test seam for proving that polling is independently sufficient. */
  readonly nativeEvents?: boolean;
}

interface HxmlInventory {
  readonly hxmlFiles: Set<string>;
  readonly classPaths: Set<string>;
  readonly resources: Set<string>;
  readonly libraries: Set<string>;
}

const IDENTITY_FILE_NAMES = [
  ".haxerc",
  "bun.lock",
  "bun.lockb",
  "haxelib.json",
  "lix.scope",
  "package-lock.json",
  "package.json",
  "pnpm-lock.yaml",
  "yarn.lock",
] as const;
const IGNORED_DIRECTORY_NAMES = new Set([
  ".git",
  ".next",
  ".nextjshx",
  "node_modules",
]);
const MAX_IDENTITY_FILES = 10_000;
const MAX_IDENTITY_BYTES = 64 * 1024 * 1024;
const DEFAULT_POLL_INTERVAL_MS = 250;
const MINIMUM_POLL_INTERVAL_MS = 25;
const MAXIMUM_POLL_INTERVAL_MS = 60_000;

function errorCode(error: object): string | undefined {
  return "code" in error && typeof error.code === "string" ? error.code : undefined;
}

function bytewise(values: Iterable<string>): string[] {
  return [...values].sort((left, right) => Buffer.from(left).compare(Buffer.from(right)));
}

function tokenizeHxmlLine(line: string, file: string, lineNumber: number): readonly string[] {
  const tokens: string[] = [];
  let value = "";
  let quote: "\"" | "'" | null = null;
  let escaped = false;
  const push = (): void => {
    if (value.length > 0) {
      tokens.push(value);
      value = "";
    }
  };
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index] as string;
    if (escaped) {
      value += character;
      escaped = false;
      continue;
    }
    if (character === "\\") {
      escaped = true;
      continue;
    }
    if (quote !== null) {
      if (character === quote) {
        quote = null;
      } else {
        value += character;
      }
      continue;
    }
    if (character === "\"" || character === "'") {
      quote = character;
      continue;
    }
    if (character === "#") {
      break;
    }
    if (/\s/.test(character)) {
      push();
      continue;
    }
    value += character;
  }
  if (escaped || quote !== null) {
    throw new Error(`${file}:${lineNumber}: unterminated escape or quote in HXML watch input`);
  }
  push();
  return Object.freeze(tokens);
}

function hxmlArguments(file: string): readonly string[] {
  return Object.freeze(
    readFileSync(file, "utf8")
      .replaceAll("\r\n", "\n")
      .split("\n")
      .flatMap((line, index) => tokenizeHxmlLine(line, file, index + 1)),
  );
}

function expandedPath(value: string): string | null {
  let missing = false;
  const expanded = value.replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (_match, name: string) => {
    const replacement = process.env[name];
    if (replacement === undefined) {
      missing = true;
      return "";
    }
    return replacement;
  });
  return missing ? null : expanded;
}

function resolvedInput(cwd: string, value: string): string | null {
  const expanded = expandedPath(value);
  return expanded === null ? null : path.resolve(cwd, expanded);
}

function optionValue(
  args: readonly string[],
  index: number,
  names: readonly string[],
): { readonly value: string; readonly consumed: number } | null {
  const argument = args[index] as string;
  for (const name of names) {
    if (argument === name) {
      const value = args[index + 1];
      return value === undefined ? null : { value, consumed: 1 };
    }
    if (argument.startsWith(`${name}=`)) {
      return { value: argument.slice(name.length + 1), consumed: 0 };
    }
  }
  return null;
}

function collectHxml(file: string, projectRoot: string, inventory: HxmlInventory): void {
  const absolute = path.resolve(file);
  if (inventory.hxmlFiles.has(absolute)) {
    return;
  }
  if (!existsSync(absolute) || !lstatSync(absolute).isFile()) {
    throw new Error(`HXML watch input is missing or not a regular file: ${absolute}`);
  }
  inventory.hxmlFiles.add(absolute);
  const args = hxmlArguments(absolute);
  let cwd = projectRoot;
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index] as string;
    const cwdOption = optionValue(args, index, ["--cwd"]);
    if (cwdOption !== null) {
      const resolved = resolvedInput(cwd, cwdOption.value);
      if (resolved !== null) {
        cwd = resolved;
      }
      index += cwdOption.consumed;
      continue;
    }
    const classPath = optionValue(args, index, ["-cp", "--class-path"]);
    if (classPath !== null) {
      const resolved = resolvedInput(cwd, classPath.value);
      if (resolved !== null) {
        inventory.classPaths.add(resolved);
      }
      index += classPath.consumed;
      continue;
    }
    const resource = optionValue(args, index, ["-resource", "--resource"]);
    if (resource !== null) {
      const separator = resource.value.lastIndexOf("@");
      const resourcePath = separator === -1
        ? resource.value
        : resource.value.slice(0, separator);
      const resolved = resolvedInput(cwd, resourcePath);
      if (resolved !== null) {
        inventory.resources.add(resolved);
      }
      index += resource.consumed;
      continue;
    }
    const library = optionValue(args, index, ["-lib", "--library"]);
    if (library !== null) {
      inventory.libraries.add(library.value.split(":", 1)[0] as string);
      index += library.consumed;
      continue;
    }
    if (!argument.startsWith("-") && argument.endsWith(".hxml")) {
      const nested = resolvedInput(cwd, argument);
      if (nested !== null) {
        collectHxml(nested, projectRoot, inventory);
      }
    }
  }
}

function libraryHxml(
  library: string,
  discovery: NextProjectDiscovery,
): string | null {
  if (!/^[A-Za-z0-9_.-]+$/.test(library)) {
    return null;
  }
  for (const root of haxeInputRoots(discovery)) {
    const candidate = path.join(root, "haxe_libraries", `${library}.hxml`);
    if (existsSync(candidate) && lstatSync(candidate).isFile()) {
      return candidate;
    }
  }
  return null;
}

function nearestHaxeScopeRoot(start: string): string | null {
  let current = path.resolve(start);
  while (true) {
    if (existsSync(path.join(current, ".haxerc"))) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }
}

function haxeInputRoots(discovery: NextProjectDiscovery): readonly string[] {
  const scope = nearestHaxeScopeRoot(discovery.packageRoot);
  return Object.freeze(bytewise(new Set([
    discovery.packageRoot,
    discovery.workspaceRoot,
    ...(scope === null ? [] : [scope]),
  ])));
}

function addExact(
  values: Map<string, WatchChangeKind>,
  candidate: string,
  kind: WatchChangeKind,
): void {
  const absolute = path.resolve(candidate);
  const previous = values.get(absolute);
  values.set(absolute, previous === "identity" || kind === "identity" ? "identity" : "source");
}

function addTree(
  values: Map<string, TreeWatchInput>,
  candidate: string,
  kind: WatchChangeKind,
  haxeOnly: boolean,
): void {
  const absolute = path.resolve(candidate);
  const previous = values.get(absolute);
  values.set(absolute, {
    path: absolute,
    kind: previous?.kind === "identity" || kind === "identity" ? "identity" : "source",
    haxeOnly: previous?.haxeOnly === false || !haxeOnly ? false : true,
  });
}

function inventoryIdentity(
  projectRoot: string,
  exact: ReadonlyMap<string, WatchChangeKind>,
  trees: ReadonlyMap<string, TreeWatchInput>,
  classPaths: readonly string[],
): string {
  const hash = createHash("sha256");
  let files = 0;
  let bytes = 0;
  const includeFile = (file: string): void => {
    const stats = lstatSync(file);
    if (stats.isSymbolicLink() || !stats.isFile()) {
      throw new Error(`identity input is not a real regular file: ${file}`);
    }
    const content = readFileSync(file);
    files += 1;
    bytes += content.byteLength;
    if (files > MAX_IDENTITY_FILES || bytes > MAX_IDENTITY_BYTES) {
      throw new Error("Haxe watch identity exceeds the 10,000-file or 64 MiB safety bound");
    }
    hash.update(path.relative(projectRoot, file).split(path.sep).join("/"));
    hash.update("\0");
    hash.update(content);
    hash.update("\n");
  };
  const includeTree = (directory: string): void => {
    for (const child of readdirSync(directory, { withFileTypes: true }).sort((left, right) =>
      Buffer.from(left.name).compare(Buffer.from(right.name)),
    )) {
      if (IGNORED_DIRECTORY_NAMES.has(child.name)) {
        continue;
      }
      const absolute = path.join(directory, child.name);
      if (child.isSymbolicLink()) {
        throw new Error(`identity input tree contains a symbolic link: ${absolute}`);
      }
      if (child.isDirectory()) {
        includeTree(absolute);
      } else if (child.isFile()) {
        includeFile(absolute);
      }
    }
  };
  for (const file of bytewise(exact.keys())) {
    hash.update(`exact:${path.relative(projectRoot, file).split(path.sep).join("/")}\n`);
    if (exact.get(file) === "identity" && existsSync(file)) {
      includeFile(file);
    }
  }
  for (const tree of bytewise(trees.keys())) {
    const input = trees.get(tree) as TreeWatchInput;
    hash.update(`tree:${input.kind}:${input.haxeOnly ? "hx" : "all"}:${path.relative(projectRoot, tree).split(path.sep).join("/")}\n`);
    if (input.kind === "identity" && existsSync(tree) && lstatSync(tree).isDirectory()) {
      includeTree(tree);
    }
  }
  for (const classPath of classPaths) {
    hash.update(`classpath:${classPath}\n`);
  }
  return hash.digest("hex");
}

export function createHaxeWatchPlan(discovery: NextProjectDiscovery): HaxeWatchPlan {
  if (discovery.config === null || discovery.configuredPaths === null || discovery.configPath === null) {
    throw new Error("Haxe watch planning requires a configured NextJsHx project");
  }
  const inventory: HxmlInventory = {
    hxmlFiles: new Set(),
    classPaths: new Set(),
    resources: new Set(),
    libraries: new Set(),
  };
  collectHxml(discovery.configuredPaths.hxml, discovery.packageRoot, inventory);
  for (const library of bytewise(inventory.libraries)) {
    const libraryFile = libraryHxml(library, discovery);
    if (libraryFile !== null) {
      collectHxml(libraryFile, discovery.packageRoot, inventory);
    }
  }

  const exact = new Map<string, WatchChangeKind>();
  const trees = new Map<string, TreeWatchInput>();
  for (const hxml of inventory.hxmlFiles) {
    addExact(exact, hxml, "identity");
  }
  addExact(exact, discovery.configPath, "identity");
  for (const root of haxeInputRoots(discovery)) {
    for (const name of IDENTITY_FILE_NAMES) {
      addExact(exact, path.join(root, name), "identity");
    }
    const libraries = path.join(root, "haxe_libraries");
    if (existsSync(libraries) && lstatSync(libraries).isDirectory()) {
      addTree(trees, libraries, "identity", false);
    }
  }
  for (const classPath of inventory.classPaths) {
    if (existsSync(classPath) && lstatSync(classPath).isDirectory()) {
      addTree(trees, classPath, "source", true);
    } else {
      addExact(exact, classPath, "source");
    }
  }
  for (const resource of inventory.resources) {
    if (existsSync(resource) && lstatSync(resource).isDirectory()) {
      addTree(trees, resource, "identity", false);
    } else {
      addExact(exact, resource, "identity");
    }
  }
  for (const relative of discovery.config.haxe.extraInputs) {
    const extra = path.resolve(discovery.packageRoot, ...relative.split("/"));
    if (existsSync(extra) && lstatSync(extra).isDirectory()) {
      addTree(trees, extra, "identity", false);
    } else {
      addExact(exact, extra, "identity");
    }
  }

  const classPaths = bytewise(inventory.classPaths);
  const exactInputs = bytewise(exact.keys()).map((input) =>
    Object.freeze({ path: input, kind: exact.get(input) as WatchChangeKind }),
  );
  const treeInputs = bytewise(trees.keys()).map((input) =>
    Object.freeze(trees.get(input) as TreeWatchInput),
  );
  return Object.freeze({
    projectRoot: discovery.packageRoot,
    identity: inventoryIdentity(discovery.packageRoot, exact, trees, classPaths),
    hxmlFiles: Object.freeze(bytewise(inventory.hxmlFiles)),
    classPaths: Object.freeze(classPaths),
    resourceInputs: Object.freeze(bytewise(inventory.resources)),
    exactInputs: Object.freeze(exactInputs),
    treeInputs: Object.freeze(treeInputs),
  });
}

interface ExactWatchLocation {
  readonly directory: string;
  readonly target: string;
  readonly recursive: boolean;
}

function exactWatchLocation(candidate: string): ExactWatchLocation {
  const absolute = path.resolve(candidate);
  const directParent = path.dirname(absolute);
  let logicalParent = directParent;
  while (!existsSync(logicalParent)) {
    const parent = path.dirname(logicalParent);
    if (parent === logicalParent) {
      throw new Error(`cannot find an existing watch parent for ${candidate}`);
    }
    logicalParent = parent;
  }
  const stats = lstatSync(logicalParent);
  if (stats.isSymbolicLink() || !stats.isDirectory()) {
    throw new Error(`watch parent is not a real directory: ${logicalParent}`);
  }
  const directory = realpathSync.native(logicalParent);
  return Object.freeze({
    directory,
    target: path.resolve(directory, path.relative(logicalParent, absolute)),
    recursive: logicalParent !== directParent,
  });
}

function within(parent: string, child: string): boolean {
  const relative = path.relative(parent, child);
  return relative === "" || (!path.isAbsolute(relative) && relative !== ".." && !relative.startsWith(`..${path.sep}`));
}

interface WatchSnapshotEntry {
  readonly kind: WatchChangeKind;
  readonly fingerprint: string;
}

type WatchSnapshot = Map<string, WatchSnapshotEntry>;

function strongerKind(left: WatchChangeKind, right: WatchChangeKind): WatchChangeKind {
  return left === "identity" || right === "identity" ? "identity" : "source";
}

function filesystemFingerprint(candidate: string): string {
  if (!existsSync(candidate)) {
    return "missing";
  }
  const stats = lstatSync(candidate, { bigint: true });
  const kind = stats.isFile()
    ? "file"
    : stats.isDirectory()
      ? "directory"
      : stats.isSymbolicLink()
        ? "symlink"
        : "special";
  return [
    kind,
    stats.dev,
    stats.ino,
    stats.mode,
    stats.size,
    stats.mtimeNs,
    stats.ctimeNs,
  ].join(":");
}

function addSnapshotEntry(
  snapshot: WatchSnapshot,
  candidate: string,
  kind: WatchChangeKind,
  fingerprint: string,
): void {
  const absolute = path.resolve(candidate);
  const previous = snapshot.get(absolute);
  snapshot.set(absolute, Object.freeze({
    kind: previous === undefined ? kind : strongerKind(previous.kind, kind),
    fingerprint,
  }));
}

function scanWatchTree(
  snapshot: WatchSnapshot,
  input: TreeWatchInput,
): void {
  const root = path.resolve(input.path);
  if (!existsSync(root)) {
    addSnapshotEntry(snapshot, root, input.kind, "missing-tree");
    return;
  }
  const rootStats = lstatSync(root);
  if (rootStats.isSymbolicLink() || !rootStats.isDirectory()) {
    addSnapshotEntry(snapshot, root, input.kind, filesystemFingerprint(root));
    return;
  }
  // The stable marker detects deletion or type replacement without rebuilding
  // merely because a non-Haxe child changed the classpath directory mtime.
  addSnapshotEntry(snapshot, root, input.kind, "directory");
  const visit = (directory: string): void => {
    for (const child of readdirSync(directory, { withFileTypes: true }).sort((left, right) =>
      Buffer.from(left.name).compare(Buffer.from(right.name)),
    )) {
      if (IGNORED_DIRECTORY_NAMES.has(child.name)) {
        continue;
      }
      const absolute = path.join(directory, child.name);
      if (child.isDirectory()) {
        visit(absolute);
      } else if (!input.haxeOnly || absolute.endsWith(".hx")) {
        addSnapshotEntry(snapshot, absolute, input.kind, filesystemFingerprint(absolute));
      }
    }
  };
  visit(root);
}

function captureWatchSnapshot(plan: HaxeWatchPlan): WatchSnapshot {
  const snapshot: WatchSnapshot = new Map();
  for (const input of plan.exactInputs) {
    addSnapshotEntry(snapshot, input.path, input.kind, filesystemFingerprint(input.path));
  }
  for (const input of plan.treeInputs) {
    scanWatchTree(snapshot, input);
  }
  return snapshot;
}

function changedSnapshotEntries(
  previous: ReadonlyMap<string, WatchSnapshotEntry>,
  current: ReadonlyMap<string, WatchSnapshotEntry>,
): readonly WatchChange[] {
  const paths = bytewise(new Set([...previous.keys(), ...current.keys()]));
  return Object.freeze(paths.flatMap((candidate) => {
    const before = previous.get(candidate);
    const after = current.get(candidate);
    if (before?.fingerprint === after?.fingerprint && before?.kind === after?.kind) {
      return [];
    }
    const kind = before === undefined
      ? (after as WatchSnapshotEntry).kind
      : after === undefined
        ? before.kind
        : strongerKind(before.kind, after.kind);
    return [Object.freeze({ kind, path: candidate })];
  }));
}

export function watchHaxeInputs(
  plan: HaxeWatchPlan,
  onChange: (change: WatchChange) => void,
  onError: (error: Error) => void,
  options: WatchSessionOptions = {},
): WatchSession {
  const pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  if (
    !Number.isInteger(pollIntervalMs) ||
    pollIntervalMs < MINIMUM_POLL_INTERVAL_MS ||
    pollIntervalMs > MAXIMUM_POLL_INTERVAL_MS
  ) {
    throw new Error(
      `Haxe watch polling interval must be an integer from ${MINIMUM_POLL_INTERVAL_MS} through ${MAXIMUM_POLL_INTERVAL_MS} milliseconds`,
    );
  }
  const nativeEvents = options.nativeEvents ?? true;
  const watchers: FSWatcher[] = [];
  let closed = false;
  let snapshot = captureWatchSnapshot(plan);
  let lastPollingError: string | null = null;
  const capture = (): WatchSnapshot | null => {
    try {
      const current = captureWatchSnapshot(plan);
      lastPollingError = null;
      return current;
    } catch (error) {
      const failure = error instanceof Error ? error : new Error("cannot reconcile Haxe watch inputs");
      if (failure.message !== lastPollingError) {
        lastPollingError = failure.message;
        onError(failure);
      }
      return null;
    }
  };
  const reconcile = (reportChanges: boolean): boolean | null => {
    if (closed) {
      return false;
    }
    const current = capture();
    if (current === null) {
      return null;
    }
    const changes = reportChanges ? changedSnapshotEntries(snapshot, current) : [];
    const changed = reportChanges
      ? changes.length > 0
      : changedSnapshotEntries(snapshot, current).length > 0;
    snapshot = current;
    for (const change of changes) {
      onChange(change);
    }
    return changed;
  };
  const reportNativeChange = (change: WatchChange): void => {
    // Refresh before handing the event to the dirty loop. If the native backend
    // reported an intermediate write, the next poll still observes final bytes.
    // A delayed native event for state already reconciled by polling is stale
    // and must not schedule a redundant second compilation.
    if (reconcile(false) !== false) {
      onChange(change);
    }
  };
  const watchDirectory = (
    directory: string,
    recursive: boolean,
    changed: (absolute: string | null) => void,
  ): void => {
    if (!nativeEvents) {
      return;
    }
    const watcher = watch(directory, { encoding: "utf8", persistent: true, recursive });
    watcher.on("change", (_event, filename) => {
      const decoded = filename === null
        ? null
        : typeof filename === "string"
          ? filename
          : filename.toString("utf8");
      changed(decoded === null ? null : path.resolve(directory, decoded));
    });
    watcher.on("error", (error) => onError(error));
    watchers.push(watcher);
  };

  for (const input of plan.exactInputs) {
    const location = exactWatchLocation(input.path);
    watchDirectory(location.directory, location.recursive, (changed) => {
      if (
        changed === null ||
        changed === location.target ||
        within(changed, location.target) ||
        within(location.target, changed)
      ) {
        reportNativeChange(Object.freeze({ kind: input.kind, path: changed ?? location.target }));
      }
    });
  }
  for (const input of plan.treeInputs) {
    if (!existsSync(input.path)) {
      continue;
    }
    const root = realpathSync.native(input.path);
    watchDirectory(root, true, (changed) => {
      if (changed === null) {
        reportNativeChange(Object.freeze({ kind: input.kind, path: input.path }));
        return;
      }
      const relative = path.relative(root, changed);
      if (relative.split(path.sep).some((segment) => IGNORED_DIRECTORY_NAMES.has(segment))) {
        return;
      }
      if (!input.haxeOnly || changed.endsWith(".hx")) {
        reportNativeChange(Object.freeze({ kind: input.kind, path: changed }));
      }
    });
  }
  // Close the registration gap: a change between the baseline snapshot and
  // native watcher setup is converted into the same typed event as a poll.
  reconcile(true);
  const polling = setInterval(() => reconcile(true), pollIntervalMs);
  return Object.freeze({
    close(): void {
      if (closed) {
        return;
      }
      closed = true;
      clearInterval(polling);
      for (const watcher of watchers) {
        watcher.close();
      }
    },
  });
}
