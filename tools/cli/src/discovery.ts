import {
  existsSync,
  readFileSync,
  realpathSync,
  statSync,
} from "node:fs";
import path from "node:path";

import {
  CONFIG_FILE_NAME,
  type NextJsHxConfig,
  readNextJsHxConfig,
} from "./config.js";
import { configFailure } from "./diagnostic.js";

type JsonObject = Record<string, unknown>;

export type PackageManagerName = "npm" | "pnpm" | "yarn" | "bun";

export interface PackageManagerDiscovery {
  readonly name: PackageManagerName;
  readonly version?: string;
  readonly source: "packageManager" | "lockfile";
  readonly lockfile?: string;
}

export interface NextPackageDiscovery {
  readonly name: string;
  readonly requestedVersion?: string;
  readonly installedVersion?: string;
  readonly packageJsonPath?: string;
}

export interface ConfiguredProjectPaths {
  readonly hxml: string;
  readonly generatedRoot: string;
  readonly manifest: string;
  readonly upstreamDir?: string;
}

export interface NextProjectDiscovery {
  readonly packageRoot: string;
  readonly workspaceRoot: string;
  readonly packageJsonPath: string;
  readonly configPath: string | null;
  readonly config: NextJsHxConfig | null;
  readonly appRoot: string;
  readonly appRootRelative: string;
  readonly packageManager: PackageManagerDiscovery;
  readonly nextPackage: NextPackageDiscovery;
  readonly configuredPaths: ConfiguredProjectPaths | null;
}

export interface DiscoveryOptions {
  readonly configPath?: string;
  readonly requireConfig?: boolean;
}

interface ManagerSignal {
  readonly name: PackageManagerName;
  readonly version?: string;
  readonly source: "packageManager" | "lockfile";
  readonly file: string;
}

const LOCKFILES: ReadonlyArray<readonly [string, PackageManagerName]> = [
  ["pnpm-lock.yaml", "pnpm"],
  ["yarn.lock", "yarn"],
  ["package-lock.json", "npm"],
  ["npm-shrinkwrap.json", "npm"],
  ["bun.lock", "bun"],
  ["bun.lockb", "bun"],
];

function jsonObjectAt(
  file: string,
  category: "project" | "workspace" | "package",
): JsonObject {
  let decoded: unknown;
  try {
    decoded = JSON.parse(readFileSync(file, "utf8"));
  } catch {
    const code =
      category === "workspace"
        ? "NXHX-CONFIG-WORKSPACE-0011"
        : category === "package"
          ? "NXHX-CONFIG-NEXT-PACKAGE-0014"
          : "NXHX-CONFIG-PROJECT-0010";
    configFailure(
      code,
      `Cannot parse ${path.basename(file)} as JSON.`,
      file,
      "a readable JSON object",
      "Repair the package metadata before running NextJsHx discovery.",
    );
  }
  if (typeof decoded !== "object" || decoded === null || Array.isArray(decoded)) {
    const code =
      category === "workspace"
        ? "NXHX-CONFIG-WORKSPACE-0011"
        : category === "package"
          ? "NXHX-CONFIG-NEXT-PACKAGE-0014"
          : "NXHX-CONFIG-PROJECT-0010";
    configFailure(
      code,
      `${path.basename(file)} must contain a JSON object.`,
      file,
      "a JSON object",
      "Replace the top-level value with valid package metadata.",
    );
  }
  return decoded as JsonObject;
}

function startingDirectory(start: string): string {
  const absolute = path.resolve(start);
  try {
    return statSync(absolute).isDirectory() ? absolute : path.dirname(absolute);
  } catch {
    configFailure(
      "NXHX-CONFIG-PROJECT-0010",
      "The discovery start path does not exist.",
      absolute,
      "an existing file or directory inside a Next.js package",
      "Run discovery from the target package or pass an existing path inside it.",
    );
  }
}

function ancestors(start: string): string[] {
  const result: string[] = [];
  let current = path.resolve(start);
  while (true) {
    result.push(current);
    const parent = path.dirname(current);
    if (parent === current) {
      return result;
    }
    current = parent;
  }
}

function findPackageRoot(start: string): string {
  for (const candidate of ancestors(start)) {
    if (existsSync(path.join(candidate, "package.json"))) {
      return candidate;
    }
  }
  configFailure(
    "NXHX-CONFIG-PROJECT-0010",
    "No package.json was found from the discovery path upward.",
    start,
    "a Node package containing the Next.js application",
    "Run discovery inside the application package or create its package.json first.",
  );
}

