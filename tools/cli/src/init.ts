import { createHash, randomUUID } from "node:crypto";
import {
  constants,
  closeSync,
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  rmdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

import {
  CONFIG_FILE_NAME,
  CONFIG_SCHEMA_ID,
  CONFIG_SCHEMA_VERSION,
  effectiveOutputProfile,
} from "./config.js";
import { cliFailure } from "./cli-diagnostic.js";
import { discoverNextProject } from "./discovery.js";
import type { NextProjectDiscovery } from "./discovery.js";
import { ensureCompilerToolchain } from "./toolchain.js";
import {
  GENES_TS_IDENTITY,
  HAXE_VERSION,
  NEXTJSHX_VERSION,
  NEXT_VERSION,
} from "./toolchain-identities.js";
import {
  type ProcessRequest,
  type ProcessResult,
  type ProcessRunner,
  runProcess,
} from "./process.js";

type JsonValue =
  | boolean
  | number
  | string
  | null
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

export type SetupFaultPoint = "before-toolchain";

export interface InitRuntime {
  readonly processRunner?: ProcessRunner;
  readonly haxeCommand?: {
    readonly command: string;
    readonly argsPrefix: readonly string[];
  };
  readonly uuid?: () => string;
  readonly faultInjector?: (point: SetupFaultPoint) => void;
}

export interface InitCommandOptions {
  readonly start: string;
  readonly command?: "init" | "setup";
  readonly typedRoutes?: boolean;
  readonly runtime?: InitRuntime;
}

export interface InitFileReport {
  readonly path: string;
  readonly action: "created" | "updated" | "unchanged" | "preserved";
  readonly reason: string;
}

export interface InitScriptReport {
  readonly name: "dev" | "generate" | "typecheck";
  readonly action: "added" | "unchanged" | "preserved";
  readonly previous: string | null;
  readonly proposed: string;
}

export interface InitCommandResult {
  readonly command: "init" | "setup";
  readonly projectRoot: string;
  readonly packageManager: string;
  readonly appRoot: string;
  readonly action: "initialized" | "unchanged" | "partial";
  readonly files: readonly InitFileReport[];
  readonly scripts: readonly InitScriptReport[];
  readonly typedRoutes: "disabled" | "enabled" | "manual";
  readonly followUp: readonly string[];
}

const DESIRED_SCRIPTS = Object.freeze({
  dev: "nextjshx dev --",
  generate: "nextjshx generate",
  typecheck: "nextjshx typecheck",
});
const SCRIPT_NAMES: readonly InitScriptReport["name"][] = Object.freeze([
  "dev",
  "generate",
  "typecheck",
]);

interface LegacySetupMigration {
  readonly previousBytes: string;
  readonly value: { readonly [key: string]: JsonValue };
  readonly sourceRoots: readonly string[];
}

interface SetupFileSnapshot {
  readonly absolute: string;
  readonly existed: boolean;
  readonly bytes: string | null;
  readonly mode: number | null;
  postDigest?: string;
}

function isJsonObject(
  value: unknown,
): value is { readonly [key: string]: JsonValue } {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function fileStateDigest(file: string): string {
  if (!existsSync(file)) {
    return "absent";
  }
  const stats = lstatSync(file);
  if (!stats.isFile() || stats.isSymbolicLink()) {
    return stats.isSymbolicLink() ? "symbolic-link" : "non-regular";
  }
  return `file:${sha256(readFileSync(file, "utf8"))}`;
}

function setupSnapshot(file: string): SetupFileSnapshot {
  if (!existsSync(file)) {
    return {
      absolute: file,
      existed: false,
      bytes: null,
      mode: null,
    };
  }
  const stats = lstatSync(file);
  if (!stats.isFile() || stats.isSymbolicLink()) {
    return {
      absolute: file,
      existed: true,
      bytes: null,
      mode: null,
    };
  }
  return {
    absolute: file,
    existed: true,
    bytes: readFileSync(file, "utf8"),
    mode: stats.mode & 0o777,
  };
}

function markSetupMutation(snapshot: SetupFileSnapshot): void {
  snapshot.postDigest = fileStateDigest(snapshot.absolute);
}

function rollbackSetupFiles(
  root: string,
  snapshots: readonly SetupFileSnapshot[],
  createdDirectories: readonly string[],
): void {
  for (const snapshot of [...snapshots].reverse()) {
    if (snapshot.postDigest === undefined) {
      continue;
    }
    const current = fileStateDigest(snapshot.absolute);
    if (current !== snapshot.postDigest) {
      initFailure(
        "Setup cannot roll back across a concurrent file change.",
        portablePath(root, snapshot.absolute),
        snapshot.postDigest,
        current,
        "Preserve the concurrent bytes and inspect the interrupted setup before rerunning it.",
      );
    }
    if (!snapshot.existed) {
      rmSync(snapshot.absolute, { force: true });
      continue;
    }
    if (snapshot.bytes === null || snapshot.mode === null) {
      initFailure(
        "Setup cannot restore an unsupported pre-existing entry.",
        portablePath(root, snapshot.absolute),
        "a snapshotted regular file",
        "non-regular original entry",
        "Preserve the path for review; setup did not claim its ownership.",
      );
    }
    const temporary = `${snapshot.absolute}.nextjshx-rollback-${randomUUID()}.tmp`;
    let temporaryCreated = false;
    try {
      writeFileSync(temporary, snapshot.bytes, {
        encoding: "utf8",
        flag: "wx",
        mode: 0o600,
      });
      temporaryCreated = true;
      chmodSync(temporary, snapshot.mode);
      renameSync(temporary, snapshot.absolute);
      temporaryCreated = false;
    } finally {
      if (temporaryCreated) {
        rmSync(temporary, { force: true });
      }
    }
  }
  for (const directory of [...createdDirectories].sort(
    (left, right) => right.length - left.length,
  )) {
    if (!existsSync(directory)) {
      continue;
    }
    const stats = lstatSync(directory);
    if (!stats.isDirectory() || stats.isSymbolicLink()) {
      continue;
    }
    try {
      rmdirSync(directory);
    } catch {
      // Concurrent or pre-existing contents are never removed recursively.
    }
  }
}

function initiallyMissingDirectories(
  root: string,
  paths: readonly string[],
): readonly string[] {
  const missing = new Set<string>();
  for (const candidate of paths) {
    let current = path.dirname(candidate);
    while (containedBy(root, current) && current !== root) {
      if (!existsSync(current)) {
        missing.add(current);
      }
      current = path.dirname(current);
    }
  }
  return Object.freeze([...missing]);
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

function initFailure(
  message: string,
  target: string,
  expected: string,
  actual: string,
  resolution: string,
): never {
  cliFailure(
    "NXHX-CLI-INIT-0015",
    message,
    target,
    expected,
    actual,
    resolution,
  );
}

function readJsonObject(file: string): { readonly [key: string]: JsonValue } {
  // package.json is an external JSON boundary. Keep the decoded value broad
  // only until this immediate object check, then retain the closed JSON-value
  // model while inspecting the two fields setup supports.
  let decoded: unknown;
  try {
    decoded = JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    initFailure(
      "Setup cannot parse package metadata safely.",
      path.basename(file),
      "a strict JSON object",
      error instanceof Error ? error.message : "malformed JSON",
      "Repair package.json before initializing NextJsHx.",
    );
  }
  if (!isJsonObject(decoded)) {
    initFailure(
      "Setup requires object-shaped package metadata.",
      path.basename(file),
      "a JSON object",
      Array.isArray(decoded) ? "array" : typeof decoded,
      "Repair package.json before initializing NextJsHx.",
    );
  }
  return decoded;
}

function commandResult(
  runner: ProcessRunner,
  request: ProcessRequest,
  subject: string,
): ProcessResult {
  const result = runner(request);
  if (result.exitCode !== 0) {
    initFailure(
      `Init cannot verify ${subject}.`,
      request.command,
      "a successful non-interactive capability probe",
      result.stderr.trim() || `exit ${result.exitCode}`,
      `Install the pinned ${subject} capability before rerunning setup.`,
    );
  }
  return result;
}

function verifyToolchain(
  root: string,
  workspaceRoot: string,
  runtime: InitRuntime | undefined,
): void {
  const runner = runtime?.processRunner ?? runProcess;
  const haxe = runtime?.haxeCommand ?? { command: "haxe", argsPrefix: [] };
  commandResult(
    runner,
    {
      command: haxe.command,
      args: [...haxe.argsPrefix, "--version"],
      cwd: root,
      source: "haxe",
    },
    "Haxe",
  );
  commandResult(
    runner,
    {
      command: haxe.command,
      args: [
        ...haxe.argsPrefix,
        "-lib",
        "genes-ts",
        "-js",
        ".nextjshx/init-capability-probe.js",
        "--no-output",
      ],
      cwd: root,
      source: "haxe",
    },
    "genes-ts",
  );
  let sourceCheckout = false;
  try {
    const workspacePackage = readJsonObject(
      path.join(workspaceRoot, "package.json"),
    );
    const source = path.join(workspaceRoot, "src");
    sourceCheckout =
      workspacePackage.name === "nextjshx" &&
      existsSync(source) &&
      lstatSync(source).isDirectory() &&
      !lstatSync(source).isSymbolicLink();
  } catch {
    sourceCheckout = false;
  }
  if (!sourceCheckout) {
    commandResult(
      runner,
      {
        command: haxe.command,
        args: [
          ...haxe.argsPrefix,
          "-lib",
          "nextjshx",
          "-js",
          ".nextjshx/init-capability-probe.js",
          "--no-output",
        ],
        cwd: root,
        source: "haxe",
      },
      "NextJsHx Haxe library",
    );
  }
  const typescriptManifest = [root, workspaceRoot]
    .map((candidate) =>
      path.join(candidate, "node_modules/typescript/package.json"),
    )
    .find((candidate) => existsSync(candidate));
  if (typescriptManifest === undefined) {
    initFailure(
      "Setup cannot verify the TypeScript installation.",
      "typescript",
      "an installed TypeScript package in the application or workspace",
      "missing node_modules/typescript/package.json",
      "Install the project lockfile before rerunning setup.",
    );
  }
  const typescriptStats = lstatSync(typescriptManifest);
  if (!typescriptStats.isFile() || typescriptStats.isSymbolicLink()) {
    initFailure(
      "Setup refuses an unsafe TypeScript package manifest.",
      path.relative(root, typescriptManifest),
      "a real regular package.json",
      typescriptStats.isSymbolicLink() ? "symbolic link" : "non-regular entry",
      "Reinstall the project lockfile before rerunning setup.",
    );
  }
}

function legacySetupMigration(
  discovery: NextProjectDiscovery,
): LegacySetupMigration | null {
  const config = discovery.config;
  if (config === null || config.schemaVersion !== 1) {
    return null;
  }
  const migration = config.migration;
  const legacyHxml = config.haxe.legacyHxml;
  if (migration === undefined || legacyHxml === undefined) {
    initFailure(
      "Setup cannot prove the legacy compiler configuration.",
      CONFIG_FILE_NAME,
      "a supported schema-v1 migration report and HXML path",
      "migration evidence missing",
      "Restore the valid legacy config before rerunning setup.",
    );
  }
  if (migration.retainedApplicationDefines.length > 0) {
    initFailure(
      "Setup refuses to hide custom application compiler defines.",
      "$.haxe.defines",
      "only released compiler-owned Genes and NextJsHx defines",
      migration.retainedApplicationDefines.join(", "),
      "Model application intent through a typed extension in a later supported release; setup made no changes.",
    );
  }
  const hxmlPath = path.join(discovery.packageRoot, ...legacyHxml.split("/"));
  if (!existsSync(hxmlPath)) {
    initFailure(
      "Setup cannot inspect the legacy HXML.",
      legacyHxml,
      "an existing real HXML file",
      "missing",
      "Restore the build file so setup can prove effective-plan equivalence.",
    );
  }
  const stats = lstatSync(hxmlPath);
  if (stats.isSymbolicLink() || !stats.isFile()) {
    initFailure(
      "Setup refuses an unsafe legacy HXML.",
      legacyHxml,
      "a real non-symlink HXML file",
      stats.isSymbolicLink() ? "symbolic link" : "non-regular entry",
      "Replace the entry with the reviewed build file before migration.",
    );
  }
  const classPaths: string[] = [];
  let installer: string | null = null;
  let output: string | null = null;
  for (const rawLine of readFileSync(hxmlPath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === "" || line.startsWith("#")) {
      continue;
    }
    if (line === "-lib genes-ts" || line === "-lib nextjshx") {
      continue;
    }
    if (line.startsWith("-cp ")) {
      classPaths.push(line.slice(4));
      continue;
    }
    if (line.startsWith("--main ")) {
      continue;
    }
    if (line.startsWith("-js ")) {
      output = line.slice(4);
      continue;
    }
    const installMatch =
      /^--macro ([A-Za-z_][A-Za-z0-9_.]*\.AdapterPlan)\.install\([^)]*\)$/.exec(
        line,
      );
    if (installMatch !== null && installer === null) {
      installer = installMatch[1] as string;
      continue;
    }
    if (
      /^--macro include\('[A-Za-z_][A-Za-z0-9_.]*'\)$/.test(line) ||
      line === "-dce full"
    ) {
      continue;
    }
    initFailure(
      "Setup found unsupported custom HXML behavior.",
      legacyHxml,
      "libraries, classpaths, one released AdapterPlan installer, package includes, the generated output, and full DCE",
      line,
      "Keep the legacy build unchanged until the custom compiler behavior has a typed framework-neutral extension contract.",
    );
  }
  const profile = effectiveOutputProfile(config);
  const expectedOutput = `${config.haxe.generatedRoot}/index.${
    profile.language === "typescript" ? "tsx" : "jsx"
  }`;
  if (output !== expectedOutput || installer === null) {
    initFailure(
      "Setup cannot prove the legacy HXML output and planner.",
      legacyHxml,
      `${expectedOutput} and exactly one AdapterPlan installer`,
      `output ${output ?? "missing"}; installer ${installer ?? "missing"}`,
      "Restore the conventional legacy plan or migrate the custom build manually after a typed extension becomes available.",
    );
  }
  const modulePath = `${installer.split(".").join("/")}.hx`;
  const installerFile = classPaths
    .map((entry) =>
      path.resolve(discovery.packageRoot, ...entry.split("/"), modulePath),
    )
    .find((candidate) => existsSync(candidate));
  if (installerFile === undefined) {
    initFailure(
      "Setup cannot locate the legacy AdapterPlan source.",
      installer,
      "one installer module under a declared HXML classpath",
      "missing",
      "Restore the installer so setup can verify that it contains only released planners.",
    );
  }
  const installerSource = readFileSync(installerFile, "utf8");
  validateLegacyAdapterPlan(
    discovery.packageRoot,
    installerFile,
    installerSource,
  );
  const workspaceSource = path.resolve(discovery.workspaceRoot, "src");
  const sourceRoots = classPaths.filter(
    (entry) =>
      path.resolve(discovery.packageRoot, ...entry.split("/")) !==
      workspaceSource,
  );
  if (sourceRoots.length === 0) {
    sourceRoots.push("haxe");
  }
  const previousBytes =
    discovery.configPath === null
      ? ""
      : readFileSync(discovery.configPath, "utf8");
  const value: { readonly [key: string]: JsonValue } = {
    $schema: CONFIG_SCHEMA_ID,
    schemaVersion: CONFIG_SCHEMA_VERSION,
    ...(config.appRoot === undefined ? {} : { appRoot: config.appRoot }),
    ...(Object.keys(config.boundaries).length === 0
      ? {}
      : {
          boundaries: {
            ...(config.boundaries.maxDirectDependencies === undefined
              ? {}
              : {
                  maxDirectDependencies:
                    config.boundaries.maxDirectDependencies,
                }),
            ...(config.boundaries.maxObservedClientBytes === undefined
              ? {}
              : {
                  maxObservedClientBytes:
                    config.boundaries.maxObservedClientBytes,
                }),
          },
        }),
    haxe: {
      sourceRoots,
      generatedRoot: config.haxe.generatedRoot,
      ...(config.haxe.extraInputs.length === 0
        ? {}
        : { extraInputs: config.haxe.extraInputs }),
    },
    next: {
      package: config.next.package,
      ...(config.next.upstreamDir === undefined
        ? {}
        : { upstreamDir: config.next.upstreamDir }),
      typedRoutes: config.next.typedRoutes,
      ...(config.next.cacheComponents ? { cacheComponents: true } : {}),
      ...(config.next.experimentalCacheDirectives.length === 0
        ? {}
        : {
            experimentalCacheDirectives:
              config.next.experimentalCacheDirectives,
          }),
    },
    output: {
      manifest: config.output.manifest,
      format: "project",
      ...profile,
    },
  };
  return Object.freeze({
    previousBytes,
    value: Object.freeze(value),
    sourceRoots: Object.freeze(sourceRoots),
  });
}

const LEGACY_PLANNER_IMPORTS = new Set([
  "haxe.macro.Expr",
  "nextjshx.adapter.AdapterPlanRegistry",
  "nextjshx.app.PageLayoutMacro",
  "nextjshx.app.SpecialFileMacro",
  "nextjshx.boundary.EnvironmentBoundaryMacro",
  "nextjshx.cache.CacheFunctionMacro",
  "nextjshx.client.ClientComponentMacro",
  "nextjshx.mdx.MdxComponentsMacro",
  "nextjshx.route.RouteHandlerMacro",
  "nextjshx.server.ProxyMacro",
  "nextjshx.server.ServerFunctionMacro",
]);

const LEGACY_PLANNER_INSTALLERS = new Set([
  "PageLayoutMacro",
  "SpecialFileMacro",
  "EnvironmentBoundaryMacro",
  "ClientComponentMacro",
  "ServerFunctionMacro",
  "RouteHandlerMacro",
  "CacheFunctionMacro",
  "ProxyMacro",
  "MdxComponentsMacro",
]);

/**
 * Removes Haxe comments while preserving quoted strings and line boundaries.
 *
 * Migration deliberately accepts only the historical, declarative installer
 * shape. A lexical pass is enough here because the remaining source is checked
 * against a closed grammar rather than interpreted or executed.
 */
function stripHaxeComments(source: string): string {
  let result = "";
  let index = 0;
  let quote: '"' | "'" | null = null;
  let escaped = false;
  while (index < source.length) {
    const current = source[index] as string;
    const next = source[index + 1];
    if (quote !== null) {
      result += current;
      if (escaped) {
        escaped = false;
      } else if (current === "\\") {
        escaped = true;
      } else if (current === quote) {
        quote = null;
      }
      index += 1;
      continue;
    }
    if (current === '"' || current === "'") {
      quote = current;
      result += current;
      index += 1;
      continue;
    }
    if (current === "/" && next === "/") {
      index += 2;
      while (index < source.length && source[index] !== "\n") {
        index += 1;
      }
      continue;
    }
    if (current === "/" && next === "*") {
      index += 2;
      while (
        index < source.length &&
        !(source[index] === "*" && source[index + 1] === "/")
      ) {
        if (source[index] === "\n") {
          result += "\n";
        }
        index += 1;
      }
      index += 2;
      continue;
    }
    result += current;
    index += 1;
  }
  return result;
}

function validateLegacyAdapterPlan(
  packageRoot: string,
  installerFile: string,
  source: string,
): void {
  const target = portablePath(packageRoot, installerFile);
  let remaining = stripHaxeComments(source);
  const fail = (actual: string): never =>
    initFailure(
      "Setup found unsupported custom AdapterPlan behavior.",
      target,
      "only the historical package/import wrapper, one literal AdapterPlanRegistry.install call, released zero-argument planner installs, and return macro null",
      actual,
      "Keep the authored plan until its reusable capability is modeled explicitly; setup made no changes.",
    );

  const imports = [
    ...remaining.matchAll(/\bimport\s+([A-Za-z_][A-Za-z0-9_.]*)\s*;/g),
  ].map((match) => match[1] as string);
  const unsupportedImports = imports.filter(
    (name) => !LEGACY_PLANNER_IMPORTS.has(name),
  );
  if (unsupportedImports.length > 0) {
    fail(`unsupported imports: ${unsupportedImports.join(", ")}`);
  }
  remaining = remaining.replace(/\bimport\s+[A-Za-z_][A-Za-z0-9_.]*\s*;/g, "");

  const registryPattern =
    /\bAdapterPlanRegistry\.install\(\s*("(?:\\.|[^"\\])*")\s*,\s*("(?:\\.|[^"\\])*")\s*,\s*("(?:\\.|[^"\\])*")\s*,\s*("(?:\\.|[^"\\])*")\s*,\s*("(?:\\.|[^"\\])*")\s*\)\s*;/g;
  const registryCalls = [...remaining.matchAll(registryPattern)];
  if (registryCalls.length !== 1) {
    fail(
      `AdapterPlanRegistry.install call count ${registryCalls.length}; expected 1`,
    );
  }
  const registryValues = registryCalls[0]
    ?.slice(1)
    .map((value) => JSON.parse(value as string) as string);
  const expectedRegistryValues = [
    ".nextjshx/default-plan.json",
    NEXTJSHX_VERSION,
    HAXE_VERSION,
    GENES_TS_IDENTITY,
    NEXT_VERSION,
  ];
  if (
    registryValues === undefined ||
    registryValues.some(
      (value, index) => value !== expectedRegistryValues[index],
    )
  ) {
    fail(
      `AdapterPlanRegistry.install arguments ${JSON.stringify(registryValues)}`,
    );
  }
  remaining = remaining.replace(registryPattern, "");

  const plannerPattern = /\b([A-Z][A-Za-z0-9_]*)\.install\(\s*\)\s*;/g;
  const planners = [...remaining.matchAll(plannerPattern)].map(
    (match) => match[1] as string,
  );
  const unsupportedPlanners = planners.filter(
    (name) => !LEGACY_PLANNER_INSTALLERS.has(name),
  );
  const duplicatePlanners = planners.filter(
    (name, index) => planners.indexOf(name) !== index,
  );
  if (unsupportedPlanners.length > 0 || duplicatePlanners.length > 0) {
    fail(
      unsupportedPlanners.length > 0
        ? `unsupported planners: ${unsupportedPlanners.join(", ")}`
        : `duplicate planners: ${[...new Set(duplicatePlanners)].join(", ")}`,
    );
  }
  remaining = remaining.replace(plannerPattern, "");

  remaining = remaining
    .replace(/\bpackage\s+[A-Za-z_][A-Za-z0-9_.]*\s*;/, "")
    .replace(/#if\s+macro\b/, "")
    .replace(/#end\b/, "")
    .replace(/\bclass\s+AdapterPlan\s*\{/, "")
    .replace(
      /\b(?:public\s+static\s+)?macro\s+function\s+install\s*\(\s*\)\s*:\s*Expr\s*\{/,
      "",
    )
    .replace(/\breturn\s+macro\s+null\s*;/, "")
    .replace(/[{}]/g, "")
    .trim();
  if (remaining !== "") {
    fail(remaining.replace(/\s+/g, " ").slice(0, 200));
  }
}

function portablePath(root: string, file: string): string {
  return path.relative(root, file).split(path.sep).join("/");
}

function templateFiles(
  appRoot: string,
  createExample: boolean,
  typedRoutes: boolean,
): ReadonlyMap<string, string> {
  const values = new Map<string, string>([
    [
      CONFIG_FILE_NAME,
      `${JSON.stringify(
        {
          $schema: CONFIG_SCHEMA_ID,
          schemaVersion: CONFIG_SCHEMA_VERSION,
          appRoot,
          haxe: {
            sourceRoots: ["haxe"],
            generatedRoot: "src-gen",
          },
          next: { package: "next", typedRoutes },
          output: {
            manifest: ".nextjshx/manifest.json",
            format: "project",
            language: "typescript",
            intent: "reviewable",
            profileVersion: 1,
            sourceMaps: "external",
            sourcesContent: true,
            declarations: "public",
            jsxRuntime: "automatic",
          },
        },
        null,
        2,
      )}\n`,
    ],
  ]);
  if (createExample) {
    values.set(
      "haxe/nextjshx_app/HomePage.hx",
      [
        "package nextjshx_app;",
        "",
        "import genes.react.Element;",
        "import nextjs.app.PageProps;",
        "import nextjs.route.NoParams;",
        "import nextjs.route.SearchParams;",
        "",
        "/**",
        " * Owns the generated root App Router page as an ordinary module function.",
        " * NextJsHx validates the props/HXX contract and emits a narrow page.tsx",
        " * adapter; Next remains the router, renderer, bundler, and runtime.",
        " */",
        '@:next.page("")',
        "function render(_:PageProps<NoParams, SearchParams>):Element {",
        '\treturn <main><h1>Welcome to NextJsHx</h1><p>Edit haxe/nextjshx_app/HomePage.hx to begin.</p></main>;',
        "}",
        "",
      ].join("\n"),
    );
  }
  return values;
}

function fileReport(
  root: string,
  relative: string,
  content: string,
): InitFileReport {
  const absolute = path.join(root, ...relative.split("/"));
  if (existsSync(absolute)) {
    const stats = lstatSync(absolute);
    if (!stats.isFile() || stats.isSymbolicLink()) {
      return Object.freeze({
        path: relative,
        action: "preserved",
        reason: stats.isSymbolicLink()
          ? "existing symbolic link"
          : "existing non-regular entry",
      });
    }
    const existing = readFileSync(absolute, "utf8");
    return Object.freeze({
      path: relative,
      action: existing === content ? "unchanged" : "preserved",
      reason:
        existing === content
          ? "already matches the initializer"
          : "existing authored bytes differ",
    });
  }
  let parent = root;
  for (const segment of relative.split("/").slice(0, -1)) {
    parent = path.join(parent, segment);
    if (existsSync(parent)) {
      const stats = lstatSync(parent);
      if (stats.isSymbolicLink() || !stats.isDirectory()) {
        return Object.freeze({
          path: relative,
          action: "preserved",
          reason: `${path.relative(root, parent)} is ${
            stats.isSymbolicLink() ? "a symbolic link" : "not a directory"
          }`,
        });
      }
    } else {
      mkdirSync(parent, { mode: 0o755 });
    }
  }
  let descriptor: number;
  try {
    descriptor = openSync(
      absolute,
      constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY,
      0o644,
    );
  } catch (error) {
    initFailure(
      "An initializer target appeared before its exclusive create.",
      relative,
      "an absent path",
      error instanceof Error ? error.message : "filesystem collision",
      "Preserve the concurrent entry, inspect it, and rerun setup.",
    );
  }
  try {
    writeFileSync(descriptor, content, "utf8");
  } finally {
    closeSync(descriptor);
  }
  return Object.freeze({
    path: relative,
    action: "created",
    reason: "path was absent",
  });
}

function scriptPatch(packageJson: { readonly [key: string]: JsonValue }): {
  readonly reports: readonly InitScriptReport[];
  readonly updated: { readonly [key: string]: JsonValue };
  readonly changed: boolean;
} {
  if (packageJson.scripts !== undefined && !isJsonObject(packageJson.scripts)) {
    initFailure(
      "Setup cannot patch non-object package scripts.",
      "package.json#scripts",
      "an object of script names to command strings",
      Array.isArray(packageJson.scripts) ? "array" : typeof packageJson.scripts,
      "Repair the scripts field before rerunning setup; no package metadata was changed.",
    );
  }
  const currentScripts = isJsonObject(packageJson.scripts)
    ? packageJson.scripts
    : {};
  const nextScripts: { [key: string]: JsonValue } = { ...currentScripts };
  const reports: InitScriptReport[] = [];
  let changed = false;
  for (const name of SCRIPT_NAMES) {
    const proposed = DESIRED_SCRIPTS[name];
    const current = currentScripts[name];
    if (current === undefined) {
      nextScripts[name] = proposed;
      changed = true;
      reports.push({
        name,
        action: "added",
        previous: null,
        proposed,
      });
    } else if (current === proposed) {
      reports.push({
        name,
        action: "unchanged",
        previous: current,
        proposed,
      });
    } else {
      reports.push({
        name,
        action: "preserved",
        previous:
          typeof current === "string" ? current : JSON.stringify(current),
        proposed,
      });
    }
  }
  return Object.freeze({
    reports: Object.freeze(reports),
    updated: Object.freeze({ ...packageJson, scripts: nextScripts }),
    changed,
  });
}

function atomicJsonPatch(
  file: string,
  previousBytes: string,
  value: { readonly [key: string]: JsonValue },
  uuid: () => string,
): void {
  const previousMode = lstatSync(file).mode & 0o777;
  if (sha256(readFileSync(file, "utf8")) !== sha256(previousBytes)) {
    initFailure(
      "package.json changed during setup.",
      "package.json",
      sha256(previousBytes),
      "different current bytes",
      "Preserve the concurrent edit and rerun setup.",
    );
  }
  const temporary = `${file}.nextjshx-${uuid()}.tmp`;
  let temporaryCreated = false;
  try {
    writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, {
      encoding: "utf8",
      flag: "wx",
      mode: 0o600,
    });
    temporaryCreated = true;
    if (sha256(readFileSync(file, "utf8")) !== sha256(previousBytes)) {
      initFailure(
        "package.json changed before the initialization patch was published.",
        "package.json",
        sha256(previousBytes),
        "different current bytes",
        "Preserve the concurrent edit and rerun setup.",
      );
    }
    chmodSync(temporary, previousMode);
    renameSync(temporary, file);
  } finally {
    if (temporaryCreated) {
      rmSync(temporary, { force: true });
    }
  }
}

function gitignoreReport(
  root: string,
  generatedRoot: string,
  uuid: () => string,
): InitFileReport {
  const relative = ".gitignore";
  const absolute = path.join(root, relative);
  const required = [".next/", ".nextjshx/", `${generatedRoot}/`];
  if (existsSync(absolute)) {
    const stats = lstatSync(absolute);
    if (stats.isSymbolicLink() || !stats.isFile()) {
      return Object.freeze({
        path: relative,
        action: "preserved",
        reason: stats.isSymbolicLink()
          ? "existing symbolic link"
          : "existing non-regular entry",
      });
    }
  }
  const previous = existsSync(absolute) ? readFileSync(absolute, "utf8") : "";
  const previousMode = existsSync(absolute)
    ? lstatSync(absolute).mode & 0o777
    : 0o644;
  const present = new Set(previous.split(/\r?\n/).map((line) => line.trim()));
  const missing = required.filter((entry) => !present.has(entry));
  if (missing.length === 0) {
    return Object.freeze({
      path: relative,
      action: "unchanged",
      reason: "all generated roots are ignored",
    });
  }
  const separator =
    previous.length === 0 ? "" : previous.endsWith("\n") ? "\n" : "\n\n";
  const block = `${separator}# NextJsHx generated and transactional output\n${missing.join("\n")}\n`;
  const temporary = `${absolute}.nextjshx-${uuid()}.tmp`;
  let temporaryCreated = false;
  try {
    writeFileSync(temporary, `${previous}${block}`, {
      encoding: "utf8",
      flag: "wx",
      mode: 0o600,
    });
    temporaryCreated = true;
    const current = existsSync(absolute) ? readFileSync(absolute, "utf8") : "";
    if (current !== previous) {
      initFailure(
        ".gitignore changed during setup.",
        relative,
        sha256(previous),
        sha256(current),
        "Preserve the concurrent edit and rerun setup.",
      );
    }
    chmodSync(temporary, previousMode);
    renameSync(temporary, absolute);
  } finally {
    if (temporaryCreated) {
      rmSync(temporary, { force: true });
    }
  }
  return Object.freeze({
    path: relative,
    action: previous.length === 0 ? "created" : "updated",
    reason: `added ${missing.join(", ")}`,
  });
}

function typedRoutesReport(
  root: string,
  requested: boolean,
): {
  readonly status: InitCommandResult["typedRoutes"];
  readonly file: InitFileReport | null;
} {
  if (!requested) {
    return Object.freeze({ status: "disabled", file: null });
  }
  const candidates = [
    "next.config.js",
    "next.config.mjs",
    "next.config.ts",
    "next.config.mts",
  ];
  const existing = candidates.filter((candidate) =>
    existsSync(path.join(root, candidate)),
  );
  if (existing.length === 0) {
    const relative = "next.config.mjs";
    return Object.freeze({
      status: "enabled",
      file: fileReport(
        root,
        relative,
        "const nextConfig = {\n  typedRoutes: true,\n};\n\nexport default nextConfig;\n",
      ),
    });
  }
  return Object.freeze({
    status: "manual",
    file: Object.freeze({
      path: existing.join(", "),
      action: "preserved",
      reason:
        "existing executable Next config requires a manual reviewed typedRoutes patch",
    }),
  });
}

function ensureSourceRoots(
  root: string,
  workspaceRoot: string,
  roots: readonly string[],
): void {
  for (const relative of roots) {
    const resolved = path.resolve(root, ...relative.split("/"));
    const workspaceRelative = path.relative(workspaceRoot, resolved);
    if (
      workspaceRelative === ".." ||
      workspaceRelative.startsWith(`..${path.sep}`) ||
      path.isAbsolute(workspaceRelative)
    ) {
      initFailure(
        "Setup refuses a Haxe source root outside the discovered workspace.",
        relative,
        "a workspace-contained source directory",
        resolved,
        "Move the source into the workspace or configure the correct application package.",
      );
    }
    let current = root;
    for (const segment of relative.split("/")) {
      current = path.join(current, segment);
      if (existsSync(current)) {
        const stats = lstatSync(current);
        if (stats.isSymbolicLink() || !stats.isDirectory()) {
          initFailure(
            "Setup refuses an unsafe Haxe source root.",
            relative,
            "a real project-contained directory",
            stats.isSymbolicLink() ? "symbolic link" : "non-directory entry",
            "Replace the blocking entry before setup; no source path is followed implicitly.",
          );
        }
      } else {
        mkdirSync(current, { mode: 0o755 });
      }
    }
  }
}

export function runInitCommand(options: InitCommandOptions): InitCommandResult {
  const discovery = discoverNextProject(options.start, {
    requireConfig: false,
  });
  if (discovery.config !== null) {
    // Parsing during discovery proves an existing config is valid. Init remains
    // useful for idempotently filling absent scripts and ignore entries.
  }
  const tsconfig = path.join(discovery.packageRoot, "tsconfig.json");
  if (!existsSync(tsconfig) || !lstatSync(tsconfig).isFile()) {
    initFailure(
      "Setup requires an existing TypeScript Next.js application.",
      "tsconfig.json",
      "a real regular TypeScript project file",
      "missing or non-regular",
      "Initialize the Next.js App Router TypeScript application first.",
    );
  }
  verifyToolchain(
    discovery.packageRoot,
    discovery.workspaceRoot,
    options.runtime,
  );

  const packageStats = lstatSync(discovery.packageJsonPath);
  if (packageStats.isSymbolicLink() || !packageStats.isFile()) {
    initFailure(
      "Setup refuses unsafe package metadata.",
      "package.json",
      "a real regular file",
      packageStats.isSymbolicLink() ? "symbolic link" : "non-regular entry",
      "Replace the entry with reviewed package metadata inside the application.",
    );
  }
  const packageBytes = readFileSync(discovery.packageJsonPath, "utf8");
  const packageJson = readJsonObject(discovery.packageJsonPath);
  const scripts = scriptPatch(packageJson);
  const migrationPlan = legacySetupMigration(discovery);
  const sourceRoots = migrationPlan?.sourceRoots ??
    discovery.config?.haxe.sourceRoots ?? ["haxe"];
  const hasNativePage = ["js", "jsx", "ts", "tsx"].some((extension) =>
    existsSync(path.join(discovery.appRoot, `page.${extension}`)),
  );
  const trackedPaths = [
    discovery.packageJsonPath,
    path.join(discovery.packageRoot, CONFIG_FILE_NAME),
    path.join(discovery.packageRoot, ".gitignore"),
    path.join(discovery.packageRoot, "next.config.mjs"),
    path.join(discovery.packageRoot, "haxe/nextjshx_app/HomePage.hx"),
  ];
  const snapshots = new Map(
    trackedPaths.map((file) => [file, setupSnapshot(file)]),
  );
  const sourceRootMarkers = sourceRoots.map((relative) =>
    path.join(
      path.resolve(discovery.packageRoot, ...relative.split("/")),
      ".nextjshx-source-root",
    ),
  );
  const createdDirectories = initiallyMissingDirectories(
    discovery.workspaceRoot,
    [
      ...trackedPaths,
      ...sourceRootMarkers,
      path.join(discovery.packageRoot, ".nextjshx/toolchain/nextjshx.hxml"),
    ],
  );
  const uuid = options.runtime?.uuid ?? randomUUID;
  const mark = (file: string): void => {
    const snapshot = snapshots.get(file);
    if (snapshot === undefined) {
      throw new Error(`setup mutation lacks snapshot: ${file}`);
    }
    markSetupMutation(snapshot);
  };

  try {
    ensureSourceRoots(
      discovery.packageRoot,
      discovery.workspaceRoot,
      sourceRoots,
    );
    const typedRoutes: ReturnType<typeof typedRoutesReport> =
      options.typedRoutes === true &&
      discovery.config !== null &&
      discovery.config.next.typedRoutes === false
        ? Object.freeze({
            status: "manual",
            file: null,
          })
        : typedRoutesReport(
            discovery.packageRoot,
            options.typedRoutes ?? false,
          );
    if (typedRoutes.file?.action === "created") {
      mark(path.join(discovery.packageRoot, "next.config.mjs"));
    }
    const templates =
      discovery.config === null
        ? templateFiles(
            discovery.appRootRelative,
            !hasNativePage,
            typedRoutes.status === "enabled",
          )
        : new Map<string, string>();
    const files = [...templates].map(([relative, content]) => {
      const report = fileReport(discovery.packageRoot, relative, content);
      if (report.action === "created") {
        mark(path.join(discovery.packageRoot, ...relative.split("/")));
      }
      return report;
    });
    if (
      discovery.config !== null &&
      discovery.configPath !== null &&
      migrationPlan === null
    ) {
      files.push(
        Object.freeze({
          path: path.relative(discovery.packageRoot, discovery.configPath),
          action: "unchanged",
          reason: "existing valid NextJsHx configuration",
        }),
      );
    }
    const ignore = gitignoreReport(
      discovery.packageRoot,
      discovery.config?.haxe.generatedRoot ?? "src-gen",
      uuid,
    );
    files.push(ignore);
    if (ignore.action === "created" || ignore.action === "updated") {
      mark(path.join(discovery.packageRoot, ".gitignore"));
    }
    if (typedRoutes.file !== null) {
      files.push(typedRoutes.file);
    }
    if (migrationPlan !== null) {
      if (discovery.configPath === null) {
        throw new Error("legacy setup migration lost its config path");
      }
      atomicJsonPatch(
        discovery.configPath,
        migrationPlan.previousBytes,
        migrationPlan.value,
        uuid,
      );
      mark(discovery.configPath);
      files.push(
        Object.freeze({
          path: path.relative(discovery.packageRoot, discovery.configPath),
          action: "updated",
          reason:
            "schema-v1 effective plan migrated to schema-v2 application intent",
        }),
      );
    }
    if (scripts.changed) {
      atomicJsonPatch(
        discovery.packageJsonPath,
        packageBytes,
        scripts.updated,
        uuid,
      );
      mark(discovery.packageJsonPath);
    }
    options.runtime?.faultInjector?.("before-toolchain");
    const configured = discoverNextProject(discovery.packageRoot, {
      requireConfig: true,
    });
    const toolchain = ensureCompilerToolchain(configured, { uuid });
    for (const relative of toolchain.files) {
      files.push(
        Object.freeze({
          path: `.nextjshx/toolchain/${relative}`,
          action:
            toolchain.action === "unchanged"
              ? "unchanged"
              : toolchain.action === "created"
                ? "created"
                : "updated",
          reason:
            "compiler-owned toolchain synthesized from application intent",
        }),
      );
    }
    const preserved = files.filter((file) => file.action === "preserved");
    const created =
      files.some(
        (file) => file.action === "created" || file.action === "updated",
      ) || scripts.changed;
    const manager = discovery.packageManager.name;
    return Object.freeze({
      command: options.command ?? "setup",
      projectRoot: discovery.packageRoot,
      packageManager: manager,
      appRoot: discovery.appRootRelative,
      action:
        preserved.length > 0
          ? "partial"
          : created
            ? "initialized"
            : "unchanged",
      files: Object.freeze(files),
      scripts: scripts.reports,
      typedRoutes: typedRoutes.status,
      followUp: Object.freeze([
        `${manager} run generate`,
        `${manager} run typecheck`,
        `${manager} run dev`,
      ]),
    });
  } catch (error) {
    rollbackSetupFiles(
      discovery.packageRoot,
      [...snapshots.values()],
      createdDirectories,
    );
    throw error;
  }
}
