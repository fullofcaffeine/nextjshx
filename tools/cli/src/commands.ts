import { createHash, randomUUID } from "node:crypto";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmdirSync,
  rmSync,
  statSync,
  type Dirent,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

import ts from "typescript";

import {
  type AdapterIntent,
  type AdapterPlan,
  readAdapterPlan,
} from "./adapter-plan.js";
import { type BoundaryPlan, readBoundaryPlan } from "./boundary-plan.js";
import { effectiveHaxeDefines, effectiveOutputProfile } from "./config.js";
import {
  mdxComponentsOutputPathForAppRoot,
  proxyOutputPathForAppRoot,
  renderAdapterPlan,
} from "./adapter-renderer.js";
import { CliDiagnosticError, cliFailure } from "./cli-diagnostic.js";
import { adapterImplementationDigests } from "./dev-generated-tree.js";
import { type NextProjectDiscovery, discoverNextProject } from "./discovery.js";
import {
  parseGeneratedOutputManifest,
  type GeneratedOutputManifest,
} from "./manifest.js";
import { inspectNextClientArtifacts } from "./next-client-artifacts.js";
import { formatGeneratedOutput } from "./output-formatter.js";
import type { PlannedGeneratedOutput } from "./ownership-preflight.js";
import {
  type OwnershipTransferOperation,
  preflightGeneratedOutputs,
} from "./ownership-preflight.js";
import {
  type PublicationFaultPoint,
  type PublicationResult,
  type RecoveryResult,
  publishGeneratedOutputs,
  recoverGeneratedOutputPublication,
} from "./publisher.js";
import {
  type ProcessRequest,
  type ProcessResult,
  type ProcessRunner,
  processOutput,
  runProcess,
} from "./process.js";
import {
  routeShape,
  type RouteInterceptionReport,
  type RouteParameterKind,
  type RouteParameterReport,
  type RouteShape,
  type RouteTopology,
} from "./route-topology.js";
import { createHaxeWatchPlan } from "./watch-inputs.js";
import {
  GENES_TS_IDENTITY,
  HAXE_VERSION,
  NEXT_UPSTREAM_COMMIT,
  NEXT_UPSTREAM_VERSION,
  NEXT_VERSION,
  NEXTJSHX_VERSION,
  REACT_VERSION,
  TYPESCRIPT_VERSION,
} from "./toolchain-identities.js";
import { ensureCompilerToolchain } from "./toolchain.js";

export type {
  RouteInterceptionReport,
  RouteParameterKind,
  RouteParameterReport,
  RouteTopology,
} from "./route-topology.js";

export { NEXTJSHX_VERSION };
const PLAN_DEFINE = "nextjshx.adapter-plan-output";
const BOUNDARY_PLAN_DEFINE = "nextjshx.boundary-plan-output";
const APP_ROOT_DEFINE = "nextjshx.app-root";
const GENERATED_ROOT_DEFINE = "nextjshx.generated-root";
const CACHE_COMPONENTS_DEFINE = "nextjshx.cache-components";
const PRIVATE_CACHE_DEFINE = "nextjshx.experimental.cache-private";
const REMOTE_CACHE_DEFINE = "nextjshx.experimental.cache-remote";
const PLAN_DIRECTORY = ".nextjshx/plans";
const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const NEXT_BUILD_BOOLEAN_FLAGS = new Set([
  "--debug",
  "--experimental-analyze",
  "--experimental-cpu-prof",
  "--experimental-debug-memory-usage",
  "--experimental-next-config-strip-types",
  "--no-mangling",
  "--profile",
  "--turbo",
  "--turbopack",
  "--webpack",
  "-d",
]);
const NEXT_BUILD_BUNDLER_FLAGS = new Set([
  "--turbo",
  "--turbopack",
  "--webpack",
]);
const RESERVED_GENERATED_ROOTS = [
  ".git",
  ".next",
  ".nextjshx",
  "app",
  "node_modules",
  "pages",
  "public",
  "src/pages",
] as const;
const DEFAULT_APP_ROUTE_EXTENSIONS = new Set(["js", "jsx", "ts", "tsx"]);

export interface ToolCommand {
  readonly command: string;
  readonly argsPrefix: readonly string[];
}

export interface CommandRuntime {
  readonly processRunner?: ProcessRunner;
  readonly gitCommand?: ToolCommand;
  readonly haxeCommand?: ToolCommand;
  readonly nextCommand?: ToolCommand;
  readonly typescriptCommand?: ToolCommand;
  readonly uuid?: () => string;
}

export interface CommandBaseOptions {
  readonly start: string;
  readonly configPath?: string;
  readonly runtime?: CommandRuntime;
}

export interface DevelopmentProject {
  readonly discovery: NextProjectDiscovery;
  readonly projectRoot: string;
  readonly hxmlPath: string;
  readonly manifestPath: string;
  readonly haxeCommand: ToolCommand;
  readonly nextCommand: ToolCommand;
}

export interface LastGoodGeneratedTree {
  readonly ok: boolean;
  readonly reason: string;
  readonly manifestGeneration: string | null;
  readonly generatedEntries: number;
}

export interface GenerateCommandOptions extends CommandBaseOptions {
  readonly validate?: boolean;
}

export interface GenerateCommandResult {
  readonly command: "generate";
  readonly projectRoot: string;
  readonly recovery: RecoveryResult;
  readonly publication: PublicationResult;
  readonly blocked: readonly string[];
  readonly validation: "passed" | "skipped";
}

export interface CleanCommandResult {
  readonly command: "clean";
  readonly projectRoot: string;
  readonly recovery: RecoveryResult;
  readonly action: "cleaned" | "no-manifest" | "already-empty";
  readonly removed: readonly string[];
  readonly retainedManifest: boolean;
}

export interface CleanCommandOptions extends CommandBaseOptions {
  /** @internal Deterministic crash injection for the command-level recovery corpus. */
  readonly faultInjector?: (point: PublicationFaultPoint) => void;
}

export interface OwnershipTransferCommandOptions extends CommandBaseOptions {
  readonly operation: OwnershipTransferOperation;
  readonly path: string;
  /** @internal Deterministic crash injection for the recovery corpus. */
  readonly faultInjector?: (point: PublicationFaultPoint) => void;
}

export interface OwnershipTransferCommandResult {
  readonly command: OwnershipTransferOperation;
  readonly projectRoot: string;
  readonly path: string;
  readonly recovery: RecoveryResult;
  readonly publication: PublicationResult;
  readonly validation: "passed";
}

export interface BuildCommandOptions extends CommandBaseOptions {
  readonly nextArgs?: readonly string[];
}

export interface BuildCommandResult {
  readonly command: "build";
  readonly projectRoot: string;
  readonly doctor: "passed";
  readonly cleanedGeneratedEntries: number;
  readonly generatedEntries: number;
  readonly generation: GenerateCommandResult;
  readonly nextArguments: readonly string[];
  readonly nextBuild: "passed";
  readonly manifestGeneration: string;
  readonly verifiedOutputs: number;
  readonly nextOutput: string;
}

export interface TypecheckCommandResult {
  readonly command: "typecheck";
  readonly projectRoot: string;
  readonly recovery: RecoveryResult;
  readonly planned: Readonly<
    Record<"create" | "update" | "unchanged" | "remove", readonly string[]>
  >;
  readonly nextTypegen: "passed";
  readonly typescript: "passed";
}

export type RouteOrigin = "haxe" | "native";

export type RouteOwnershipStatus =
  | "planned"
  | "owned-current"
  | "owned-update"
  | "owned-modified"
  | "owned-missing"
  | "native"
  | "native-collision"
  | "unsafe";

export interface RouteReport {
  readonly origin: RouteOrigin;
  readonly source: string;
  readonly kind: AdapterIntent["kind"];
  readonly segmentPath: string;
  readonly targetPath: string;
  readonly filesystemPath: string;
  readonly publicPattern: string;
  readonly topology: RouteTopology;
  readonly parallelSlots: readonly string[];
  readonly interception: RouteInterceptionReport | null;
  readonly parameters: readonly RouteParameterReport[];
  readonly ownership: RouteOwnershipStatus;
  readonly parity: "accepted" | "not-checked";
}

export interface RoutesCommandOptions extends CommandBaseOptions {
  readonly check?: boolean;
}

export interface RoutesCommandResult {
  readonly command: "routes";
  readonly projectRoot: string;
  readonly recovery: RecoveryResult;
  readonly routes: readonly RouteReport[];
}

export interface BoundaryWarning {
  readonly code: "NXHX-BOUNDARY-BUDGET-0001";
  readonly owner: string;
  readonly evidence: "haxe-known" | "next-observed";
  readonly actual: number;
  readonly budget: number;
  readonly unit: "direct-dependencies" | "bytes";
  readonly remediation: string;
}

export interface BoundaryReport {
  readonly evidence: "haxe-known";
  readonly owner: string;
  readonly moduleName: string;
  readonly classification: BoundaryPlan["boundaries"][number]["kind"];
  readonly source: BoundaryPlan["boundaries"][number]["position"];
  readonly generatedTarget: string | null;
  readonly propsContract: string | null;
  readonly references: BoundaryPlan["boundaries"][number]["references"];
  readonly dependencies: BoundaryPlan["boundaries"][number]["dependencies"];
  readonly nextArtifacts: {
    readonly evidence: "next-observed" | "unavailable";
    readonly reason: string;
    readonly chunks: readonly string[];
    readonly bytes: number | null;
    readonly manifests: readonly string[];
  };
  readonly warnings: readonly BoundaryWarning[];
}

export interface BoundariesCommandResult {
  readonly command: "boundaries";
  readonly projectRoot: string;
  readonly evidence: {
    readonly haxe: "complete";
    readonly next: "all-client-adapters-observed" | "partial" | "unavailable";
  };
  readonly boundaries: readonly BoundaryReport[];
  readonly warnings: readonly BoundaryWarning[];
}

export type DoctorCheckStatus = "pass" | "warn" | "fail" | "info";
export type DoctorCheckCode =
  | "NXHX-DOCTOR-NODE-0001"
  | "NXHX-DOCTOR-HAXE-0002"
  | "NXHX-DOCTOR-NEXT-0003"
  | "NXHX-DOCTOR-PACKAGES-0004"
  | "NXHX-DOCTOR-APP-ROOT-0005"
  | "NXHX-DOCTOR-MANIFEST-0006"
  | "NXHX-DOCTOR-TRANSACTION-0007"
  | "NXHX-DOCTOR-TSCONFIG-0008"
  | "NXHX-DOCTOR-SCRIPTS-0009"
  | "NXHX-DOCTOR-PLAN-0010"
  | "NXHX-DOCTOR-UPSTREAM-0011"
  | "NXHX-DOCTOR-UNSUPPORTED-0012";

export interface DoctorCheck {
  readonly code: DoctorCheckCode;
  readonly status: DoctorCheckStatus;
  readonly subject: string;
  readonly actual: string;
  readonly resolution: string;
}

export interface DoctorCommandResult {
  readonly command: "doctor";
  readonly projectRoot: string;
  readonly ok: boolean;
  readonly checks: readonly DoctorCheck[];
}

interface ProjectContext {
  readonly discovery: NextProjectDiscovery;
  readonly config: NonNullable<NextProjectDiscovery["config"]>;
  readonly hxmlPath: string;
  readonly manifestPath: string;
}

interface CompilationPlans {
  readonly adapter: AdapterPlan;
  readonly boundary: BoundaryPlan;
}

interface ValidationResult {
  readonly next: ProcessResult;
  readonly typescript: ProcessResult;
}

function runtimeValue(
  runtime: CommandRuntime | undefined,
): Required<Pick<CommandRuntime, "processRunner" | "uuid">> & CommandRuntime {
  return {
    ...runtime,
    processRunner: runtime?.processRunner ?? runProcess,
    uuid: runtime?.uuid ?? randomUUID,
  };
}

function projectContext(options: CommandBaseOptions): ProjectContext {
  const discovery = discoverNextProject(options.start, {
    requireConfig: true,
    ...(options.configPath === undefined
      ? {}
      : { configPath: options.configPath }),
  });
  if (discovery.config === null || discovery.configuredPaths === null) {
    cliFailure(
      "NXHX-CLI-USAGE-0001",
      "This command requires nextjshx.config.json.",
      discovery.packageRoot,
      "a valid schema-v2 config or supported schema-v1 migration input at the package root",
      "config missing after required discovery",
      "Run nextjshx setup or add the documented declarative config.",
    );
  }
  const toolchain = ensureCompilerToolchain(discovery, {
    ...(options.runtime?.uuid === undefined
      ? {}
      : { uuid: options.runtime.uuid }),
  });
  return Object.freeze({
    discovery,
    config: discovery.config,
    hxmlPath: toolchain.hxmlPath,
    manifestPath: discovery.configuredPaths.manifest,
  });
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

function portablePathOverlaps(left: string, right: string): boolean {
  return (
    left === right ||
    left.startsWith(`${right}/`) ||
    right.startsWith(`${left}/`)
  );
}

class GeneratedRootSafetyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GeneratedRootSafetyError";
  }
}

