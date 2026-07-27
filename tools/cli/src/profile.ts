import path from "node:path";

import {
  type ConfigMigrationReport,
  type NextJsHxConfig,
  type OutputIntent,
  type OutputLanguage,
  type OutputProfile,
  effectiveOutputProfile,
  effectiveOutputProfileFingerprint,
} from "./config.js";
import { cliFailure } from "./cli-diagnostic.js";
import { type NextProjectDiscovery, discoverNextProject } from "./discovery.js";

export type ProfileCommandOperation = "show" | "list" | "validate";
export type ProfileMaturity = "preview" | "experimental" | "planned";

export interface ProfileCell {
  readonly language: OutputLanguage;
  readonly intent: OutputIntent;
  readonly maturity: ProfileMaturity;
  readonly unsupportedCapabilities: readonly string[];
}

export interface ProfileCommandOptions {
  readonly start: string;
  readonly configPath?: string;
  readonly operation: ProfileCommandOperation;
}

export interface ProfileCommandResult {
  readonly command: "profile";
  readonly operation: ProfileCommandOperation;
  readonly projectRoot: string;
  readonly profile: OutputProfile;
  readonly fingerprint: string;
  readonly maturity: ProfileMaturity;
  readonly qualified: boolean;
  readonly unsupportedCapabilities: readonly string[];
  readonly migration: ConfigMigrationReport | null;
  readonly cells: readonly ProfileCell[];
}

const PROFILE_CELLS: readonly ProfileCell[] = Object.freeze([
  Object.freeze({
    language: "typescript",
    intent: "reviewable",
    maturity: "preview",
    unsupportedCapabilities: Object.freeze([
      "reviewable-implementation-output",
      "end-to-end-source-map-debugging",
    ]),
  }),
  Object.freeze({
    language: "typescript",
    intent: "optimized",
    maturity: "experimental",
    unsupportedCapabilities: Object.freeze([
      "optimization-decision-registry",
      "representative-final-pipeline-benchmarks",
      "end-to-end-source-map-debugging",
    ]),
  }),
  Object.freeze({
    language: "javascript",
    intent: "reviewable",
    maturity: "planned",
    unsupportedCapabilities: Object.freeze([
      "javascript-output-release-matrix",
      "reviewable-implementation-output",
      "end-to-end-source-map-debugging",
    ]),
  }),
  Object.freeze({
    language: "javascript",
    intent: "optimized",
    maturity: "planned",
    unsupportedCapabilities: Object.freeze([
      "javascript-output-release-matrix",
      "optimization-decision-registry",
      "representative-final-pipeline-benchmarks",
      "end-to-end-source-map-debugging",
    ]),
  }),
]);

function configuredProject(options: ProfileCommandOptions): {
  readonly discovery: NextProjectDiscovery;
  readonly config: NextJsHxConfig;
  readonly profile: OutputProfile;
} {
  const discovery = discoverNextProject(path.resolve(options.start), {
    requireConfig: true,
    ...(options.configPath === undefined
      ? {}
      : { configPath: options.configPath }),
  });
  if (discovery.config === null) {
    cliFailure(
      "NXHX-CLI-USAGE-0001",
      "Profile inspection requires nextjshx.config.json.",
      discovery.packageRoot,
      "a discovered schema-v2 config or supported schema-v1 migration input",
      "configuration missing after required discovery",
      "Run nextjshx init or add the documented declarative config.",
    );
  }
  return Object.freeze({
    discovery,
    config: discovery.config,
    profile: effectiveOutputProfile(discovery.config),
  });
}

function cellFor(profile: OutputProfile): ProfileCell {
  const cell = PROFILE_CELLS.find(
    (candidate) =>
      candidate.language === profile.language &&
      candidate.intent === profile.intent,
  );
  if (cell === undefined) {
    cliFailure(
      "NXHX-CLI-USAGE-0001",
      "The configured output profile has no maturity registry entry.",
      `${profile.language}/${profile.intent}`,
      "one closed language/intent cell",
      "registry entry missing",
      "Use a CLI release whose profile registry matches the config schema.",
    );
  }
  return cell;
}

export function runProfileCommand(
  options: ProfileCommandOptions,
): ProfileCommandResult {
  const project = configuredProject(options);
  const selected = cellFor(project.profile);
  return Object.freeze({
    command: "profile",
    operation: options.operation,
    projectRoot: project.discovery.packageRoot,
    profile: project.profile,
    fingerprint: effectiveOutputProfileFingerprint(project.config),
    maturity: selected.maturity,
    qualified: selected.unsupportedCapabilities.length === 0,
    unsupportedCapabilities: selected.unsupportedCapabilities,
    migration: project.config.migration ?? null,
    cells: options.operation === "list" ? PROFILE_CELLS : Object.freeze([]),
  });
}