function workspacePatterns(
  manifest: JsonObject,
  file: string,
): readonly string[] | null {
  if (!Object.hasOwn(manifest, "workspaces")) {
    return null;
  }
  const value = manifest.workspaces;
  let patterns: unknown;
  if (Array.isArray(value)) {
    patterns = value;
  } else if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    patterns = (value as JsonObject).packages;
  }
  if (
    !Array.isArray(patterns) ||
    patterns.length === 0 ||
    patterns.some((entry) => typeof entry !== "string" || entry.length === 0)
  ) {
    configFailure(
      "NXHX-CONFIG-WORKSPACE-0011",
      "package.json has an unsupported workspaces declaration.",
      file,
      "a non-empty string array or an object with a non-empty packages string array",
      "Use the standard npm/Yarn workspace shape so package membership can be verified.",
    );
  }
  return patterns as readonly string[];
}

function globExpression(pattern: string): RegExp {
  const normalized = pattern.replace(/^\.\//, "").replace(/\/$/, "");
  let expression = "^";
  for (let index = 0; index < normalized.length; index += 1) {
    const character = normalized[index];
    const following = normalized[index + 1];
    if (character === "*" && following === "*") {
      if (normalized[index + 2] === "/") {
        expression += "(?:.*/)?";
        index += 2;
      } else {
        expression += ".*";
        index += 1;
      }
    } else if (character === "*") {
      expression += "[^/]*";
    } else if (character === "?") {
      expression += "[^/]";
    } else {
      expression += character?.replace(/[|\\{}()[\]^$+?.]/g, "\\$&") ?? "";
    }
  }
  return new RegExp(`${expression}$`);
}

function workspaceIncludes(
  patterns: readonly string[],
  relativePackageRoot: string,
): boolean {
  let included = false;
  for (const configuredPattern of patterns) {
    const excluded = configuredPattern.startsWith("!");
    const pattern = excluded ? configuredPattern.slice(1) : configuredPattern;
    if (pattern.length > 0 && globExpression(pattern).test(relativePackageRoot)) {
      included = !excluded;
    }
  }
  return included;
}

function findWorkspaceRoot(packageRoot: string): string {
  for (const candidate of ancestors(packageRoot)) {
    const hasHostMarker = ["pnpm-workspace.yaml", "lerna.json", "rush.json"].some((file) =>
      existsSync(path.join(candidate, file)),
    );
    if (hasHostMarker) {
      return candidate;
    }

    const packageJson = path.join(candidate, "package.json");
    if (!existsSync(packageJson)) {
      continue;
    }
    const manifest = jsonObjectAt(packageJson, "workspace");
    const patterns = workspacePatterns(manifest, packageJson);
    if (patterns === null) {
      continue;
    }
    if (candidate === packageRoot) {
      return candidate;
    }
    const relative = path.relative(candidate, packageRoot).split(path.sep).join("/");
    if (workspaceIncludes(patterns, relative)) {
      return candidate;
    }
  }
  return packageRoot;
}

function packageManagerSignal(
  manifest: JsonObject,
  file: string,
): ManagerSignal | null {
  if (!Object.hasOwn(manifest, "packageManager")) {
    return null;
  }
  const value = manifest.packageManager;
  if (typeof value !== "string") {
    configFailure(
      "NXHX-CONFIG-PACKAGE-MANAGER-0012",
      "packageManager must be a name@version string.",
      file,
      "npm@version, pnpm@version, yarn@version, or bun@version",
      "Set packageManager to the tool and version used by this workspace.",
    );
  }
  const match = /^(npm|pnpm|yarn|bun)@([^\s]+)$/.exec(value);
  if (match === null) {
    configFailure(
      "NXHX-CONFIG-PACKAGE-MANAGER-0012",
      `Unsupported packageManager value ${JSON.stringify(value)}.`,
      file,
      "npm@version, pnpm@version, yarn@version, or bun@version",
      "Declare one supported package manager with its exact Corepack version.",
    );
  }
  return {
    name: match[1] as PackageManagerName,
    version: match[2] as string,
    source: "packageManager",
    file,
  };
}

function discoverPackageManager(
  packageRoot: string,
  workspaceRoot: string,
): PackageManagerDiscovery {
  const roots = [...new Set([workspaceRoot, packageRoot])];
  const signals: ManagerSignal[] = [];
  for (const root of roots) {
    const packageJson = path.join(root, "package.json");
    if (existsSync(packageJson)) {
      const signal = packageManagerSignal(jsonObjectAt(packageJson, "workspace"), packageJson);
      if (signal !== null) {
        signals.push(signal);
      }
    }
    for (const [lockName, manager] of LOCKFILES) {
      const lockfile = path.join(root, lockName);
      if (existsSync(lockfile)) {
        signals.push({ name: manager, source: "lockfile", file: lockfile });
      }
    }
  }

  if (signals.length === 0) {
    configFailure(
      "NXHX-CONFIG-PACKAGE-MANAGER-0012",
      "No supported package-manager declaration or lockfile was found.",
      workspaceRoot,
      "a packageManager field or npm, pnpm, Yarn, or Bun lockfile",
      "Declare packageManager with an exact version and commit the matching lockfile.",
    );
  }
  const names = [...new Set(signals.map((signal) => signal.name))].sort();
  if (names.length !== 1) {
    configFailure(
      "NXHX-CONFIG-PACKAGE-MANAGER-0012",
      `Conflicting package-manager evidence was found: ${names.join(", ")}.`,
      workspaceRoot,
      "one package manager across the discovered package and workspace roots",
      "Remove stale lockfiles or align packageManager before NextJsHx changes dependencies.",
    );
  }

  const explicit = signals.filter((signal) => signal.source === "packageManager");
  const versions = [...new Set(explicit.map((signal) => signal.version))];
  if (versions.length > 1) {
    configFailure(
      "NXHX-CONFIG-PACKAGE-MANAGER-0012",
      "The package and workspace declare different package-manager versions.",
      workspaceRoot,
      "one exact package-manager version",
      "Align the nested package with the workspace packageManager declaration.",
    );
  }
  const selected = explicit[0] ?? signals[0];
  if (selected === undefined) {
    throw new Error("unreachable package-manager selection");
  }
  const lockfile = signals.find(
    (signal) => signal.source === "lockfile" && signal.name === selected.name,
  )?.file;
  return Object.freeze({
    name: selected.name,
    ...(selected.version === undefined ? {} : { version: selected.version }),
    source: selected.source,
    ...(lockfile === undefined ? {} : { lockfile }),
  });
}

function isDirectory(candidate: string): boolean {
  try {
    return statSync(candidate).isDirectory();
  } catch {
    return false;
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

function discoverAppRoot(packageRoot: string, configured: string | undefined): {
  readonly absolute: string;
  readonly relative: string;
} {
  let relative: string;
  if (configured !== undefined) {
    relative = configured;
    if (!isDirectory(path.resolve(packageRoot, relative))) {
      configFailure(
        "NXHX-CONFIG-APP-ROOT-0013",
        `Configured App Router root ${JSON.stringify(relative)} is not a directory.`,
        "$.appRoot",
        "an existing app or src/app directory under the package root",
        "Create the configured directory or update appRoot to the existing App Router root.",
      );
    }
  } else {
    const matches = ["app", "src/app"].filter((candidate) =>
      isDirectory(path.join(packageRoot, candidate)),
    );
    if (matches.length === 0) {
      configFailure(
        "NXHX-CONFIG-APP-ROOT-0013",
        "Neither app nor src/app exists in the package.",
        packageRoot,
        "exactly one App Router root, or an explicit appRoot",
        "Create the App Router root or configure its project-relative location.",
      );
    }
    if (matches.length > 1) {
      configFailure(
        "NXHX-CONFIG-APP-ROOT-0013",
        "Both app and src/app exist, so App Router ownership is ambiguous.",
        packageRoot,
        "one detected App Router root",
        "Set appRoot explicitly after confirming which tree Next.js owns.",
      );
    }
    relative = matches[0] as string;
  }

  const absolute = path.resolve(packageRoot, relative);
  const realPackageRoot = realpathSync.native(packageRoot);
  const realAppRoot = realpathSync.native(absolute);
  if (!containedBy(realPackageRoot, realAppRoot)) {
    configFailure(
      "NXHX-CONFIG-SYMLINK-0015",
      "The App Router root resolves outside the package through a symlink.",
      absolute,
      "a real directory contained by the package root",
      "Move the App Router root into the package; generated ownership cannot cross this boundary.",
    );
  }
  return { absolute, relative };
}

function dependencyVersion(
  manifest: JsonObject,
  name: string,
  file: string,
): string | undefined {
  for (const field of [
    "dependencies",
    "devDependencies",
    "optionalDependencies",
    "peerDependencies",
  ]) {
    const section = manifest[field];
    if (typeof section !== "object" || section === null || Array.isArray(section)) {
      continue;
    }
    const value = (section as JsonObject)[name];
    if (value === undefined) {
      continue;
    }
    if (typeof value !== "string" || value.length === 0 || value.trim() !== value) {
      configFailure(
        "NXHX-CONFIG-NEXT-PACKAGE-0014",
        `The ${field} entry for ${name} must be a non-empty version string.`,
        file,
        "a valid npm dependency specification",
        "Repair the package.json dependency before running NextJsHx.",
      );
    }
    return value;
  }
  return undefined;
}

function discoverNextPackage(
  name: string,
  packageRoot: string,
  workspaceRoot: string,
  packageManifest: JsonObject,
): NextPackageDiscovery {
  const workspacePackageJson = path.join(workspaceRoot, "package.json");
  const workspaceManifest =
    workspaceRoot === packageRoot || !existsSync(workspacePackageJson)
      ? packageManifest
      : jsonObjectAt(workspacePackageJson, "workspace");
  const requestedVersion =
    dependencyVersion(packageManifest, name, path.join(packageRoot, "package.json")) ??
    dependencyVersion(workspaceManifest, name, workspacePackageJson);

  const packageSegments = name.split("/");
  const candidates = [...new Set([packageRoot, workspaceRoot])].map((root) =>
    path.join(root, "node_modules", ...packageSegments, "package.json"),
  );
  const installedManifestPath = candidates.find((candidate) => existsSync(candidate));
  let installedVersion: string | undefined;
  let packageJsonPath: string | undefined;
  if (installedManifestPath !== undefined) {
    const installed = jsonObjectAt(installedManifestPath, "package");
    if (
      typeof installed.version !== "string" ||
      !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(installed.version)
    ) {
      configFailure(
        "NXHX-CONFIG-NEXT-PACKAGE-0014",
        `Installed ${name} has an invalid package version.`,
        installedManifestPath,
        "a semantic package version",
        "Reinstall the configured Next.js package from a valid npm artifact.",
      );
    }
    installedVersion = installed.version;
    packageJsonPath = realpathSync.native(installedManifestPath);
  }

  if (requestedVersion === undefined && installedVersion === undefined) {
    configFailure(
      "NXHX-CONFIG-NEXT-PACKAGE-0014",
      `Configured Next.js package ${JSON.stringify(name)} is neither declared nor installed.`,
      path.join(packageRoot, "package.json"),
      `a dependency named ${name}`,
      "Add the configured package to the application package and install the workspace lockfile.",
    );
  }
  return Object.freeze({
    name,
    ...(requestedVersion === undefined ? {} : { requestedVersion }),
    ...(installedVersion === undefined ? {} : { installedVersion }),
    ...(packageJsonPath === undefined ? {} : { packageJsonPath }),
  });
}

function configuredPaths(
  packageRoot: string,
  config: NextJsHxConfig,
): ConfiguredProjectPaths {
  return Object.freeze({
    hxml: path.resolve(packageRoot, config.haxe.hxml),
    generatedRoot: path.resolve(packageRoot, config.haxe.generatedRoot),
    manifest: path.resolve(packageRoot, config.output.manifest),
    ...(config.next.upstreamDir === undefined
      ? {}
      : { upstreamDir: path.resolve(packageRoot, config.next.upstreamDir) }),
  });
}

export function discoverNextProject(
  start: string,
  options: DiscoveryOptions = {},
): NextProjectDiscovery {
  const startDirectory = startingDirectory(start);
  const packageRoot = findPackageRoot(startDirectory);
  const packageJsonPath = path.join(packageRoot, "package.json");
  const packageManifest = jsonObjectAt(packageJsonPath, "project");
  const workspaceRoot = findWorkspaceRoot(packageRoot);

  const selectedConfigPath =
    options.configPath === undefined
      ? path.join(packageRoot, CONFIG_FILE_NAME)
      : path.resolve(startDirectory, options.configPath);
  const configExists = existsSync(selectedConfigPath);
  if (
    options.configPath !== undefined &&
    path.dirname(selectedConfigPath) !== packageRoot
  ) {
    configFailure(
      "NXHX-CONFIG-PROJECT-0010",
      `${CONFIG_FILE_NAME} must live at the discovered package root.`,
      selectedConfigPath,
      path.join(packageRoot, CONFIG_FILE_NAME),
      "Move the config to the application package root so ownership paths have one base.",
    );
  }
  if (!configExists && (options.requireConfig ?? true)) {
    configFailure(
      "NXHX-CONFIG-READ-0001",
      `No ${CONFIG_FILE_NAME} exists at the package root.`,
      selectedConfigPath,
      `a readable ${CONFIG_FILE_NAME}`,
      "Create the versioned config, or use discovery with requireConfig false during init.",
    );
  }
  const config = configExists ? readNextJsHxConfig(selectedConfigPath) : null;
  const app = discoverAppRoot(packageRoot, config?.appRoot);
  const packageManager = discoverPackageManager(packageRoot, workspaceRoot);
  const nextPackage = discoverNextPackage(
    config?.next.package ?? "next",
    packageRoot,
    workspaceRoot,
    packageManifest,
  );

  return Object.freeze({
    packageRoot,
    workspaceRoot,
    packageJsonPath,
    configPath: configExists ? selectedConfigPath : null,
    config,
    appRoot: app.absolute,
    appRootRelative: app.relative,
    packageManager,
    nextPackage,
    configuredPaths: config === null ? null : configuredPaths(packageRoot, config),
  });
}