interface GeneratedRootInspection {
  readonly entries: number;
  readonly present: boolean;
}

function generatedRootSafetyError(message: string): never {
  throw new GeneratedRootSafetyError(message);
}

function inspectGeneratedRoot(
  context: ProjectContext,
): GeneratedRootInspection {
  const configured = context.discovery.configuredPaths;
  if (configured === null) {
    generatedRootSafetyError("the configured generated root is unresolved");
  }
  const relative = context.config.haxe.generatedRoot;
  if (
    portablePathOverlaps(relative, context.discovery.appRootRelative) ||
    RESERVED_GENERATED_ROOTS.some((reserved) =>
      portablePathOverlaps(relative, reserved),
    )
  ) {
    generatedRootSafetyError(
      `${relative} overlaps an application, dependency, framework, public, or control root`,
    );
  }

  const protectedInputs = [
    ["Haxe build", context.hxmlPath],
    ["ownership manifest", context.manifestPath],
    ["package manifest", context.discovery.packageJsonPath],
    ...(context.discovery.configPath === null
      ? []
      : [["NextJsHx config", context.discovery.configPath]]),
    [
      "TypeScript config",
      path.join(context.discovery.packageRoot, "tsconfig.json"),
    ],
  ] as const;
  for (const [label, candidate] of protectedInputs) {
    if (containedBy(configured.generatedRoot, candidate)) {
      generatedRootSafetyError(`${relative} contains the protected ${label}`);
    }
  }

  const canonicalProject = realpathSync.native(context.discovery.packageRoot);
  const segments = relative.split("/");
  let current = context.discovery.packageRoot;
  for (const segment of segments) {
    current = path.join(current, segment);
    let stats;
    try {
      stats = lstatSync(current);
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { readonly code?: string }).code === "ENOENT"
      ) {
        return Object.freeze({ entries: 0, present: false });
      }
      generatedRootSafetyError(
        `cannot inspect ${path.relative(context.discovery.packageRoot, current)}: ` +
          `${error instanceof Error ? error.message : "unknown filesystem error"}`,
      );
    }
    if (stats.isSymbolicLink() || !stats.isDirectory()) {
      generatedRootSafetyError(
        `${path.relative(context.discovery.packageRoot, current)} is ` +
          `${stats.isSymbolicLink() ? "a symbolic link" : "not a directory"}`,
      );
    }
    if ((stats.mode & 0o022) !== 0) {
      generatedRootSafetyError(
        `${path.relative(context.discovery.packageRoot, current)} has unsafe mode ` +
          `${(stats.mode & 0o777).toString(8).padStart(3, "0")}`,
      );
    }
  }

  const canonicalGenerated = realpathSync.native(configured.generatedRoot);
  if (!containedBy(canonicalProject, canonicalGenerated)) {
    generatedRootSafetyError(
      `${relative} resolves outside the canonical package root`,
    );
  }

  let entries = 0;
  const inspectTree = (directory: string): void => {
    let children;
    try {
      children = readdirSync(directory, { withFileTypes: true });
    } catch (error) {
      generatedRootSafetyError(
        `cannot enumerate ${path.relative(context.discovery.packageRoot, directory)}: ` +
          `${error instanceof Error ? error.message : "unknown filesystem error"}`,
      );
    }
    for (const child of children) {
      const absolute = path.join(directory, child.name);
      const projectRelative = path.relative(
        context.discovery.packageRoot,
        absolute,
      );
      const stats = lstatSync(absolute);
      entries += 1;
      if (stats.isSymbolicLink()) {
        generatedRootSafetyError(`${projectRelative} is a symbolic link`);
      }
      if (stats.isDirectory()) {
        if ([".git", ".nextjshx", "node_modules"].includes(child.name)) {
          generatedRootSafetyError(
            `${projectRelative} is a protected nested control root`,
          );
        }
        if ((stats.mode & 0o022) !== 0) {
          generatedRootSafetyError(
            `${projectRelative} has unsafe mode ` +
              `${(stats.mode & 0o777).toString(8).padStart(3, "0")}`,
          );
        }
        inspectTree(absolute);
        continue;
      }
      if (!stats.isFile()) {
        generatedRootSafetyError(
          `${projectRelative} is a special filesystem entry`,
        );
      }
      if (
        child.name.endsWith(".hx") ||
        child.name.endsWith(".hxml") ||
        child.name === "package.json" ||
        child.name === "tsconfig.json" ||
        child.name.startsWith("next.config.")
      ) {
        generatedRootSafetyError(
          `${projectRelative} looks like authored project input`,
        );
      }
    }
  };
  inspectTree(configured.generatedRoot);
  return Object.freeze({ entries, present: true });
}

function cleanGeneratedRoot(context: ProjectContext): number {
  let inspection: GeneratedRootInspection;
  try {
    inspection = inspectGeneratedRoot(context);
    if (!inspection.present) {
      return 0;
    }
    const generatedRoot = context.discovery.configuredPaths?.generatedRoot;
    if (generatedRoot === undefined) {
      throw new GeneratedRootSafetyError(
        "the configured generated root disappeared",
      );
    }
    rmSync(generatedRoot, { recursive: true, force: false, maxRetries: 0 });
    if (existsSync(generatedRoot)) {
      throw new GeneratedRootSafetyError(
        "the generated root still exists after cleanup",
      );
    }
    return inspection.entries;
  } catch (error) {
    cliFailure(
      "NXHX-CLI-BUILD-0009",
      "Production build refused to clean an unsafe Haxe generated root.",
      context.config.haxe.generatedRoot,
      "a dedicated, real, private generated-output tree containing only generated files",
      error instanceof Error ? error.message : "unknown generated-root failure",
      "Move Haxe output to a dedicated generated root, remove unsafe links or authored inputs, and rerun doctor.",
    );
  }
}

function requireFreshGeneratedRoot(context: ProjectContext): number {
  try {
    const inspection = inspectGeneratedRoot(context);
    if (!inspection.present) {
      throw new GeneratedRootSafetyError(
        "Haxe succeeded without recreating the configured generated root",
      );
    }
    return inspection.entries;
  } catch (error) {
    cliFailure(
      "NXHX-CLI-BUILD-0009",
      "Production build cannot accept the Haxe generated tree.",
      context.config.haxe.generatedRoot,
      "a freshly recreated safe generated-output tree",
      error instanceof Error ? error.message : "unknown generated-root failure",
      "Align the configured generated root with the Haxe/genes-ts output and remove unsafe generated entries.",
    );
  }
}

function validatedNextBuildArguments(
  args: readonly string[],
): readonly string[] {
  const seen = new Set<string>();
  let bundler: string | null = null;
  for (const argument of args) {
    if (!NEXT_BUILD_BOOLEAN_FLAGS.has(argument)) {
      const reason =
        argument === "--experimental-upload-trace"
          ? "trace upload is disabled because build traces can contain sensitive project data"
          : argument === "--experimental-build-mode" ||
              argument === "--debug-build-paths" ||
              argument === "--debug-prerender" ||
              argument === "--experimental-app-only"
            ? "partial/debug build modes do not satisfy the complete production gate"
            : "the flag is not in the reviewed Next 16.2.12 build allowlist";
      cliFailure(
        "NXHX-CLI-USAGE-0001",
        "Production build received an unsupported Next.js argument.",
        argument,
        "a documented non-value Next 16.2.12 build flag",
        reason,
        "Use nextjshx --help and docs/cli.md, or run the exceptional Next command explicitly outside the production gate.",
      );
    }
    if (seen.has(argument)) {
      cliFailure(
        "NXHX-CLI-USAGE-0001",
        "Production build received the same Next.js flag more than once.",
        argument,
        "each pass-through flag at most once",
        "duplicate",
        "Remove the duplicate flag so the build invocation is unambiguous.",
      );
    }
    seen.add(argument);
    if (NEXT_BUILD_BUNDLER_FLAGS.has(argument)) {
      if (bundler !== null) {
        cliFailure(
          "NXHX-CLI-USAGE-0001",
          "Production build received conflicting Next.js bundler flags.",
          `${bundler}, ${argument}`,
          "at most one of --turbo, --turbopack, or --webpack",
          "multiple bundlers",
          "Select exactly one bundler or let the pinned Next.js default apply.",
        );
      }
      bundler = argument;
    }
  }
  return Object.freeze([...args]);
}

function assertSafeHxml(context: ProjectContext): void {
  let stats;
  try {
    stats = lstatSync(context.hxmlPath);
  } catch (error) {
    cliFailure(
      "NXHX-CLI-HAXE-0003",
      "The configured Haxe build file cannot be inspected.",
      path.relative(context.discovery.packageRoot, context.hxmlPath),
      "an existing regular .hxml file inside the package",
      error instanceof Error ? error.message : "missing or unreadable",
      "Run nextjshx setup to regenerate the compiler-owned toolchain.",
    );
  }
  if (stats.isSymbolicLink() || !stats.isFile()) {
    cliFailure(
      "NXHX-CLI-HAXE-0003",
      "The configured Haxe build file is not a real regular file.",
      path.relative(context.discovery.packageRoot, context.hxmlPath),
      "a non-symlink regular .hxml file",
      stats.isSymbolicLink() ? "symbolic link" : "non-regular entry",
      "Run nextjshx setup; do not replace compiler-owned toolchain files.",
    );
  }
  const real = realpathSync.native(context.hxmlPath);
  if (!containedBy(realpathSync.native(context.discovery.packageRoot), real)) {
    cliFailure(
      "NXHX-CLI-HAXE-0003",
      "The configured Haxe build resolves outside the application package.",
      path.relative(context.discovery.packageRoot, context.hxmlPath),
      "a real file contained by the package",
      "symlink or filesystem escape",
      "Remove the unsafe toolchain entry and rerun nextjshx setup.",
    );
  }
}

function ensurePlanDirectory(projectRoot: string): void {
  const control = path.join(projectRoot, ".nextjshx");
  const plans = path.join(projectRoot, ...PLAN_DIRECTORY.split("/"));
  for (const directory of [control, plans]) {
    let stats;
    try {
      stats = lstatSync(directory);
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { readonly code?: string }).code === "ENOENT"
      ) {
        mkdirSync(directory, { mode: 0o700 });
        stats = lstatSync(directory);
      } else {
        cliFailure(
          "NXHX-CLI-PLAN-0004",
          "Cannot inspect the adapter-plan control directory.",
          path.relative(projectRoot, directory),
          "a real private directory",
          error instanceof Error ? error.message : "unknown filesystem error",
          "Fix .nextjshx control permissions before invoking Haxe.",
        );
      }
    }
    if (stats.isSymbolicLink() || !stats.isDirectory()) {
      cliFailure(
        "NXHX-CLI-PLAN-0004",
        "The adapter-plan control path is unsafe.",
        path.relative(projectRoot, directory),
        "a real private directory with no symlink traversal",
        stats.isSymbolicLink() ? "symbolic link" : "non-directory entry",
        "Move the blocking entry; plan collection never follows control symlinks.",
      );
    }
    if ((stats.mode & 0o022) !== 0) {
      cliFailure(
        "NXHX-CLI-PLAN-0004",
        "The adapter-plan control directory is writable by another local user or group.",
        path.relative(projectRoot, directory),
        "a private directory with no group/other write bits",
        `mode ${(stats.mode & 0o777).toString(8).padStart(3, "0")}`,
        "Remove group/other write permission before collecting a transaction-specific plan.",
      );
    }
  }
}

function cleanPlanFile(file: string): void {
  if (!existsSync(file)) {
    return;
  }
  const stats = lstatSync(file);
  if (stats.isSymbolicLink() || !stats.isFile()) {
    cliFailure(
      "NXHX-CLI-PLAN-0004",
      "The unique adapter-plan result path is unsafe.",
      file,
      "a regular file created by the current Haxe process",
      stats.isSymbolicLink() ? "symbolic link" : "non-regular entry",
      "Preserve the entry and inspect control-directory interference.",
    );
  }
  unlinkSync(file);
}

function tool(
  runtime: CommandRuntime,
  name: "gitCommand" | "haxeCommand" | "nextCommand" | "typescriptCommand",
  fallback: () => ToolCommand,
): ToolCommand {
  return runtime[name] ?? fallback();
}

