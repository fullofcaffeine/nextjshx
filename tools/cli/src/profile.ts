import path from "node:path";

import {
  type ConfigMigrationReport,
  type NextJsHxConfig,
  type OutputIntent,
  type OutputLanguage,
  type OutputProfile,
  effectiveHaxeDefines,
  effectiveOutputProfile,
  effectiveOutputProfileFingerprint,
  outputProfileFingerprint,
} from "./config.js";
import { cliFailure } from "./cli-diagnostic.js";
import { type NextProjectDiscovery, discoverNextProject } from "./discovery.js";

export type ProfileCommandOperation = "show" | "list" | "validate" | "diff";
export type ProfileMaturity = "preview" | "experimental" | "planned";

export interface ProfileSelection {
  readonly language: OutputLanguage;
  readonly intent: OutputIntent;
}

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
  readonly target?: ProfileSelection;
}

export interface ProfilePolicyChange {
  readonly field: keyof OutputProfile;
  readonly from: string;
  readonly to: string;
}

export interface ProfileComparison {
  readonly profile: OutputProfile;
  readonly fingerprint: string;
  readonly maturity: ProfileMaturity;
  readonly qualified: boolean;
  readonly unsupportedCapabilities: readonly string[];
  readonly changes: readonly ProfilePolicyChange[];
  readonly compilerDefinesAdded: readonly string[];
  readonly compilerDefinesRemoved: readonly string[];
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
  readonly comparison: ProfileComparison | null;
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

export function parseProfileSelection(value: string): ProfileSelection {
  const [language, intent, extra] = value.split("/");
  if (
    extra !== undefined ||
    (language !== "typescript" && language !== "javascript") ||
    (intent !== "reviewable" && intent !== "optimized")
  ) {
    cliFailure(
      "NXHX-CLI-USAGE-0001",
      "The profile target must identify one closed language/intent cell.",
      value,
      "typescript/reviewable, typescript/optimized, javascript/reviewable, or javascript/optimized",
      "invalid profile target",
      "Pass the target through --to without whitespace or additional segments.",
    );
  }
  return Object.freeze({ language, intent });
}

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

function comparedProfile(
  current: OutputProfile,
  selection: ProfileSelection,
): OutputProfile {
  return Object.freeze({
    ...current,
    language: selection.language,
    intent: selection.intent,
  });
}

function configWithProfile(
  config: NextJsHxConfig,
  profile: OutputProfile,
): NextJsHxConfig {
  return Object.freeze({
    ...config,
    output: Object.freeze({
      ...config.output,
      profile,
    }),
  });
}

function policyChanges(
  current: OutputProfile,
  target: OutputProfile,
): readonly ProfilePolicyChange[] {
  const fields = [
    "language",
    "intent",
    "profileVersion",
    "sourceMaps",
    "sourcesContent",
    "declarations",
    "jsxRuntime",
  ] as const;
  return Object.freeze(
    fields.flatMap((field) =>
      current[field] === target[field]
        ? []
        : [
            Object.freeze({
              field,
              from: String(current[field]),
              to: String(target[field]),
            }),
          ],
    ),
  );
}

function profileComparison(
  config: NextJsHxConfig,
  current: OutputProfile,
  selection: ProfileSelection,
): ProfileComparison {
  const target = comparedProfile(current, selection);
  const targetCell = cellFor(target);
  const currentDefines = new Set(effectiveHaxeDefines(config));
  const targetDefines = new Set(
    effectiveHaxeDefines(configWithProfile(config, target)),
  );
  return Object.freeze({
    profile: target,
    fingerprint: outputProfileFingerprint(target),
    maturity: targetCell.maturity,
    qualified: targetCell.unsupportedCapabilities.length === 0,
    unsupportedCapabilities: targetCell.unsupportedCapabilities,
    changes: policyChanges(current, target),
    compilerDefinesAdded: Object.freeze(
      [...targetDefines].filter((define) => !currentDefines.has(define)).sort(),
    ),
    compilerDefinesRemoved: Object.freeze(
      [...currentDefines].filter((define) => !targetDefines.has(define)).sort(),
    ),
  });
}

export function runProfileCommand(
  options: ProfileCommandOptions,
): ProfileCommandResult {
  const project = configuredProject(options);
  const selected = cellFor(project.profile);
  if (options.operation === "diff" && options.target === undefined) {
    cliFailure(
      "NXHX-CLI-USAGE-0001",
      "Profile diff requires an explicit target cell.",
      "profile diff",
      "--to <typescript|javascript>/<reviewable|optimized>",
      "target missing",
      "Select one closed language/intent cell.",
    );
  }
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
    comparison:
      options.operation === "diff" && options.target !== undefined
        ? profileComparison(project.config, project.profile, options.target)
        : null,
  });
}
