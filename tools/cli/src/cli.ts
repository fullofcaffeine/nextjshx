#!/usr/bin/env node

import { realpathSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { cliFailure } from "./cli-diagnostic.js";
import {
  type DevCommandOptions,
  type DevCommandResult,
  runDevCommand,
} from "./dev.js";
import {
  type BoundariesCommandResult,
  type BuildCommandResult,
  type CleanCommandResult,
  type CommandRuntime,
  type DoctorCommandResult,
  type GenerateCommandResult,
  type OwnershipTransferCommandResult,
  NEXTJSHX_VERSION,
  type RoutesCommandResult,
  type TypecheckCommandResult,
  commandErrorJson,
  runBuildCommand,
  runCleanCommand,
  runBoundariesCommand,
  runDoctorCommand,
  runGenerateCommand,
  runOwnershipTransferCommand,
  runRoutesCommand,
  runTypecheckCommand,
} from "./commands.js";
import {
  type InitCommandResult,
  runInitCommand,
} from "./init.js";
import {
  type ProfileCommandOperation,
  type ProfileCommandResult,
  runProfileCommand,
} from "./profile.js";

const USAGE = `NextJsHx ${NEXTJSHX_VERSION}

Usage:
  nextjshx init [--json] [--typed-routes]
  nextjshx generate [--json] [--no-check] [--config <path>]
  nextjshx clean [--json] [--config <path>]
  nextjshx adopt <path> [--json] [--config <path>]
  nextjshx release <path> [--json] [--config <path>]
  nextjshx repair <path> [--json] [--config <path>]
  nextjshx typecheck [--json] [--config <path>]
  nextjshx routes [--json] [--check] [--config <path>]
  nextjshx boundaries [--json] [--config <path>]
  nextjshx profile <show|list|validate> [--json] [--config <path>]
  nextjshx doctor [--json] [--config <path>]
  nextjshx build [--json] [--config <path>] [-- <Next build flags>]
  nextjshx dev [--config <path>] [-- <Next dev flags>]
  nextjshx --help
  nextjshx --version

Commands:
  init       Safely initialize absent Haxe files, config, ignores, and scripts.
  generate   Compile Haxe and transactionally publish owned adapters.
  clean      Transactionally remove only the complete verified ownership set.
  adopt      Claim one byte-identical native adapter requested by the Haxe plan.
  release    Leave one verified adapter in place while dropping its ownership.
  repair     Restore one missing or modified owned adapter from the Haxe plan.
  typecheck  Compile Haxe, run Next route typegen, then strict TypeScript.
  routes     Report Haxe/native routes, ownership, parameters, and optional parity.
  boundaries Explain Haxe-known boundaries and available Next client artifacts.
  profile    Report configured output policy, maturity, and capability gaps.
  doctor     Inspect the pinned toolchain and fail-closed project state.
  build      Run the complete production build and verify fresh owned output.
  dev        Watch Haxe and run one Next development server with native Fast Refresh.
`;

type CommandName =
  | "init"
  | "generate"
  | "clean"
  | "adopt"
  | "release"
  | "repair"
  | "typecheck"
  | "routes"
  | "boundaries"
  | "profile"
  | "doctor"
  | "build"
  | "dev";

export type DevCommandRunner = (
  options: DevCommandOptions,
) => Promise<DevCommandResult>;

export interface CliIo {
  readonly cwd?: string;
  readonly stdout?: (value: string) => void;
  readonly stderr?: (value: string) => void;
}

interface ParsedArguments {
  readonly command: CommandName;
  readonly json: boolean;
  readonly configPath?: string;
  readonly noCheck: boolean;
  readonly check: boolean;
  readonly typedRoutes: boolean;
  readonly profileOperation?: ProfileCommandOperation;
  readonly nextArgs: readonly string[];
  readonly path?: string;
}

function usageFailure(message: string, actual: string): never {
  cliFailure(
    "NXHX-CLI-USAGE-0001",
    message,
    "command line",
    "one documented command and only its documented flags",
    actual,
    "Run nextjshx --help and correct the invocation.",
  );
}

function requiredTransferPath(value: string | undefined): string {
  if (value === undefined) {
    usageFailure("An ownership-transfer path is required.", "missing");
  }
  return value;
}

function requiredProfileOperation(
  value: ProfileCommandOperation | undefined,
): ProfileCommandOperation {
  if (value === undefined) {
    usageFailure("A profile operation is required.", "missing");
  }
  return value;
}

function parseArguments(
  args: readonly string[],
): ParsedArguments | "help" | "version" {
  if (args.length === 1 && (args[0] === "--help" || args[0] === "-h")) {
    return "help";
  }
  if (args.length === 1 && (args[0] === "--version" || args[0] === "-v")) {
    return "version";
  }
  const command = args[0];
  if (
    command !== "init" &&
    command !== "generate" &&
    command !== "clean" &&
    command !== "adopt" &&
    command !== "release" &&
    command !== "repair" &&
    command !== "typecheck" &&
    command !== "routes" &&
    command !== "boundaries" &&
    command !== "profile" &&
    command !== "doctor" &&
    command !== "build" &&
    command !== "dev"
  ) {
    usageFailure(
      "A supported NextJsHx command is required.",
      command ?? "missing",
    );
  }

  let json = false;
  let noCheck = false;
  let check = false;
  let typedRoutes = false;
  let configPath: string | undefined;
  const nextArgs: string[] = [];
  let transferPath: string | undefined;
  let profileOperation: ProfileCommandOperation | undefined;
  for (let index = 1; index < args.length; index += 1) {
    const argument = args[index] as string;
    if (argument === "--") {
      if (command !== "build" && command !== "dev") {
        usageFailure(
          "Only build and dev accept a Next.js argument separator.",
          argument,
        );
      }
      nextArgs.push(...args.slice(index + 1));
      break;
    }
    switch (argument) {
      case "--json":
        if (json || command === "dev") {
          usageFailure(
            command === "dev"
              ? "The long-running dev stream does not support --json."
              : "--json was provided more than once.",
            argument,
          );
        }
        json = true;
        break;
      case "--no-check":
        if (command !== "generate" || noCheck) {
          usageFailure(
            "--no-check is accepted once and only by generate.",
            argument,
          );
        }
        noCheck = true;
        break;
      case "--check":
        if (command !== "routes" || check) {
          usageFailure(
            "--check is accepted once and only by routes.",
            argument,
          );
        }
        check = true;
        break;
      case "--typed-routes":
        if (command !== "init" || typedRoutes) {
          usageFailure(
            "--typed-routes is accepted once and only by init.",
            argument,
          );
        }
        typedRoutes = true;
        break;
      case "--config": {
        if (command === "init") {
          usageFailure(
            "init discovers the target package and does not accept --config.",
            argument,
          );
        }
        const value = args[index + 1];
        if (
          configPath !== undefined ||
          value === undefined ||
          value.length === 0 ||
          value.startsWith("-")
        ) {
          usageFailure(
            "--config requires one path value and may appear once.",
            value ?? "missing",
          );
        }
        configPath = value;
        index += 1;
        break;
      }
      case "--help":
      case "-h":
        usageFailure(
          "Command help is available through nextjshx --help.",
          argument,
        );
      default:
        if (command === "build") {
          nextArgs.push(argument);
        } else if (
          (command === "adopt" ||
            command === "release" ||
            command === "repair") &&
          transferPath === undefined &&
          !argument.startsWith("-")
        ) {
          transferPath = argument;
        } else if (
          command === "profile" &&
          profileOperation === undefined &&
          (argument === "show" ||
            argument === "list" ||
            argument === "validate")
        ) {
          profileOperation = argument;
        } else {
          usageFailure("The command contains an unknown argument.", argument);
        }
    }
  }
  if (
    (command === "adopt" ||
      command === "release" ||
      command === "repair") &&
    transferPath === undefined
  ) {
    usageFailure(`${command} requires one generated adapter path.`, "missing");
  }
  if (command === "profile" && profileOperation === undefined) {
    usageFailure(
      "profile requires one operation: show, list, or validate.",
      "missing",
    );
  }
  return Object.freeze({
    command,
    json,
    ...(configPath === undefined ? {} : { configPath }),
    noCheck,
    check,
    typedRoutes,
    ...(profileOperation === undefined ? {} : { profileOperation }),
    nextArgs: Object.freeze(nextArgs),
    ...(transferPath === undefined ? {} : { path: transferPath }),
  });
}

function linesForChanges(
  changes: Readonly<
    Record<"create" | "update" | "unchanged" | "remove", readonly string[]>
  >,
): readonly string[] {
  const lines: string[] = [];
  for (const disposition of [
    "create",
    "update",
    "unchanged",
    "remove",
  ] as const) {
    lines.push(`${disposition} (${changes[disposition].length})`);
    lines.push(...changes[disposition].map((file) => `  ${file}`));
  }
  return lines;
}

function humanGenerate(result: GenerateCommandResult): string {
  return [
    `generate: ${result.publication.action}`,
    `project: ${result.projectRoot}`,
    `recovery: ${result.recovery.action}`,
    ...linesForChanges({
      create: result.publication.created,
      update: result.publication.updated,
      unchanged: result.publication.unchanged,
      remove: result.publication.removed,
    }),
    `blocked (${result.blocked.length})`,
    ...result.blocked.map((file) => `  ${file}`),
    `validation: ${result.validation}`,
  ].join("\n");
}

function humanInit(result: InitCommandResult): string {
  const lines = [
    `init: ${result.action}`,
    `project: ${result.projectRoot}`,
    `package manager: ${result.packageManager}`,
    `app root: ${result.appRoot}`,
    `typed routes: ${result.typedRoutes}`,
    "files:",
    ...result.files.map(
      (file) => `  ${file.action} ${file.path} — ${file.reason}`,
    ),
    "package scripts:",
  ];
  for (const script of result.scripts) {
    lines.push(
      `  ${script.action} ${script.name}: ${script.previous === null ? "(absent)" : script.previous} -> ${script.proposed}`,
    );
  }
  lines.push("next:");
  lines.push(...result.followUp.map((command) => `  ${command}`));
  return lines.join("\n");
}

function humanClean(result: CleanCommandResult): string {
  return [
    `clean: ${result.action}`,
    `project: ${result.projectRoot}`,
    `recovery: ${result.recovery.action}`,
    `removed (${result.removed.length})`,
    ...result.removed.map((file) => `  ${file}`),
    `ownership manifest: ${result.retainedManifest ? "retained empty" : "absent"}`,
  ].join("\n");
}

function humanOwnershipTransfer(result: OwnershipTransferCommandResult): string {
  return [
    `${result.command}: ${result.publication.action}`,
    `project: ${result.projectRoot}`,
    `path: ${result.path}`,
    `recovery: ${result.recovery.action}`,
    `validation: ${result.validation}`,
  ].join("\n");
}

function humanTypecheck(result: TypecheckCommandResult): string {
  return [
    "typecheck: passed",
    `project: ${result.projectRoot}`,
    `recovery: ${result.recovery.action}`,
    ...linesForChanges(result.planned),
    `next typegen: ${result.nextTypegen}`,
    `strict TypeScript: ${result.typescript}`,
  ].join("\n");
}

function humanRoutes(result: RoutesCommandResult): string {
  const lines = [
    `routes: ${result.routes.length}`,
    `project: ${result.projectRoot}`,
    `recovery: ${result.recovery.action}`,
  ];
  for (const route of result.routes) {
    const parameters =
      route.parameters.length === 0
        ? "none"
        : route.parameters
            .map((parameter) => `${parameter.name}:${parameter.kind}`)
            .join(",");
    const slots =
      route.parallelSlots.length === 0 ? "none" : route.parallelSlots.join(",");
    const interception =
      route.interception === null
        ? "none"
        : `${route.interception.marker}:${route.interception.interceptingPath}->${route.interception.interceptedPath}`;
    lines.push(
      `${route.publicPattern} | ${route.origin} | ${route.kind} | ${route.filesystemPath} | ` +
        `topology=${route.topology} | slots=${slots} | interception=${interception} | ` +
        `params=${parameters} | ownership=${route.ownership} | parity=${route.parity}`,
    );
  }
  return lines.join("\n");
}

function humanBoundaries(result: BoundariesCommandResult): string {
  const lines = [
    `boundaries: ${result.boundaries.length}`,
    `project: ${result.projectRoot}`,
    `evidence: Haxe ${result.evidence.haxe}; Next ${result.evidence.next}`,
  ];
  for (const boundary of result.boundaries) {
    lines.push(
      `${boundary.owner} | ${boundary.classification} | ` +
        `${boundary.generatedTarget ?? "no generated adapter"} | ` +
        `${boundary.source.file}:${boundary.source.startLine}:${boundary.source.startCharacter}`,
    );
    lines.push(
      `  props: ${boundary.propsContract ?? "not a component boundary"}`,
    );
    lines.push(`  dependencies (${boundary.dependencies.length})`);
    for (const dependency of boundary.dependencies) {
      lines.push(
        `    ${dependency.moduleName} | ${dependency.classification} | ` +
          `${dependency.position.file}:${dependency.position.startLine}:${dependency.position.startCharacter}`,
      );
    }
    lines.push(`  refs (${boundary.references.length})`);
    for (const reference of boundary.references) {
      lines.push(
        `    ${reference.kind} ${reference.targetOwner}.${reference.targetField} -> ` +
          `${reference.targetPath} | ` +
          `${reference.position.file}:${reference.position.startLine}:${reference.position.startCharacter}`,
      );
    }
    lines.push(
      `  Next artifacts: ${boundary.nextArtifacts.evidence}` +
        (boundary.nextArtifacts.bytes === null
          ? ""
          : ` | ${boundary.nextArtifacts.bytes} bytes | ${boundary.nextArtifacts.chunks.length} chunks`),
    );
    lines.push(`    ${boundary.nextArtifacts.reason}`);
    for (const chunk of boundary.nextArtifacts.chunks) {
      lines.push(`    ${chunk}`);
    }
    for (const warning of boundary.warnings) {
      lines.push(
        `  [WARN] ${warning.code}: ${warning.actual} ${warning.unit} exceeds ` +
          `${warning.budget}; ${warning.remediation}`,
      );
    }
  }
  return lines.join("\n");
}

function humanDoctor(result: DoctorCommandResult): string {
  const lines = [
    `doctor: ${result.ok ? "healthy" : "failed"}`,
    `project: ${result.projectRoot}`,
  ];
  for (const check of result.checks) {
    lines.push(
      `[${check.status.toUpperCase()}] ${check.code} ${check.subject}: ${check.actual}`,
    );
    if (check.status !== "pass" && check.status !== "info") {
      lines.push(`  resolution: ${check.resolution}`);
    }
  }
  return lines.join("\n");
}

function humanProfile(result: ProfileCommandResult): string {
  const lines = [
    `profile ${result.operation}: ${result.qualified ? "qualified" : "not qualified"}`,
    `project: ${result.projectRoot}`,
    `selected: ${result.profile.language}/${result.profile.intent}`,
    `profile version: ${result.profile.profileVersion}`,
    `maturity: ${result.maturity}`,
    `fingerprint: ${result.fingerprint}`,
    `unsupported capabilities (${result.unsupportedCapabilities.length})`,
    ...result.unsupportedCapabilities.map((capability) => `  ${capability}`),
    `migration: ${result.migration === null ? "none" : `schema ${result.migration.fromSchemaVersion}->${result.migration.toSchemaVersion}`}`,
  ];
  if (result.operation === "list") {
    lines.push(`cells (${result.cells.length})`);
    for (const cell of result.cells) {
      lines.push(
        `  ${cell.language}/${cell.intent} | ${cell.maturity} | ` +
          `${cell.unsupportedCapabilities.length} unsupported`,
      );
    }
  }
  return lines.join("\n");
}

function humanBuild(result: BuildCommandResult): string {
  const summary = [
    "build: passed",
    `project: ${result.projectRoot}`,
    `doctor: ${result.doctor}`,
    `cleaned generated entries: ${result.cleanedGeneratedEntries}`,
    `fresh generated entries: ${result.generatedEntries}`,
    `generation: ${result.generation.publication.action}`,
    `next build: ${result.nextBuild}`,
    `verified outputs: ${result.verifiedOutputs}`,
    `manifest generation: ${result.manifestGeneration}`,
    `next arguments: ${result.nextArguments.length === 0 ? "none" : result.nextArguments.join(" ")}`,
  ].join("\n");
  return result.nextOutput.length === 0
    ? summary
    : `${result.nextOutput}\n\n${summary}`;
}

function machineResult(
  result:
    | InitCommandResult
    | BuildCommandResult
    | CleanCommandResult
    | OwnershipTransferCommandResult
    | GenerateCommandResult
    | TypecheckCommandResult
    | RoutesCommandResult
    | BoundariesCommandResult
    | ProfileCommandResult
    | DoctorCommandResult,
): unknown {
  if (result.command !== "build") {
    return result;
  }
  const { nextOutput: _nextOutput, ...bounded } = result;
  return bounded;
}

function humanError(error: unknown): string {
  const decoded = commandErrorJson(error);
  if (
    typeof decoded !== "object" ||
    decoded === null ||
    Array.isArray(decoded)
  ) {
    return "NXHX-CLI-PROCESS-0002: unknown command failure";
  }
  const diagnostic = decoded as Record<string, unknown>;
  const lines = [`${String(diagnostic.code)}: ${String(diagnostic.message)}`];
  for (const key of [
    "target",
    "subject",
    "source",
    "expected",
    "actual",
    "resolution",
    "docs",
  ] as const) {
    if (typeof diagnostic[key] === "string") {
      lines.push(`${key}: ${diagnostic[key]}`);
    }
  }
  return lines.join("\n");
}

function blockedOutputs(
  decoded: unknown,
  command: string | undefined,
): readonly string[] {
  if (
    (command !== "generate" &&
      command !== "clean" &&
      command !== "adopt" &&
      command !== "release" &&
      command !== "repair" &&
      command !== "build") ||
    typeof decoded !== "object" ||
    decoded === null ||
    Array.isArray(decoded)
  ) {
    return Object.freeze([]);
  }
  const diagnostic = decoded as Record<string, unknown>;
  return typeof diagnostic.code === "string" &&
    diagnostic.code.startsWith("NXHX-OWNERSHIP-") &&
    typeof diagnostic.target === "string"
    ? Object.freeze([diagnostic.target])
    : Object.freeze([]);
}

export async function runCli(
  args: readonly string[],
  io: CliIo = {},
  runtime?: CommandRuntime,
  devRunner: DevCommandRunner = runDevCommand,
): Promise<number> {
  const stdout = io.stdout ?? ((value: string) => process.stdout.write(value));
  const stderr = io.stderr ?? ((value: string) => process.stderr.write(value));
  const separator = args.indexOf("--");
  const cliArguments = separator === -1 ? args : args.slice(0, separator);
  // `dev` is always a human-readable live stream. A token after the separator
  // belongs to Next, and must never silently switch CLI diagnostic encoding.
  let jsonRequested = args[0] !== "dev" && cliArguments.includes("--json");
  let selectedCommand: string | undefined = args[0];
  try {
    const parsed = parseArguments(args);
    if (parsed === "help") {
      stdout(USAGE);
      return 0;
    }
    if (parsed === "version") {
      stdout(`${NEXTJSHX_VERSION}\n`);
      return 0;
    }
    jsonRequested = parsed.json;
    selectedCommand = parsed.command;
    const base = {
      start: path.resolve(io.cwd ?? process.cwd()),
      ...(parsed.configPath === undefined
        ? {}
        : { configPath: parsed.configPath }),
      ...(runtime === undefined ? {} : { runtime }),
    };
    let result:
      | BuildCommandResult
      | InitCommandResult
      | CleanCommandResult
      | OwnershipTransferCommandResult
      | GenerateCommandResult
      | TypecheckCommandResult
      | RoutesCommandResult
      | BoundariesCommandResult
      | ProfileCommandResult
      | DoctorCommandResult
      | DevCommandResult;
    switch (parsed.command) {
      case "init":
        result = runInitCommand({
          start: base.start,
          typedRoutes: parsed.typedRoutes,
          ...(runtime === undefined ? {} : { runtime }),
        });
        break;
      case "generate":
        result = await runGenerateCommand({
          ...base,
          validate: !parsed.noCheck,
        });
        break;
      case "clean":
        result = await runCleanCommand(base);
        break;
      case "adopt":
      case "release":
      case "repair":
        result = await runOwnershipTransferCommand({
          ...base,
          operation: parsed.command,
          path: requiredTransferPath(parsed.path),
        });
        break;
      case "typecheck":
        result = await runTypecheckCommand(base);
        break;
      case "routes":
        result = await runRoutesCommand({ ...base, check: parsed.check });
        break;
      case "boundaries":
        result = await runBoundariesCommand(base);
        break;
      case "profile":
        result = runProfileCommand({
          ...base,
          operation: requiredProfileOperation(parsed.profileOperation),
        });
        break;
      case "doctor":
        result = await runDoctorCommand(base);
        break;
      case "build":
        result = await runBuildCommand({ ...base, nextArgs: parsed.nextArgs });
        break;
      case "dev":
        result = await devRunner({
          start: base.start,
          ...(parsed.configPath === undefined
            ? {}
            : { configPath: parsed.configPath }),
          nextArgs: parsed.nextArgs,
          ...(runtime === undefined ? {} : { commandRuntime: runtime }),
          emit: (event) => {
            const write = event.channel === "stdout" ? stdout : stderr;
            write(`[${event.source}] ${event.line}\n`);
          },
        });
        return result.exitCode;
    }
    stdout(
      parsed.json
        ? `${JSON.stringify({ ok: true, result: machineResult(result) }, null, 2)}\n`
        : `${
            result.command === "init"
              ? humanInit(result)
              : result.command === "generate"
                ? humanGenerate(result)
                : result.command === "clean"
                  ? humanClean(result)
                  : result.command === "adopt" ||
                      result.command === "release" ||
                      result.command === "repair"
                    ? humanOwnershipTransfer(result)
                    : result.command === "typecheck"
                      ? humanTypecheck(result)
                      : result.command === "routes"
                        ? humanRoutes(result)
                        : result.command === "boundaries"
                          ? humanBoundaries(result)
                          : result.command === "profile"
                            ? humanProfile(result)
                            : result.command === "doctor"
                              ? humanDoctor(result)
                              : result.command === "build"
                                ? humanBuild(result)
                                : ""
          }\n`,
    );
    return (
      (result.command === "doctor" && !result.ok) ||
      (result.command === "profile" &&
        result.operation === "validate" &&
        !result.qualified)
    )
      ? 1
      : 0;
  } catch (error) {
    const diagnostic = commandErrorJson(error);
    const blocked = blockedOutputs(diagnostic, selectedCommand);
    const rendered = jsonRequested
      ? JSON.stringify(
          {
            ok: false,
            error: diagnostic,
            ...(blocked.length === 0 ? {} : { blocked }),
          },
          null,
          2,
        )
      : `${
          blocked.length === 0
            ? ""
            : `blocked (${blocked.length})\n${blocked.map((file) => `  ${file}`).join("\n")}\n`
        }` + humanError(error);
    stderr(`${rendered}\n`);
    return 1;
  }
}

function executableIdentity(value: string): string {
  try {
    return realpathSync(value);
  } catch {
    return path.resolve(value);
  }
}

const invokedPath = process.argv[1];
if (
  invokedPath !== undefined &&
  executableIdentity(invokedPath) ===
    executableIdentity(fileURLToPath(import.meta.url))
) {
  process.exitCode = await runCli(process.argv.slice(2));
}