function commandResultFailure(
  code:
    "NXHX-CLI-HAXE-0003" | "NXHX-CLI-TYPECHECK-0006" | "NXHX-CLI-BUILD-0009",
  source: string,
  request: ProcessRequest,
  result: ProcessResult,
): never {
  const output = processOutput(result);
  const displayArgs = request.args.map((argument) => {
    if (!path.isAbsolute(argument)) {
      return argument;
    }
    const relative = path.relative(request.cwd, argument);
    return containedBy(request.cwd, argument) && relative !== ""
      ? relative.split(path.sep).join("/")
      : "<absolute-tool-path>";
  });
  cliFailure(
    code,
    `${source} exited unsuccessfully.`,
    `${request.source}: ${path.basename(request.command)} ${displayArgs.join(" ")}`.trim(),
    "exit code 0",
    `exit ${result.exitCode}${output.length === 0 ? "" : `: ${output.slice(0, 16_384)}`}`,
    `Fix the raw ${source} diagnostics; NextJsHx did not suppress or reinterpret the tool failure.`,
  );
}

function verifyPlanToolchain(context: ProjectContext, plan: AdapterPlan): void {
  if (plan.toolchain.nextjshx !== NEXTJSHX_VERSION) {
    cliFailure(
      "NXHX-CLI-PLAN-0004",
      "The adapter plan was emitted by a different NextJsHx version.",
      "$.toolchain.nextjshx",
      NEXTJSHX_VERSION,
      plan.toolchain.nextjshx,
      "Use one installed NextJsHx version for the Haxe macros and CLI.",
    );
  }
  if (plan.toolchain.haxe !== HAXE_VERSION) {
    cliFailure(
      "NXHX-CLI-PLAN-0004",
      "The adapter plan Haxe identity differs from the supported compiler.",
      "$.toolchain.haxe",
      HAXE_VERSION,
      plan.toolchain.haxe,
      "Compile the plan with the project-pinned Haxe version.",
    );
  }
  if (plan.toolchain.genesTs !== GENES_TS_IDENTITY) {
    cliFailure(
      "NXHX-CLI-PLAN-0004",
      "The adapter plan genes-ts identity differs from the reviewed compiler pin.",
      "$.toolchain.genesTs",
      GENES_TS_IDENTITY,
      plan.toolchain.genesTs,
      "Install the exact Lix GitHub pin recorded by this NextJsHx release.",
    );
  }
  const installedNext = context.discovery.nextPackage.installedVersion;
  if (installedNext !== undefined && plan.toolchain.next !== installedNext) {
    cliFailure(
      "NXHX-CLI-PLAN-0004",
      "The adapter plan Next.js identity differs from the installed package.",
      "$.toolchain.next",
      installedNext,
      plan.toolchain.next,
      "Regenerate with the macros configured for the installed Next.js version.",
    );
  }
}

const PARALLEL_DEFAULT_FILES = new Set([
  "default.js",
  "default.jsx",
  "default.ts",
  "default.tsx",
]);

/**
 * Next 16 requires every named parallel slot to own a default convention file.
 * Validate the future published tree, combining reviewed Haxe intents with
 * unowned native files, so a stale generated default can never mask a missing
 * declaration.
 */
function validateParallelSlotDefaults(
  context: ProjectContext,
  plan: AdapterPlan,
): void {
  const required = new Set<string>();
  const planned = new Map<string, string>();
  for (const intent of plan.intents) {
    if (intent.segmentPath !== "") {
      const segments = intent.segmentPath.split("/");
      for (let index = 0; index < segments.length; index += 1) {
        if ((segments[index] as string).startsWith("@")) {
          required.add(segments.slice(0, index + 1).join("/"));
        }
      }
    }
    if (intent.kind === "default") {
      const finalSegment = intent.segmentPath.split("/").at(-1) ?? "";
      const shape = routeShape(
        intent.segmentPath,
        `${intent.source.typeName}.${intent.source.fieldName}`,
      );
      if (shape.topology !== "parallel-view" || !finalSegment.startsWith("@")) {
        cliFailure(
          "NXHX-CLI-ROUTE-0007",
          "A Haxe default-file intent is not rooted at a named parallel slot.",
          intent.source.typeName,
          "a segment path ending in @slot",
          intent.segmentPath,
          'Use @:next.default("path/@slot") and regenerate the adapter plan.',
        );
      }
      planned.set(intent.segmentPath, intent.targetPath);
    }
  }

  const manifestOwned = new Set(
    (readManifest(context)?.outputs ?? []).map((output) => output.path),
  );
  const native = new Map<string, string[]>();
  const visit = (
    absoluteDirectory: string,
    relativeDirectory: string,
  ): void => {
    const entries = readdirSync(absoluteDirectory, {
      withFileTypes: true,
    }).sort((left, right) =>
      Buffer.from(left.name).compare(Buffer.from(right.name)),
    );
    const leaf = relativeDirectory.split("/").at(-1) ?? "";
    if (leaf.startsWith("@")) {
      required.add(relativeDirectory);
      const candidates: string[] = [];
      for (const entry of entries) {
        if (!PARALLEL_DEFAULT_FILES.has(entry.name)) {
          continue;
        }
        const absolute = path.join(absoluteDirectory, entry.name);
        const projectPath = path.posix.join(
          context.discovery.appRootRelative,
          relativeDirectory,
          entry.name,
        );
        const stats = lstatSync(absolute);
        if (stats.isSymbolicLink() || !stats.isFile()) {
          cliFailure(
            "NXHX-CLI-ROUTE-0007",
            "A parallel-slot default convention is not a real regular file.",
            projectPath,
            "a non-symlink regular default.js, default.jsx, default.ts, or default.tsx",
            stats.isSymbolicLink() ? "symbolic link" : "non-regular entry",
            "Replace the unsafe convention entry before generating the route tree.",
          );
        }
        if (!manifestOwned.has(projectPath)) {
          candidates.push(projectPath);
        }
      }
      native.set(relativeDirectory, candidates);
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }
      visit(
        path.join(absoluteDirectory, entry.name),
        relativeDirectory === ""
          ? entry.name
          : `${relativeDirectory}/${entry.name}`,
      );
    }
  };
  visit(context.discovery.appRoot, "");

  for (const slot of [...required].sort((left, right) =>
    Buffer.from(left).compare(Buffer.from(right)),
  )) {
    const plannedTarget = planned.get(slot);
    const nativeTargets = native.get(slot) ?? [];
    if (
      nativeTargets.length > 1 ||
      (plannedTarget !== undefined && nativeTargets.length > 0)
    ) {
      cliFailure(
        "NXHX-CLI-ROUTE-0007",
        "A named parallel slot has multiple default convention owners.",
        path.posix.join(context.discovery.appRootRelative, slot),
        "exactly one Haxe-generated or native default convention",
        [plannedTarget, ...nativeTargets]
          .filter((value) => value !== undefined)
          .join(", "),
        "Keep one default implementation for the slot and remove the conflicting convention file.",
      );
    }
    if (plannedTarget === undefined && nativeTargets.length === 0) {
      cliFailure(
        "NXHX-CLI-ROUTE-0007",
        "A named parallel slot is missing the default convention required by Next 16.",
        path.posix.join(context.discovery.appRootRelative, slot),
        "one default.js, default.jsx, default.ts, default.tsx, or @:next.default declaration",
        "missing",
        `Add @:next.default("${slot}") or an owned native default file so hard navigation has an explicit fallback.`,
      );
    }
  }
}

function collectCompilationPlans(
  context: ProjectContext,
  runtimeInput: CommandRuntime | undefined,
  noOutput: boolean,
): CompilationPlans {
  const runtime = runtimeValue(runtimeInput);
  assertSafeHxml(context);
  ensurePlanDirectory(context.discovery.packageRoot);
  const id = runtime.uuid();
  if (!UUID_V4.test(id)) {
    cliFailure(
      "NXHX-CLI-PLAN-0004",
      "The adapter-plan transaction identity is invalid.",
      "runtime.uuid",
      "a lowercase UUID v4",
      id,
      "Use the default cryptographic UUID generator.",
    );
  }
  const relativePlan = `${PLAN_DIRECTORY}/${id}.json`;
  const relativeBoundaryPlan = `${PLAN_DIRECTORY}/${id}.boundaries.json`;
  const absolutePlan = path.join(
    context.discovery.packageRoot,
    ...relativePlan.split("/"),
  );
  const absoluteBoundaryPlan = path.join(
    context.discovery.packageRoot,
    ...relativeBoundaryPlan.split("/"),
  );
  const haxe = tool(runtime, "haxeCommand", () => ({
    command: "haxe",
    argsPrefix: [],
  }));
  const request: ProcessRequest = {
    command: haxe.command,
    args: [
      ...haxe.argsPrefix,
      path.relative(context.discovery.packageRoot, context.hxmlPath),
      ...effectiveHaxeDefines(context.config).flatMap((define) => ["-D", define]),
      ...(context.config.next.cacheComponents
        ? ["-D", CACHE_COMPONENTS_DEFINE]
        : []),
      ...(context.config.next.experimentalCacheDirectives.includes("private")
        ? ["-D", PRIVATE_CACHE_DEFINE]
        : []),
      ...(context.config.next.experimentalCacheDirectives.includes("remote")
        ? ["-D", REMOTE_CACHE_DEFINE]
        : []),
      "-D",
      `${APP_ROOT_DEFINE}=${context.discovery.appRootRelative}`,
      "-D",
      `${GENERATED_ROOT_DEFINE}=${context.config.haxe.generatedRoot}`,
      "-D",
      `${PLAN_DEFINE}=${relativePlan}`,
      "-D",
      `${BOUNDARY_PLAN_DEFINE}=${relativeBoundaryPlan}`,
      ...(noOutput ? ["--no-output"] : []),
    ],
    cwd: context.discovery.packageRoot,
    source: "haxe",
  };
  try {
    const result = runtime.processRunner(request);
    if (result.exitCode !== 0) {
      commandResultFailure("NXHX-CLI-HAXE-0003", "Haxe", request, result);
    }
    if (!existsSync(absolutePlan)) {
      cliFailure(
        "NXHX-CLI-PLAN-0004",
        "Haxe succeeded without emitting the requested adapter plan.",
        relativePlan,
        "a fresh schema-v1 JSON plan",
        "missing",
        `Install the NextJsHx adapter registry and honor -D ${PLAN_DEFINE}.`,
      );
    }
    if (!existsSync(absoluteBoundaryPlan)) {
      cliFailure(
        "NXHX-CLI-BOUNDARY-0013",
        "Haxe succeeded without emitting the requested boundary evidence plan.",
        relativeBoundaryPlan,
        "a fresh schema-v1 JSON boundary plan",
        "missing",
        `Install the NextJsHx environment boundary audit and honor -D ${BOUNDARY_PLAN_DEFINE}.`,
      );
    }
    const plan = readAdapterPlan(absolutePlan);
    const boundary = readBoundaryPlan(absoluteBoundaryPlan);
    verifyPlanToolchain(context, plan);
    validateParallelSlotDefaults(context, plan);
    return Object.freeze({ adapter: plan, boundary });
  } finally {
    cleanPlanFile(absolutePlan);
    cleanPlanFile(absoluteBoundaryPlan);
  }
}

function collectAdapterPlan(
  context: ProjectContext,
  runtimeInput: CommandRuntime | undefined,
  noOutput: boolean,
): AdapterPlan {
  return collectCompilationPlans(context, runtimeInput, noOutput).adapter;
}

function readPackage(file: string): Record<string, unknown> {
  try {
    const decoded: unknown = JSON.parse(readFileSync(file, "utf8"));
    if (
      typeof decoded === "object" &&
      decoded !== null &&
      !Array.isArray(decoded)
    ) {
      return decoded as Record<string, unknown>;
    }
  } catch {
    // The caller emits the stable package/bin diagnostic below.
  }
  cliFailure(
    "NXHX-CLI-PROCESS-0002",
    "An installed package manifest cannot be parsed.",
    file,
    "a readable package.json object",
    "missing or malformed",
    "Reinstall dependencies from the reviewed workspace lockfile.",
  );
}

function installedPackageJson(
  context: ProjectContext,
  packageName: string,
): string {
  const segments = packageName.split("/");
  for (const root of [
    context.discovery.packageRoot,
    context.discovery.workspaceRoot,
  ]) {
    const candidate = path.join(
      root,
      "node_modules",
      ...segments,
      "package.json",
    );
    if (existsSync(candidate)) {
      return realpathSync.native(candidate);
    }
  }
  cliFailure(
    "NXHX-CLI-PROCESS-0002",
    `Required package ${packageName} is not installed.`,
    packageName,
    "an installed package under the package or workspace root",
    "missing node_modules package",
    "Install the workspace lockfile before running NextJsHx commands.",
  );
}

function packageCommand(
  context: ProjectContext,
  packageName: string,
  binNames: readonly string[],
): ToolCommand {
  const manifestPath =
    packageName === context.config.next.package &&
    context.discovery.nextPackage.packageJsonPath !== undefined
      ? context.discovery.nextPackage.packageJsonPath
      : installedPackageJson(context, packageName);
  const manifest = readPackage(manifestPath);
  const bin = manifest.bin;
  let relative: string | undefined;
  if (typeof bin === "string" && binNames.length > 0) {
    relative = bin;
  } else if (typeof bin === "object" && bin !== null && !Array.isArray(bin)) {
    for (const name of binNames) {
      const candidate = (bin as Record<string, unknown>)[name];
      if (typeof candidate === "string") {
        relative = candidate;
        break;
      }
    }
  }
  if (
    relative === undefined ||
    path.isAbsolute(relative) ||
    relative.includes("\0")
  ) {
    cliFailure(
      "NXHX-CLI-PROCESS-0002",
      `Installed package ${packageName} has no supported command entry.`,
      `${manifestPath}#bin`,
      binNames.join(" or "),
      JSON.stringify(bin),
      "Install a supported package artifact with its reviewed CLI bin.",
    );
  }
  const packageRoot = path.dirname(manifestPath);
  const binary = path.resolve(packageRoot, relative);
  let binaryStats;
  try {
    binaryStats = lstatSync(binary);
  } catch {
    binaryStats = null;
  }
  let realBinary: string | null = null;
  if (binaryStats !== null && !binaryStats.isSymbolicLink()) {
    try {
      realBinary = realpathSync.native(binary);
    } catch {
      realBinary = null;
    }
  }
  if (
    !containedBy(packageRoot, binary) ||
    binaryStats === null ||
    binaryStats.isSymbolicLink() ||
    !binaryStats.isFile() ||
    realBinary === null ||
    !containedBy(packageRoot, realBinary)
  ) {
    cliFailure(
      "NXHX-CLI-PROCESS-0002",
      `The ${packageName} command escapes or is missing from its package.`,
      relative,
      "a real regular bin file contained by the installed package",
      binary,
      "Reinstall the package; NextJsHx never executes an uncontained bin path.",
    );
  }
  return Object.freeze({ command: process.execPath, argsPrefix: [binary] });
}

/** Resolve the exact package/tool identities used by the long-running dev owner. */
export function resolveDevelopmentProject(
  options: CommandBaseOptions,
): DevelopmentProject {
  const context = projectContext(options);
  const runtime = runtimeValue(options.runtime);
  return Object.freeze({
    discovery: context.discovery,
    projectRoot: context.discovery.packageRoot,
    hxmlPath: context.hxmlPath,
    manifestPath: context.manifestPath,
    haxeCommand: tool(runtime, "haxeCommand", () => ({
      command: "haxe",
      argsPrefix: [],
    })),
    nextCommand: tool(runtime, "nextCommand", () =>
      packageCommand(context, context.config.next.package, ["next"]),
    ),
  });
}

function concreteRouteProbe(pattern: string): string {
  if (pattern === "/") {
    return pattern;
  }
  if (!pattern.startsWith("/")) {
    cliFailure(
      "NXHX-CLI-ROUTE-0007",
      "A reported route has no absolute public pattern.",
      pattern,
      "a public pattern beginning with /",
      pattern,
      "Fix route normalization before running Next parity probes.",
    );
  }
  const concrete: string[] = [];
  for (const segment of pattern.slice(1).split("/")) {
    if (/^\[\[\.\.\.[A-Za-z_][A-Za-z0-9_]*\]\]$/.test(segment)) {
      concrete.push("nextjshx-probe", "tail");
    } else if (/^\[\.\.\.[A-Za-z_][A-Za-z0-9_]*\]$/.test(segment)) {
      concrete.push("nextjshx-probe", "tail");
    } else if (/^\[[A-Za-z_][A-Za-z0-9_]*\]$/.test(segment)) {
      concrete.push("nextjshx-probe");
    } else {
      concrete.push(segment);
    }
  }
  return `/${concrete.join("/")}`;
}

function routeParitySource(routes: readonly RouteReport[]): string {
  const concrete = [
    ...new Set(routes.map((route) => concreteRouteProbe(route.publicPattern))),
  ].sort((left, right) => Buffer.from(left).compare(Buffer.from(right)));
  return [
    "// Temporary NextJsHx parity probes; never published as application output.",
    ...concrete.map((route, index) => {
      const literal = JSON.stringify(route);
      return `export const __nextjshxRoute${index}: import("next").Route<${literal}> = ${literal};`;
    }),
    "",
  ].join("\n");
}

function runRouteParityProbe(
  context: ProjectContext,
  runtime: ReturnType<typeof runtimeValue>,
  typescript: ToolCommand,
  routes: readonly RouteReport[],
): void {
  ensurePlanDirectory(context.discovery.packageRoot);
  const id = runtime.uuid();
  if (!UUID_V4.test(id)) {
    cliFailure(
      "NXHX-CLI-ROUTE-0007",
      "The route-parity transaction identity is invalid.",
      "runtime.uuid",
      "a lowercase UUID v4",
      id,
      "Use the default cryptographic UUID generator.",
    );
  }
  const sourceName = `${id}.routes.ts`;
  const configName = `${id}.routes.json`;
  const relativeSource = `${PLAN_DIRECTORY}/${sourceName}`;
  const relativeConfig = `${PLAN_DIRECTORY}/${configName}`;
  const absoluteSource = path.join(
    context.discovery.packageRoot,
    ...relativeSource.split("/"),
  );
  const absoluteConfig = path.join(
    context.discovery.packageRoot,
    ...relativeConfig.split("/"),
  );
  let sourceCreated = false;
  let configCreated = false;
  try {
    try {
      writeFileSync(absoluteSource, routeParitySource(routes), {
        encoding: "utf8",
        flag: "wx",
        mode: 0o600,
      });
      sourceCreated = true;
      writeFileSync(
        absoluteConfig,
        `${JSON.stringify(
          {
            extends: "../../tsconfig.json",
            compilerOptions: {
              composite: false,
              incremental: false,
              noEmit: true,
            },
            // Add the private probe without replacing the application's
            // inherited include set. React 19 projects may provide their
            // reviewed global JSX namespace in an application declaration
            // file, and Next's generated types depend on that ambient
            // environment.
            files: [sourceName, "../../next-env.d.ts"],
          },
          null,
          2,
        )}\n`,
        {
          encoding: "utf8",
          flag: "wx",
          mode: 0o600,
        },
      );
      configCreated = true;
    } catch (error) {
      cliFailure(
        "NXHX-CLI-ROUTE-0007",
        "Cannot create the private route-parity probe.",
        PLAN_DIRECTORY,
        "new owner-only regular probe files",
        (error as NodeJS.ErrnoException).code ?? "filesystem failure",
        "Inspect stale control artifacts and private directory permissions before retrying.",
      );
    }
    const request: ProcessRequest = {
      command: typescript.command,
      args: [...typescript.argsPrefix, "--project", relativeConfig, "--noEmit"],
      cwd: context.discovery.packageRoot,
      source: "tsc",
    };
    const result = runtime.processRunner(request);
    if (result.exitCode !== 0) {
      commandResultFailure(
        "NXHX-CLI-TYPECHECK-0006",
        "typed route parity probe",
        request,
        result,
      );
    }
  } finally {
    if (configCreated) {
      cleanPlanFile(absoluteConfig);
    }
    if (sourceCreated) {
      cleanPlanFile(absoluteSource);
    }
  }
}

function validationCommands(
  context: ProjectContext,
  runtimeInput: CommandRuntime | undefined,
  routePatterns: readonly RouteReport[] = [],
): ValidationResult {
  const runtime = runtimeValue(runtimeInput);
  const next = tool(runtime, "nextCommand", () =>
    packageCommand(context, context.config.next.package, ["next"]),
  );
  const nextRequest: ProcessRequest = {
    command: next.command,
    args: [...next.argsPrefix, "typegen", "."],
    cwd: context.discovery.packageRoot,
    source: "next",
  };
  const nextResult = runtime.processRunner(nextRequest);
  if (nextResult.exitCode !== 0) {
    commandResultFailure(
      "NXHX-CLI-TYPECHECK-0006",
      "Next route type generation",
      nextRequest,
      nextResult,
    );
  }

  const tsconfig = path.join(context.discovery.packageRoot, "tsconfig.json");
  if (!existsSync(tsconfig) || !statSync(tsconfig).isFile()) {
    cliFailure(
      "NXHX-CLI-TYPECHECK-0006",
      "The application has no TypeScript project configuration.",
      "tsconfig.json",
      "a regular tsconfig.json at the package root",
      "missing",
      "Initialize the Next TypeScript application before running typecheck.",
    );
  }
  requireStrictTsconfig(tsconfig, "NXHX-CLI-TYPECHECK-0006");
  const typescript = tool(runtime, "typescriptCommand", () =>
    packageCommand(context, "typescript", ["tsc6", "tsc"]),
  );
  const tscRequest: ProcessRequest = {
    command: typescript.command,
    args: [...typescript.argsPrefix, "--project", "tsconfig.json", "--noEmit"],
    cwd: context.discovery.packageRoot,
    source: "tsc",
  };
  const tscResult = runtime.processRunner(tscRequest);
  if (tscResult.exitCode !== 0) {
    commandResultFailure(
      "NXHX-CLI-TYPECHECK-0006",
      "strict TypeScript no-emit checking",
      tscRequest,
      tscResult,
    );
  }
  if (routePatterns.length > 0) {
    runRouteParityProbe(context, runtime, typescript, routePatterns);
  }
  return Object.freeze({ next: nextResult, typescript: tscResult });
}

interface InspectedTsconfig {
  readonly raw: Record<string, unknown>;
  readonly options: ts.CompilerOptions;
}

function requireStrictTsconfig(
  file: string,
  code: "NXHX-CLI-TYPECHECK-0006" | "NXHX-CLI-DOCTOR-0008",
): InspectedTsconfig {
  let unrecoverable: ts.Diagnostic | undefined;
  const parsed = ts.getParsedCommandLineOfConfigFile(
    file,
    {},
    {
      ...ts.sys,
      onUnRecoverableConfigFileDiagnostic: (diagnostic) => {
        unrecoverable = diagnostic;
      },
    },
  );
  const diagnostic = unrecoverable ?? parsed?.errors[0];
  if (parsed === undefined || diagnostic !== undefined) {
    cliFailure(
      code,
      "The TypeScript project configuration cannot be resolved safely.",
      "tsconfig.json",
      "a parseable TypeScript project configuration",
      diagnostic === undefined
        ? "unresolved configuration"
        : `TS${diagnostic.code}: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, " ")}`,
      "Fix tsconfig.json and every extended config before running framework validation.",
    );
  }
  const strictFlags = [
    "alwaysStrict",
    "noImplicitAny",
    "strictBindCallApply",
    "strictBuiltinIteratorReturn",
    "strictFunctionTypes",
    "strictNullChecks",
    "strictPropertyInitialization",
    "useUnknownInCatchVariables",
  ];
  const options = parsed.options as ts.CompilerOptions &
    Record<string, unknown>;
  const weakened = strictFlags.filter((flag) => options[flag] === false);
  if (options.strict !== true || weakened.length > 0) {
    cliFailure(
      code,
      "NextJsHx validation requires an effective strict TypeScript project.",
      "tsconfig.json#compilerOptions",
      "strict: true with no strict-family option disabled",
      options.strict !== true
        ? `strict is ${String(options.strict)}`
        : `disabled ${weakened.join(", ")}`,
      "Enable strict mode and remove overrides that weaken its effective checks.",
    );
  }
  const source = ts.readConfigFile(file, ts.sys.readFile);
  if (
    source.error !== undefined ||
    typeof source.config !== "object" ||
    source.config === null ||
    Array.isArray(source.config)
  ) {
    cliFailure(
      code,
      "The TypeScript project configuration has no inspectable object shape.",
      "tsconfig.json",
      "a JSON/JSONC object",
      source.error === undefined
        ? typeof source.config
        : `TS${source.error.code}`,
      "Restore a standard non-executable TypeScript configuration.",
    );
  }
  return Object.freeze({
    raw: source.config as Record<string, unknown>,
    options: parsed.options,
  });
}

function requireCurrentGeneratedTree(
  preflight: ReturnType<typeof preflightGeneratedOutputs>,
  code:
    "NXHX-CLI-TYPECHECK-0006" | "NXHX-CLI-ROUTE-0007" | "NXHX-CLI-BUILD-0009",
  command: "typecheck" | "routes --check" | "build verification",
): void {
  const changed = preflight.changes.filter(
    (change) => change.disposition !== "unchanged",
  );
  const previous = preflight.previousManifest;
  const intended = preflight.intendedManifest;
  const manifestCurrent =
    previous !== null &&
    previous.generation === intended.generation &&
    previous.nextVersion === intended.nextVersion &&
    previous.genesVersion === intended.genesVersion &&
    previous.outputProfileFingerprint === intended.outputProfileFingerprint;
  const manifestDrift =
    previous === null
      ? ["manifest:missing"]
      : [
          ...(previous.generation === intended.generation
            ? []
            : ["manifest:generation"]),
          ...(previous.nextVersion === intended.nextVersion
            ? []
            : [`next:${previous.nextVersion}->${intended.nextVersion}`]),
          ...(previous.genesVersion === intended.genesVersion
            ? []
            : [`genes:${previous.genesVersion}->${intended.genesVersion}`]),
          ...(previous.outputProfileFingerprint ===
          intended.outputProfileFingerprint
            ? []
            : [
                `profile:${previous.outputProfileFingerprint.slice(0, 12)}->${intended.outputProfileFingerprint.slice(0, 12)}`,
              ]),
        ];
  if (changed.length > 0 || !manifestCurrent) {
    cliFailure(
      code,
      `${command} refuses to validate stale or unpublished adapter identity.`,
      "generated adapter tree and ownership manifest",
      "every planned output and the configured output profile classified unchanged against the verified manifest",
      [
        ...changed.map(
          (change) => `${change.disposition}:${change.path}`,
        ),
        ...(!manifestCurrent ? manifestDrift : []),
      ].join(", "),
      "Run nextjshx generate, review the transaction result, then rerun this validation command.",
    );
  }
}

async function formattedPlanOutputs(
  context: ProjectContext,
  plan: AdapterPlan,
): Promise<readonly PlannedGeneratedOutput[]> {
  const rendered = renderPlanOutputs(context, plan);
  return Object.freeze(
    await Promise.all(rendered.map((output) => formatGeneratedOutput(output))),
  );
}

function renderPlanOutputs(
  context: ProjectContext,
  plan: AdapterPlan,
): readonly PlannedGeneratedOutput[] {
  const generatedRoot = context.discovery.configuredPaths?.generatedRoot;
  if (generatedRoot === undefined) {
    cliFailure(
      "NXHX-CLI-PLAN-0004",
      "Cannot fingerprint generated Haxe implementation modules.",
      context.config.haxe.generatedRoot,
      "a resolved generated root containing every adapter implementation",
      "generated root is unresolved",
      "Fix nextjshx.config.json and regenerate the complete Haxe output tree.",
    );
  }
  try {
    const implementationDigests = adapterImplementationDigests(
      context.discovery.packageRoot,
      generatedRoot,
      context.discovery.appRootRelative,
      plan,
    );
    return renderAdapterPlan(context.discovery.appRootRelative, plan, {
      implementationDigests,
    });
  } catch (error) {
    cliFailure(
      "NXHX-CLI-PLAN-0004",
      "Cannot fingerprint generated Haxe implementation modules.",
      context.config.haxe.generatedRoot,
      "a bounded real generated module graph covering every adapter implementation",
      error instanceof Error
        ? error.message
        : "unknown generated-graph failure",
      "Remove unsafe generated entries, align implementation imports with genes-ts output, and regenerate.",
    );
  }
}

function relativeManifestPath(context: ProjectContext): string {
  return path
    .relative(context.discovery.packageRoot, context.manifestPath)
    .split(path.sep)
    .join("/");
}

function exactConventionOutputFiles(
  context: ProjectContext,
): readonly string[] {
  const proxy = proxyOutputPathForAppRoot(context.discovery.appRootRelative);
  const mdxComponents = mdxComponentsOutputPathForAppRoot(
    context.discovery.appRootRelative,
  );
  return Object.freeze(
    [proxy, mdxComponents].filter((value): value is string => value !== null),
  );
}

function classifiedChanges(
  changes: readonly {
    readonly disposition: "create" | "update" | "unchanged" | "remove";
    readonly path: string;
  }[],
): Readonly<
  Record<"create" | "update" | "unchanged" | "remove", readonly string[]>
> {
  return Object.freeze({
    create: Object.freeze(
      changes
        .filter((change) => change.disposition === "create")
        .map((change) => change.path),
    ),
    update: Object.freeze(
      changes
        .filter((change) => change.disposition === "update")
        .map((change) => change.path),
    ),
    unchanged: Object.freeze(
      changes
        .filter((change) => change.disposition === "unchanged")
        .map((change) => change.path),
    ),
    remove: Object.freeze(
      changes
        .filter((change) => change.disposition === "remove")
        .map((change) => change.path),
    ),
  });
}

export async function runGenerateCommand(
  options: GenerateCommandOptions,
): Promise<GenerateCommandResult> {
  const context = projectContext(options);
  const recovery = await recoverGeneratedOutputPublication({
    projectRoot: context.discovery.packageRoot,
  });
  const plan = collectAdapterPlan(context, options.runtime, false);
  const outputs = renderPlanOutputs(context, plan);
  const validate = options.validate ?? true;
  const publication = await publishGeneratedOutputs({
    projectRoot: context.discovery.packageRoot,
    manifestPath: relativeManifestPath(context),
    allowedOutputRoots: [context.discovery.appRootRelative],
    allowedOutputFiles: exactConventionOutputFiles(context),
    nextVersion: plan.toolchain.next,
    genesVersion: plan.toolchain.genesTs,
    outputProfile: effectiveOutputProfile(context.config),
    outputs,
    ...(validate
      ? {
          postValidate: () => {
            validationCommands(context, options.runtime);
          },
        }
      : {}),
  });
  return Object.freeze({
    command: "generate",
    projectRoot: context.discovery.packageRoot,
    recovery,
    publication,
    blocked: Object.freeze([]),
    validation: validate ? "passed" : "skipped",
  });
}

function ownershipManifestForClean(
  context: ProjectContext,
): GeneratedOutputManifest | null {
  if (!existsSync(context.manifestPath)) {
    return null;
  }
  let decoded: unknown;
  try {
    decoded = JSON.parse(readFileSync(context.manifestPath, "utf8"));
  } catch (error) {
    cliFailure(
      "NXHX-CLI-CLEAN-0011",
      "Clean cannot inspect the ownership manifest.",
      relativeManifestPath(context),
      "a valid generated-output manifest whose complete output set can be verified",
      error instanceof Error ? error.message : "malformed JSON",
      "Preserve every live file and repair the ownership manifest explicitly.",
    );
  }
  return parseGeneratedOutputManifest(decoded);
}

function removeEmptyOwnedParents(
  context: ProjectContext,
  removed: readonly string[],
): void {
  const appRoot = path.join(
    context.discovery.packageRoot,
    context.discovery.appRootRelative,
  );
  const candidates = new Set<string>();
  for (const output of removed) {
    let current = path.dirname(
      path.join(context.discovery.packageRoot, output),
    );
    while (current !== appRoot && containedBy(appRoot, current)) {
      candidates.add(current);
      current = path.dirname(current);
    }
  }
  const deepestFirst = [...candidates].sort(
    (left, right) =>
      right.split(path.sep).length - left.split(path.sep).length ||
      Buffer.from(left).compare(Buffer.from(right)),
  );
  for (const directory of deepestFirst) {
    try {
      rmdirSync(directory);
    } catch (error) {
      const code =
        typeof error === "object" && error !== null && "code" in error
          ? String((error as { readonly code?: unknown }).code)
          : "";
      if (code !== "ENOENT" && code !== "ENOTEMPTY" && code !== "EEXIST") {
        cliFailure(
          "NXHX-CLI-CLEAN-0011",
          "Clean removed verified outputs but could not prune an empty owned parent.",
          path.relative(context.discovery.packageRoot, directory),
          "an empty real directory or a directory retained for native sibling files",
          error instanceof Error ? error.message : "unknown filesystem error",
          "Inspect the directory metadata; no native file was deleted.",
        );
      }
    }
  }
}

/**
 * Remove the complete verified ownership set through the ordinary journaled
 * publisher. An empty manifest is retained as explicit proof that the CLI
 * owns no output; a missing manifest remains a mutation-free no-op.
 */
export async function runCleanCommand(
  options: CleanCommandOptions,
): Promise<CleanCommandResult> {
  const context = projectContext(options);
  const recovery = await recoverGeneratedOutputPublication({
    projectRoot: context.discovery.packageRoot,
  });
  const manifest = ownershipManifestForClean(context);
  if (manifest === null) {
    return Object.freeze({
      command: "clean",
      projectRoot: context.discovery.packageRoot,
      recovery,
      action: "no-manifest",
      removed: Object.freeze([]),
      retainedManifest: false,
    });
  }
  const publication = await publishGeneratedOutputs({
    projectRoot: context.discovery.packageRoot,
    manifestPath: relativeManifestPath(context),
    allowedOutputRoots: [context.discovery.appRootRelative],
    allowedOutputFiles: exactConventionOutputFiles(context),
    nextVersion: manifest.nextVersion,
    genesVersion: manifest.genesVersion,
    outputProfile: manifest.outputProfile,
    outputs: Object.freeze([]),
    ...(options.faultInjector === undefined
      ? {}
      : { faultInjector: options.faultInjector }),
  });
  removeEmptyOwnedParents(context, publication.removed);
  return Object.freeze({
    command: "clean",
    projectRoot: context.discovery.packageRoot,
    recovery,
    action:
      publication.removed.length === 0 && publication.action === "unchanged"
        ? "already-empty"
        : "cleaned",
    removed: publication.removed,
    retainedManifest: true,
  });
}

/**
 * Change ownership of exactly one adapter path. The fresh Haxe plan supplies
 * intended identity and bytes; the publisher proves every non-target path is
 * unchanged before journaling either ownership or live-file state.
 */
export async function runOwnershipTransferCommand(
  options: OwnershipTransferCommandOptions,
): Promise<OwnershipTransferCommandResult> {
  const context = projectContext(options);
  const recovery = await recoverGeneratedOutputPublication({
    projectRoot: context.discovery.packageRoot,
  });
  const plan = collectAdapterPlan(context, options.runtime, false);
  const outputs = renderPlanOutputs(context, plan);
  const publication = await publishGeneratedOutputs({
    projectRoot: context.discovery.packageRoot,
    manifestPath: relativeManifestPath(context),
    allowedOutputRoots: [context.discovery.appRootRelative],
    allowedOutputFiles: exactConventionOutputFiles(context),
    nextVersion: plan.toolchain.next,
    genesVersion: plan.toolchain.genesTs,
    outputProfile: effectiveOutputProfile(context.config),
    outputs,
    transfer: Object.freeze({
      operation: options.operation,
      path: options.path,
    }),
    postValidate: () => {
      validationCommands(context, options.runtime);
    },
    ...(options.faultInjector === undefined
      ? {}
      : { faultInjector: options.faultInjector }),
  });
  return Object.freeze({
    command: options.operation,
    projectRoot: context.discovery.packageRoot,
    path: options.path,
    recovery,
    publication,
    validation: "passed",
  });
}

export async function runTypecheckCommand(
  options: CommandBaseOptions,
): Promise<TypecheckCommandResult> {
  const context = projectContext(options);
  const recovery = await recoverGeneratedOutputPublication({
    projectRoot: context.discovery.packageRoot,
  });
  const plan = collectAdapterPlan(context, options.runtime, false);
  const outputs = await formattedPlanOutputs(context, plan);
  const preflight = preflightGeneratedOutputs({
    projectRoot: context.discovery.packageRoot,
    manifestPath: relativeManifestPath(context),
    allowedOutputRoots: [context.discovery.appRootRelative],
    allowedOutputFiles: exactConventionOutputFiles(context),
    nextVersion: plan.toolchain.next,
    genesVersion: plan.toolchain.genesTs,
    outputProfile: effectiveOutputProfile(context.config),
    outputs,
  });
  requireCurrentGeneratedTree(
    preflight,
    "NXHX-CLI-TYPECHECK-0006",
    "typecheck",
  );
  validationCommands(context, options.runtime);
  return Object.freeze({
    command: "typecheck",
    projectRoot: context.discovery.packageRoot,
    recovery,
    planned: classifiedChanges(preflight.changes),
    nextTypegen: "passed",
    typescript: "passed",
  });
}

function sha256(content: string | Uint8Array): string {
  return createHash("sha256").update(content).digest("hex");
}

function readManifest(context: ProjectContext): GeneratedOutputManifest | null {
  if (!existsSync(context.manifestPath)) {
    return null;
  }
  let decoded: unknown;
  try {
    decoded = JSON.parse(readFileSync(context.manifestPath, "utf8"));
  } catch (error) {
    cliFailure(
      "NXHX-CLI-ROUTE-0007",
      "The ownership manifest cannot be inspected for routes.",
      relativeManifestPath(context),
      "a valid generated-output manifest",
      error instanceof Error ? error.message : "unknown parse failure",
      "Repair ownership state before listing routes.",
    );
  }
  return parseGeneratedOutputManifest(decoded);
}

interface NativeRouteCandidate extends RouteShape {
  readonly kind: "page" | "route-handler";
  readonly segmentPath: string;
  readonly targetPath: string;
  readonly filesystemPath: string;
}

function nativeRouteCandidates(
  context: ProjectContext,
  plannedRoutePaths: ReadonlySet<string>,
  plannedPublicRoutes: ReadonlyMap<string, string>,
  manifest: GeneratedOutputManifest | null,
): readonly NativeRouteCandidate[] {
  const candidates: NativeRouteCandidate[] = [];
  const publicOwners = new Map(plannedPublicRoutes);

  const visit = (
    absoluteDirectory: string,
    relativeDirectory: string,
  ): void => {
    let entries: Dirent[];
    try {
      entries = readdirSync(absoluteDirectory, { withFileTypes: true }).sort(
        (left, right) =>
          Buffer.from(left.name).compare(Buffer.from(right.name)),
      );
    } catch (error) {
      const relative = path
        .relative(context.discovery.packageRoot, absoluteDirectory)
        .split(path.sep)
        .join("/");
      cliFailure(
        "NXHX-CLI-ROUTE-0007",
        "The native route inventory cannot read an App Router directory.",
        relative,
        "a readable real directory inside the App Router root",
        error instanceof Error ? error.message : "unknown filesystem failure",
        "Repair directory permissions or remove the unsafe entry before inventorying routes.",
      );
    }
    for (const entry of entries) {
      const targetPath =
        relativeDirectory === ""
          ? entry.name
          : path.posix.join(relativeDirectory, entry.name);
      const filesystemPath = path.posix.join(
        context.discovery.appRootRelative,
        targetPath,
      );
      const absolute = path.join(absoluteDirectory, entry.name);
      if (entry.isSymbolicLink()) {
        cliFailure(
          "NXHX-CLI-ROUTE-0007",
          "The native route inventory does not follow symbolic links.",
          filesystemPath,
          "a real directory or regular file inside the App Router root",
          "symbolic link",
          "Replace the link with an explicit application file or keep it outside the App Router tree.",
        );
      }
      if (entry.isDirectory()) {
        if (!entry.name.startsWith(".") && !entry.name.startsWith("_")) {
          visit(absolute, targetPath);
        }
        continue;
      }
      if (!entry.isFile()) {
        cliFailure(
          "NXHX-CLI-ROUTE-0007",
          "The App Router tree contains a non-regular filesystem entry.",
          filesystemPath,
          "a real directory or regular file",
          "unsupported filesystem entry",
          "Remove the special entry before inventorying routes.",
        );
      }

      const convention = /^(page|route)\.([^.]+)$/.exec(entry.name);
      if (convention === null) {
        continue;
      }
      const extension = convention[2] as string;
      if (!DEFAULT_APP_ROUTE_EXTENSIONS.has(extension)) {
        cliFailure(
          "NXHX-CLI-ROUTE-0007",
          "The native route uses an extension outside the supported default Next.js set.",
          filesystemPath,
          "page or route with .js, .jsx, .ts, or .tsx",
          `.${extension}`,
          "Keep custom pageExtensions native and unclaimed until NextJsHx can obtain their exact effective configuration without duplicating it.",
        );
      }
      if (plannedRoutePaths.has(filesystemPath)) {
        continue;
      }
      const staleOwner = manifest?.outputs.find(
        (output) => output.path === filesystemPath,
      );
      if (staleOwner !== undefined) {
        cliFailure(
          "NXHX-CLI-ROUTE-0007",
          "The ownership manifest contains a route that the fresh Haxe plan no longer declares.",
          filesystemPath,
          "an explicit current Haxe intent or an unowned native route",
          `stale owner ${staleOwner.source}`,
          "Run nextjshx generate to review and remove stale ownership before treating this file as native.",
        );
      }

      const shape = routeShape(relativeDirectory, filesystemPath);
      if (shape.topology === "canonical") {
        const previous = publicOwners.get(shape.publicPattern);
        if (previous !== undefined) {
          cliFailure(
            "NXHX-CLI-ROUTE-0007",
            "Multiple route implementations claim the same canonical public route.",
            shape.publicPattern,
            "one canonical Haxe or native page/Route Handler per public URL",
            `${previous}, ${filesystemPath}`,
            "Resolve the route-group or native ownership conflict before generating typed route references.",
          );
        }
        publicOwners.set(shape.publicPattern, filesystemPath);
      }
      candidates.push(
        Object.freeze({
          kind: convention[1] === "page" ? "page" : "route-handler",
          segmentPath: relativeDirectory,
          targetPath,
          filesystemPath,
          publicPattern: shape.publicPattern,
          topology: shape.topology,
          parallelSlots: shape.parallelSlots,
          interception: shape.interception,
          parameters: shape.parameters,
        }),
      );
    }
  };

  visit(context.discovery.appRoot, "");
  return Object.freeze(
    candidates.sort((left, right) =>
      Buffer.from(left.filesystemPath).compare(
        Buffer.from(right.filesystemPath),
      ),
    ),
  );
}

function isRouteFileIntent(intent: AdapterIntent): boolean {
  return (
    intent.kind === "page" ||
    intent.kind === "layout" ||
    intent.kind === "loading" ||
    intent.kind === "error" ||
    intent.kind === "not-found" ||
    intent.kind === "default" ||
    intent.kind === "route-handler"
  );
}

function actualOutputState(
  context: ProjectContext,
  output: PlannedGeneratedOutput,
  manifest: GeneratedOutputManifest | null,
): RouteOwnershipStatus {
  const record = manifest?.outputs.find((entry) => entry.path === output.path);
  const absolute = path.join(
    context.discovery.packageRoot,
    ...output.path.split("/"),
  );
  let stats;
  try {
    stats = lstatSync(absolute);
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { readonly code?: string }).code === "ENOENT"
    ) {
      return record === undefined ? "planned" : "owned-missing";
    }
    return "unsafe";
  }
  if (stats.isSymbolicLink() || !stats.isFile()) {
    return "unsafe";
  }
  const actual = sha256(readFileSync(absolute));
  if (record === undefined) {
    return "native-collision";
  }
  if (actual !== record.sha256) {
    return "owned-modified";
  }
  return actual === sha256(output.content) ? "owned-current" : "owned-update";
}

export async function runRoutesCommand(
  options: RoutesCommandOptions,
): Promise<RoutesCommandResult> {
  const context = projectContext(options);
  const recovery = await recoverGeneratedOutputPublication({
    projectRoot: context.discovery.packageRoot,
  });
  const plan = collectAdapterPlan(context, options.runtime, true);
  const manifest = readManifest(context);
  const outputs =
    manifest === null
      ? renderAdapterPlan(context.discovery.appRootRelative, plan)
      : await formattedPlanOutputs(context, plan);
  const outputByPath = new Map(outputs.map((output) => [output.path, output]));
  const check = options.check ?? false;
  const haxeRoutes = plan.intents
    .filter(isRouteFileIntent)
    .map((intent): RouteReport => {
      const renderedPath = path.posix.join(
        context.discovery.appRootRelative,
        intent.targetPath,
      );
      const rendered = outputByPath.get(renderedPath);
      if (rendered === undefined) {
        cliFailure(
          "NXHX-CLI-ROUTE-0007",
          "A route intent has no rendered adapter output.",
          intent.source.typeName,
          "one rendered output",
          "missing",
          "Fix the closed renderer mapping before reporting routes.",
        );
      }
      const shape = routeShape(intent.segmentPath, intent.source.typeName);
      return Object.freeze({
        origin: "haxe",
        source: `${intent.source.typeName}.${intent.source.fieldName}`,
        kind: intent.kind,
        segmentPath: intent.segmentPath,
        targetPath: intent.targetPath,
        filesystemPath: rendered.path,
        publicPattern: shape.publicPattern,
        topology: shape.topology,
        parallelSlots: shape.parallelSlots,
        interception: shape.interception,
        parameters: shape.parameters,
        ownership: actualOutputState(context, rendered, manifest),
        parity: check ? "accepted" : "not-checked",
      });
    });
  const plannedRoutePaths = new Set(
    haxeRoutes.map((route) => route.filesystemPath),
  );
  const plannedPublicRoutes = new Map<string, string>();
  for (const route of haxeRoutes) {
    if (route.kind !== "page" && route.kind !== "route-handler") {
      continue;
    }
    if (route.topology !== "canonical") {
      continue;
    }
    const previous = plannedPublicRoutes.get(route.publicPattern);
    if (previous !== undefined) {
      cliFailure(
        "NXHX-CLI-ROUTE-0007",
        "Multiple Haxe route intents claim the same public route.",
        route.publicPattern,
        "one page or Route Handler implementation per public URL",
        `${previous}, ${route.filesystemPath}`,
        "Split or remove the conflicting Haxe route declaration before publication.",
      );
    }
    plannedPublicRoutes.set(route.publicPattern, route.filesystemPath);
  }
  const nativeRoutes = nativeRouteCandidates(
    context,
    plannedRoutePaths,
    plannedPublicRoutes,
    manifest,
  ).map((route): RouteReport =>
    Object.freeze({
      origin: "native",
      source: route.filesystemPath,
      kind: route.kind,
      segmentPath: route.segmentPath,
      targetPath: route.targetPath,
      filesystemPath: route.filesystemPath,
      publicPattern: route.publicPattern,
      topology: route.topology,
      parallelSlots: route.parallelSlots,
      interception: route.interception,
      parameters: route.parameters,
      ownership: "native",
      parity: check ? "accepted" : "not-checked",
    }),
  );
  const routes = [...haxeRoutes, ...nativeRoutes].sort((left, right) => {
    const pathOrder = Buffer.from(left.filesystemPath).compare(
      Buffer.from(right.filesystemPath),
    );
    return pathOrder !== 0
      ? pathOrder
      : Buffer.from(left.kind).compare(Buffer.from(right.kind));
  });
  const viewOwners = new Map<string, string>();
  const canonicalPages = new Set(
    routes
      .filter(
        (route) => route.kind === "page" && route.topology === "canonical",
      )
      .map((route) => route.publicPattern),
  );
  for (const route of routes) {
    if (route.kind !== "page" || route.topology === "canonical") {
      continue;
    }
    const key = [
      route.topology,
      route.parallelSlots.join("/"),
      route.interception?.interceptingPath ?? "",
      route.publicPattern,
    ].join("\0");
    const previous = viewOwners.get(key);
    if (previous !== undefined) {
      cliFailure(
        "NXHX-CLI-ROUTE-0007",
        "Multiple route implementations claim the same parallel or intercepted view.",
        route.publicPattern,
        "one view per slot ancestry, intercepting source, and canonical target",
        `${previous}, ${route.filesystemPath}`,
        "Resolve the route-group alias or duplicate slot implementation before publication.",
      );
    }
    viewOwners.set(key, route.filesystemPath);
    if (
      route.topology === "intercepted-view" &&
      !canonicalPages.has(route.publicPattern)
    ) {
      cliFailure(
        "NXHX-CLI-ROUTE-0007",
        "An intercepted view has no canonical hard-navigation page.",
        route.filesystemPath,
        `a canonical page for ${route.publicPattern}`,
        "missing",
        "Add the ordinary canonical page; interception augments soft navigation and must not replace the hard-navigation route.",
      );
    }
  }
  if (check) {
    const preflight = preflightGeneratedOutputs({
      projectRoot: context.discovery.packageRoot,
      manifestPath: relativeManifestPath(context),
      allowedOutputRoots: [context.discovery.appRootRelative],
      allowedOutputFiles: exactConventionOutputFiles(context),
      nextVersion: plan.toolchain.next,
      genesVersion: plan.toolchain.genesTs,
      outputProfile: effectiveOutputProfile(context.config),
      outputs,
    });
    requireCurrentGeneratedTree(
      preflight,
      "NXHX-CLI-ROUTE-0007",
      "routes --check",
    );
    validationCommands(context, options.runtime, routes);
  }
  return Object.freeze({
    command: "routes",
    projectRoot: context.discovery.packageRoot,
    recovery,
    routes: Object.freeze(routes),
  });
}

export async function runBoundariesCommand(
  options: CommandBaseOptions,
): Promise<BoundariesCommandResult> {
  const context = projectContext(options);
  const plans = collectCompilationPlans(context, options.runtime, true);
  const watchPlan = createHaxeWatchPlan(context.discovery);
  const freshnessInputs = [
    ...watchPlan.exactInputs.map((input) => input.path),
    ...watchPlan.treeInputs.map((input) => input.path),
    context.discovery.appRoot,
    path.join(context.discovery.packageRoot, context.config.haxe.generatedRoot),
    path.join(context.discovery.packageRoot, "package.json"),
    path.join(context.discovery.packageRoot, "tsconfig.json"),
    ...["next.config.js", "next.config.mjs", "next.config.ts"].map((file) =>
      path.join(context.discovery.packageRoot, file),
    ),
  ];
  const nextEvidence = inspectNextClientArtifacts(
    context.discovery.packageRoot,
    plans.adapter.toolchain.next,
    { freshnessInputs },
  );
  const intentsByOwner = new Map<string, AdapterIntent[]>();
  for (const intent of plans.adapter.intents) {
    const values = intentsByOwner.get(intent.source.typeName) ?? [];
    values.push(intent);
    intentsByOwner.set(intent.source.typeName, values);
  }
  const allWarnings: BoundaryWarning[] = [];
  const boundaries = plans.boundary.boundaries.map(
    (boundary): BoundaryReport => {
      const intents = intentsByOwner.get(boundary.ownerName) ?? [];
      const intent =
        intents.find((candidate) =>
          boundary.kind === "client"
            ? candidate.kind === "client-component" ||
              candidate.kind === "error"
            : boundary.kind === "Server Function"
              ? candidate.kind === "server-function"
              : candidate.source.typeName === boundary.ownerName,
        ) ?? null;
      const defaultExport = intent?.exports.find(
        (entry) => entry.kind === "default",
      );
      const warnings: BoundaryWarning[] = [];
      const dependencyBudget = context.config.boundaries.maxDirectDependencies;
      if (
        boundary.kind === "client" &&
        dependencyBudget !== undefined &&
        boundary.dependencies.length > dependencyBudget
      ) {
        warnings.push(
          Object.freeze({
            code: "NXHX-BOUNDARY-BUDGET-0001",
            owner: boundary.ownerName,
            evidence: "haxe-known",
            actual: boundary.dependencies.length,
            budget: dependencyBudget,
            unit: "direct-dependencies",
            remediation:
              "Move the client boundary to the smallest interactive leaf, or pass server-rendered content through a serializable slot.",
          }),
        );
      }
      const generatedTarget =
        intent === null
          ? null
          : path.posix.join(
              context.discovery.appRootRelative,
              intent.targetPath,
            );
      const observed =
        generatedTarget === null
          ? undefined
          : nextEvidence.artifacts.get(generatedTarget);
      const byteBudget = context.config.boundaries.maxObservedClientBytes;
      if (
        boundary.kind === "client" &&
        observed !== undefined &&
        byteBudget !== undefined &&
        observed.bytes > byteBudget
      ) {
        warnings.push(
          Object.freeze({
            code: "NXHX-BOUNDARY-BUDGET-0001",
            owner: boundary.ownerName,
            evidence: "next-observed",
            actual: observed.bytes,
            budget: byteBudget,
            unit: "bytes",
            remediation:
              "Move the client boundary to the smallest interactive leaf, or pass server-rendered content through a serializable slot.",
          }),
        );
      }
      allWarnings.push(...warnings);
      return Object.freeze({
        evidence: "haxe-known" as const,
        owner: boundary.ownerName,
        moduleName: boundary.moduleName,
        classification: boundary.kind,
        source: boundary.position,
        generatedTarget,
        propsContract: defaultExport?.signature ?? null,
        references: boundary.references,
        dependencies: boundary.dependencies,
        nextArtifacts:
          observed === undefined
            ? Object.freeze({
                evidence: "unavailable" as const,
                reason:
                  nextEvidence.status === "unavailable"
                    ? nextEvidence.reason
                    : boundary.kind === "client"
                      ? "The compatible build did not expose this generated adapter as a client reference."
                      : "This Haxe classification does not identify a generated client entry.",
                chunks: Object.freeze([]),
                bytes: null,
                manifests: Object.freeze([]),
              })
            : Object.freeze({
                evidence: "next-observed" as const,
                reason: nextEvidence.reason,
                chunks: observed.chunks,
                bytes: observed.bytes,
                manifests: observed.manifests,
              }),
        warnings: Object.freeze(warnings),
      });
    },
  );
  const clientBoundaries = boundaries.filter(
    (boundary) => boundary.classification === "client",
  );
  const observedClientBoundaries = clientBoundaries.filter(
    (boundary) => boundary.nextArtifacts.evidence === "next-observed",
  );
  const nextStatus =
    nextEvidence.status === "unavailable" ||
    observedClientBoundaries.length === 0
      ? "unavailable"
      : observedClientBoundaries.length === clientBoundaries.length
        ? "all-client-adapters-observed"
        : "partial";
  return Object.freeze({
    command: "boundaries",
    projectRoot: ".",
    evidence: Object.freeze({
      haxe: "complete" as const,
      next: nextStatus,
    }),
    boundaries: Object.freeze(boundaries),
    warnings: Object.freeze(allWarnings),
  });
}

function doctorCheck(
  code: DoctorCheckCode,
  status: DoctorCheckStatus,
  subject: string,
  actual: string,
  resolution: string,
): DoctorCheck {
  return Object.freeze({ code, status, subject, actual, resolution });
}

function versionAtLeast(
  actual: string,
  expected: readonly [number, number, number],
): boolean {
  const match = /^(\d+)\.(\d+)\.(\d+)/.exec(actual);
  if (match === null) {
    return false;
  }
  const parts = [Number(match[1]), Number(match[2]), Number(match[3])];
  for (let index = 0; index < expected.length; index += 1) {
    if ((parts[index] as number) !== expected[index]) {
      return (parts[index] as number) > (expected[index] as number);
    }
  }
  return true;
}

function installedVersion(
  context: ProjectContext,
  packageName: string,
): string | null {
  try {
    const manifest = readPackage(installedPackageJson(context, packageName));
    return typeof manifest.version === "string" ? manifest.version : null;
  } catch {
    return null;
  }
}

function inspectManifestCheck(context: ProjectContext): DoctorCheck {
  if (!existsSync(context.manifestPath)) {
    return doctorCheck(
      "NXHX-DOCTOR-MANIFEST-0006",
      "pass",
      relativeManifestPath(context),
      "absent; no generated output is owned",
      "Run generate when the first Haxe route is ready.",
    );
  }
  try {
    const manifest = readManifest(context) as GeneratedOutputManifest;
    preflightGeneratedOutputs({
      projectRoot: context.discovery.packageRoot,
      manifestPath: relativeManifestPath(context),
      allowedOutputRoots: [context.discovery.appRootRelative],
      allowedOutputFiles: exactConventionOutputFiles(context),
      nextVersion: manifest.nextVersion,
      genesVersion: manifest.genesVersion,
      outputProfile: manifest.outputProfile,
      outputs: manifest.outputs.map((output) => ({
        path: output.path,
        kind: output.kind,
        source: output.source,
        content: "",
      })),
    });
    return doctorCheck(
      "NXHX-DOCTOR-MANIFEST-0006",
      "pass",
      relativeManifestPath(context),
      `${manifest.outputs.length} exact owned output(s), generation ${manifest.generation}`,
      "No action required.",
    );
  } catch (error) {
    return doctorCheck(
      "NXHX-DOCTOR-MANIFEST-0006",
      "fail",
      relativeManifestPath(context),
      error instanceof Error ? error.message : "unknown manifest failure",
      "Preserve live bytes and use explicit repair; do not regenerate over drift.",
    );
  }
}

/**
 * Verify fallback bytes without compiling Haxe. A dev startup may retain these
 * bytes after a failed initial compile, but an absent, modified, or unsafe tree
 * is never treated as last-good state.
 */
export function verifyLastGoodGeneratedTree(
  options: CommandBaseOptions,
): LastGoodGeneratedTree {
  const context = projectContext(options);
  if (!existsSync(context.manifestPath)) {
    return Object.freeze({
      ok: false,
      reason: "ownership manifest is absent",
      manifestGeneration: null,
      generatedEntries: 0,
    });
  }
  if (
    existsSync(
      path.join(context.discovery.packageRoot, ".nextjshx/transaction.json"),
    ) ||
    existsSync(
      path.join(
        context.discovery.packageRoot,
        ".nextjshx/transaction.json.tmp",
      ),
    )
  ) {
    return Object.freeze({
      ok: false,
      reason: "publication journal state is still active",
      manifestGeneration: null,
      generatedEntries: 0,
    });
  }
  const manifestCheck = inspectManifestCheck(context);
  if (manifestCheck.status !== "pass") {
    return Object.freeze({
      ok: false,
      reason: manifestCheck.actual,
      manifestGeneration: null,
      generatedEntries: 0,
    });
  }
  try {
    const generated = inspectGeneratedRoot(context);
    if (!generated.present || generated.entries === 0) {
      return Object.freeze({
        ok: false,
        reason: "configured Haxe generated tree is absent or empty",
        manifestGeneration: null,
        generatedEntries: 0,
      });
    }
    const manifest = readManifest(context);
    return Object.freeze({
      ok: manifest !== null,
      reason: manifest === null ? "ownership manifest disappeared" : "verified",
      manifestGeneration: manifest?.generation ?? null,
      generatedEntries: generated.entries,
    });
  } catch (error) {
    return Object.freeze({
      ok: false,
      reason:
        error instanceof Error
          ? error.message
          : "generated tree verification failed",
      manifestGeneration: null,
      generatedEntries: 0,
    });
  }
}

function inspectConfiguredPaths(context: ProjectContext): DoctorCheck {
  const configured = context.discovery.configuredPaths;
  if (configured === null) {
    return doctorCheck(
      "NXHX-DOCTOR-APP-ROOT-0005",
      "fail",
      "configured project paths",
      "missing resolved paths",
      "Restore the required schema-v1 project configuration.",
    );
  }
  try {
    const hxml = lstatSync(configured.hxml);
    if (hxml.isSymbolicLink() || !hxml.isFile()) {
      throw new Error("configured Haxe build is not a real regular file");
    }
    const generatedInspection = inspectGeneratedRoot(context);
    const generated = generatedInspection.present
      ? `${path.relative(context.discovery.packageRoot, configured.generatedRoot)} ` +
        `(${generatedInspection.entries} removable generated entries)`
      : "absent until Haxe emits it";
    return doctorCheck(
      "NXHX-DOCTOR-APP-ROOT-0005",
      "pass",
      "configured project paths",
      `app ${context.discovery.appRootRelative}; hxml ${path.relative(context.discovery.packageRoot, context.hxmlPath)} (compiler-owned); generated ${generated}`,
      "No action required.",
    );
  } catch (error) {
    return doctorCheck(
      "NXHX-DOCTOR-APP-ROOT-0005",
      "fail",
      "configured project paths",
      error instanceof Error ? error.message : "unsafe configured path",
      "Keep the App Router root, Haxe build, and generated root as real package-contained paths.",
    );
  }
}

function planDoctorChecks(
  context: ProjectContext,
  runtime: CommandRuntime | undefined,
): readonly DoctorCheck[] {
  try {
    const plan = collectAdapterPlan(context, runtime, true);
    for (const intent of plan.intents) {
      if (isRouteFileIntent(intent)) {
        routeShape(intent.segmentPath, intent.source.typeName);
      }
    }
    const planDirectory = path.join(
      context.discovery.packageRoot,
      ...PLAN_DIRECTORY.split("/"),
    );
    const residualPlans = readdirSync(planDirectory).sort();
    const effectiveDefines = effectiveHaxeDefines(context.config);
    return Object.freeze([
      doctorCheck(
        "NXHX-DOCTOR-PLAN-0010",
        residualPlans.length === 0
          ? "pass"
          : "fail",
        "Haxe adapter plan",
        `${plan.intents.length} canonical intent(s); genes-ts ${plan.toolchain.genesTs}; ` +
          `${residualPlans.length} stale plan artifact(s); ` +
          `${effectiveDefines.length} compiler/application define(s) derived`,
        residualPlans.length === 0
          ? "No action required."
          : "Remove only proven-stale plan files after confirming no CLI process owns them.",
      ),
    ]);
  } catch (error) {
    return Object.freeze([
      doctorCheck(
        "NXHX-DOCTOR-PLAN-0010",
        "fail",
        "Haxe adapter plan",
        error instanceof Error ? error.message : "unknown Haxe/plan failure",
        "Fix Haxe diagnostics, duplicate claims, or unsupported route syntax.",
      ),
    ]);
  }
}

export async function runDoctorCommand(
  options: CommandBaseOptions,
): Promise<DoctorCommandResult> {
  const context = projectContext(options);
  const runtime = runtimeValue(options.runtime);
  const checks: DoctorCheck[] = [];
  const nodeVersion = process.versions.node;
  checks.push(
    doctorCheck(
      "NXHX-DOCTOR-NODE-0001",
      versionAtLeast(nodeVersion, [20, 9, 0]) ? "pass" : "fail",
      "Node.js",
      nodeVersion,
      "Use Node.js 20.9.0 or newer, matching the supported Next.js floor.",
    ),
  );
  const haxe = tool(runtime, "haxeCommand", () => ({
    command: "haxe",
    argsPrefix: [],
  }));
  try {
    const request: ProcessRequest = {
      command: haxe.command,
      args: [...haxe.argsPrefix, "--version"],
      cwd: context.discovery.packageRoot,
      source: "haxe",
    };
    const result = runtime.processRunner(request);
    const actualHaxe = processOutput(result);
    checks.push(
      doctorCheck(
        "NXHX-DOCTOR-HAXE-0002",
        result.exitCode === 0 && actualHaxe === HAXE_VERSION ? "pass" : "fail",
        "Haxe",
        actualHaxe || `exit ${result.exitCode}`,
        `Install project-pinned Haxe ${HAXE_VERSION} and ensure it is on PATH.`,
      ),
    );
  } catch (error) {
    checks.push(
      doctorCheck(
        "NXHX-DOCTOR-HAXE-0002",
        "fail",
        "Haxe",
        error instanceof Error ? error.message : "cannot execute",
        "Install the project-pinned Haxe version and ensure it is on PATH.",
      ),
    );
  }
  checks.push(
    doctorCheck(
      "NXHX-DOCTOR-NEXT-0003",
      context.discovery.nextPackage.installedVersion === NEXT_VERSION
        ? "pass"
        : "fail",
      context.config.next.package,
      `requested ${context.discovery.nextPackage.requestedVersion ?? "undeclared"}; installed ${context.discovery.nextPackage.installedVersion ?? "missing"}`,
      `Install the configured Next package at the verified ${NEXT_VERSION} pin.`,
    ),
  );
  const reactVersion = installedVersion(context, "react");
  const reactDomVersion = installedVersion(context, "react-dom");
  const typescriptVersion = installedVersion(context, "typescript");
  checks.push(
    doctorCheck(
      "NXHX-DOCTOR-PACKAGES-0004",
      reactVersion === REACT_VERSION &&
        reactDomVersion === REACT_VERSION &&
        typescriptVersion === TYPESCRIPT_VERSION
        ? "pass"
        : "fail",
      "React, React DOM, and TypeScript",
      `react ${reactVersion ?? "missing"}; react-dom ${reactDomVersion ?? "missing"}; ` +
        `typescript ${typescriptVersion ?? "missing"}`,
      `Install React/React DOM ${REACT_VERSION} and TypeScript ${TYPESCRIPT_VERSION}.`,
    ),
    inspectConfiguredPaths(context),
    inspectManifestCheck(context),
  );
  const controlRoot = path.join(context.discovery.packageRoot, ".nextjshx");
  const journal = path.join(controlRoot, "transaction.json");
  const journalTemporary = path.join(controlRoot, "transaction.json.tmp");
  const lock = path.join(controlRoot, "publish.lock");
  const transactions = path.join(controlRoot, "transactions");
  const transactionArtifacts = [
    ...(existsSync(journal) ? ["journal present"] : []),
    ...(existsSync(journalTemporary) ? ["journal temporary present"] : []),
    ...(existsSync(lock) ? ["lock present"] : []),
  ];
  if (existsSync(transactions)) {
    try {
      const stats = lstatSync(transactions);
      if (stats.isSymbolicLink() || !stats.isDirectory()) {
        transactionArtifacts.push("transactions path is not a real directory");
      } else {
        transactionArtifacts.push(
          ...readdirSync(transactions)
            .sort()
            .map((entry) => `workspace ${entry}`),
        );
      }
    } catch (error) {
      transactionArtifacts.push(
        error instanceof Error ? error.message : "transactions path unreadable",
      );
    }
  }
  const interrupted = transactionArtifacts.length > 0;
  checks.push(
    doctorCheck(
      "NXHX-DOCTOR-TRANSACTION-0007",
      interrupted ? "fail" : "pass",
      ".nextjshx transaction state",
      interrupted
        ? transactionArtifacts.join("; ")
        : "no active journal, lock, or transaction workspace",
      interrupted
        ? "Run a normal command to invoke exact-hash recovery, then rerun doctor."
        : "No action required.",
    ),
  );
  const tsconfigPath = path.join(
    context.discovery.packageRoot,
    "tsconfig.json",
  );
  try {
    const tsconfig = requireStrictTsconfig(
      tsconfigPath,
      "NXHX-CLI-DOCTOR-0008",
    );
    const include = Array.isArray(tsconfig.raw.include)
      ? tsconfig.raw.include
      : [];
    const hasNextTypes = include.some(
      (entry) => typeof entry === "string" && entry.includes(".next/types"),
    );
    checks.push(
      doctorCheck(
        "NXHX-DOCTOR-TSCONFIG-0008",
        hasNextTypes ? "pass" : "fail",
        "tsconfig.json Next route types",
        hasNextTypes
          ? "strict and includes .next/types"
          : "strict but missing .next/types include",
        "Run next typegen and retain Next's generated .next/types include with strict mode enabled.",
      ),
    );
  } catch (error) {
    checks.push(
      doctorCheck(
        "NXHX-DOCTOR-TSCONFIG-0008",
        "fail",
        "tsconfig.json",
        error instanceof Error ? error.message : "missing or malformed",
        "Restore a strict Next TypeScript configuration.",
      ),
    );
  }
  const packageJson = readPackage(context.discovery.packageJsonPath);
  const scripts =
    typeof packageJson.scripts === "object" &&
    packageJson.scripts !== null &&
    !Array.isArray(packageJson.scripts)
      ? Object.values(packageJson.scripts as Record<string, unknown>)
      : [];
  const hasScript = scripts.some(
    (value) => typeof value === "string" && value.includes("nextjshx"),
  );
  checks.push(
    doctorCheck(
      "NXHX-DOCTOR-SCRIPTS-0009",
      hasScript ? "pass" : "warn",
      "package scripts",
      hasScript
        ? "at least one NextJsHx script configured"
        : "no NextJsHx script configured",
      "Add explicit generate/typecheck scripts during nextjshx setup.",
    ),
    ...planDoctorChecks(context, options.runtime),
  );
  if (context.discovery.configuredPaths?.upstreamDir === undefined) {
    checks.push(
      doctorCheck(
        "NXHX-DOCTOR-UPSTREAM-0011",
        "info",
        "optional Next upstream checkout",
        "not configured",
        "Configure $.next.upstreamDir only for maintainer compatibility work.",
      ),
    );
  } else {
    const upstream = context.discovery.configuredPaths.upstreamDir;
    let status: DoctorCheckStatus = "fail";
    let actual = "missing";
    try {
      if (statSync(upstream).isDirectory()) {
        const git = tool(runtime, "gitCommand", () => ({
          command: "git",
          argsPrefix: [],
        }));
        const request: ProcessRequest = {
          command: git.command,
          args: [...git.argsPrefix, "-C", upstream, "rev-parse", "HEAD"],
          cwd: context.discovery.packageRoot,
          source: "git",
        };
        const result = runtime.processRunner(request);
        const commit = processOutput(result);
        const upstreamPackage = readPackage(
          path.join(upstream, "packages/next/package.json"),
        );
        const version =
          typeof upstreamPackage.version === "string"
            ? upstreamPackage.version
            : "missing";
        status =
          result.exitCode === 0 &&
          commit === NEXT_UPSTREAM_COMMIT &&
          version === NEXT_UPSTREAM_VERSION
            ? "pass"
            : "fail";
        actual = `version ${version}; commit ${commit || `exit ${result.exitCode}`}`;
      }
    } catch (error) {
      actual =
        error instanceof Error ? error.message : "unreadable upstream checkout";
    }
    checks.push(
      doctorCheck(
        "NXHX-DOCTOR-UPSTREAM-0011",
        status,
        "optional Next upstream checkout",
        actual,
        `Use Next ${NEXT_UPSTREAM_VERSION} at exact commit ${NEXT_UPSTREAM_COMMIT}, or remove upstreamDir outside maintainer lanes.`,
      ),
    );
  }
  checks.push(
    doctorCheck(
      "NXHX-DOCTOR-UNSUPPORTED-0012",
      "info",
      "known deferred features",
      "Pages Router entries, custom route extensions, directly client-marked pages/layouts, and remaining special-file conventions remain separately tracked",
      "Use only support-matrix-backed features; follow the linked Beads for deferred syntax.",
    ),
  );
  return Object.freeze({
    command: "doctor",
    projectRoot: context.discovery.packageRoot,
    ok: !checks.some((check) => check.status === "fail"),
    checks: Object.freeze(checks),
  });
}

export async function runBuildCommand(
  options: BuildCommandOptions,
): Promise<BuildCommandResult> {
  const nextArguments = validatedNextBuildArguments(options.nextArgs ?? []);
  const doctor = await runDoctorCommand(options);
  if (!doctor.ok) {
    const failed = doctor.checks
      .filter((check) => check.status === "fail")
      .map((check) => `${check.code}:${check.subject}`);
    cliFailure(
      "NXHX-CLI-BUILD-0009",
      "Production build stopped because doctor found a failing prerequisite.",
      "doctor",
      "no failing environment, configuration, ownership, or plan checks",
      failed.join(", "),
      "Resolve every failing doctor check, then restart the production build from the beginning.",
    );
  }

  const context = projectContext(options);
  const cleanedGeneratedEntries = cleanGeneratedRoot(context);
  const generation = await runGenerateCommand({
    start: options.start,
    ...(options.configPath === undefined
      ? {}
      : { configPath: options.configPath }),
    ...(options.runtime === undefined ? {} : { runtime: options.runtime }),
    validate: true,
  });
  const generatedEntries = requireFreshGeneratedRoot(context);

  const runtime = runtimeValue(options.runtime);
  const next = tool(runtime, "nextCommand", () =>
    packageCommand(context, context.config.next.package, ["next"]),
  );
  const request: ProcessRequest = {
    command: next.command,
    args: [...next.argsPrefix, "build", ".", ...nextArguments],
    cwd: context.discovery.packageRoot,
    source: "next-build",
  };
  const nextResult = runtime.processRunner(request);
  if (nextResult.exitCode !== 0) {
    commandResultFailure(
      "NXHX-CLI-BUILD-0009",
      "Next.js production build",
      request,
      nextResult,
    );
  }
  const nextOutput = processOutput(nextResult);
  if (/Skipping validation of types/i.test(nextOutput)) {
    cliFailure(
      "NXHX-CLI-BUILD-0009",
      "Next.js production build skipped its framework-owned TypeScript validation.",
      "next build output",
      "the pinned Next.js build running TypeScript with type errors enabled",
      "Next reported that validation of types was skipped",
      "Remove typescript.ignoreBuildErrors and keep Next's production type gate enabled.",
    );
  }
  if (!/Running TypeScript/i.test(nextOutput)) {
    cliFailure(
      "NXHX-CLI-BUILD-0009",
      "Next.js production build did not prove that its TypeScript gate ran.",
      "next build output",
      `Next ${NEXT_VERSION} output containing its Running TypeScript phase`,
      nextOutput.length === 0 ? "empty output" : nextOutput.slice(0, 16_384),
      "Keep type errors enabled and investigate output drift before accepting the production build.",
    );
  }

  const verificationPlan = collectAdapterPlan(context, options.runtime, true);
  const verificationOutputs = await formattedPlanOutputs(
    context,
    verificationPlan,
  );
  const verification = preflightGeneratedOutputs({
    projectRoot: context.discovery.packageRoot,
    manifestPath: relativeManifestPath(context),
    allowedOutputRoots: [context.discovery.appRootRelative],
    allowedOutputFiles: exactConventionOutputFiles(context),
    nextVersion: verificationPlan.toolchain.next,
    genesVersion: verificationPlan.toolchain.genesTs,
    outputProfile: effectiveOutputProfile(context.config),
    outputs: verificationOutputs,
  });
  requireCurrentGeneratedTree(
    verification,
    "NXHX-CLI-BUILD-0009",
    "build verification",
  );

  return Object.freeze({
    command: "build",
    projectRoot: context.discovery.packageRoot,
    doctor: "passed",
    cleanedGeneratedEntries,
    generatedEntries,
    generation,
    nextArguments,
    nextBuild: "passed",
    manifestGeneration: verification.intendedManifest.generation,
    verifiedOutputs: verification.intendedManifest.outputs.length,
    nextOutput,
  });
}

export function commandErrorJson(error: unknown): unknown {
  if (
    typeof error === "object" &&
    error !== null &&
    "toJSON" in error &&
    typeof (error as { readonly toJSON?: unknown }).toJSON === "function"
  ) {
    return (error as { toJSON(): unknown }).toJSON();
  }
  if (error instanceof CliDiagnosticError) {
    return error.toJSON();
  }
  return Object.freeze({
    code: "NXHX-CLI-PROCESS-0002",
    message: error instanceof Error ? error.message : "unknown command failure",
    docs: "docs/cli.md",
  });
}
