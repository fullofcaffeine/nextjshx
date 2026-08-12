import type { CompilerDataFile } from "@genes-ts/tooling/session";

import {
  parseAdapterPlan,
  type AdapterPlan,
} from "./adapter-plan.js";
import {
  parseBoundaryPlan,
  type BoundaryPlan,
} from "./boundary-plan.js";
import { cliFailure } from "./cli-diagnostic.js";

export const ADAPTER_PLAN_COMPILER_DATA_ID = "nextjshx.adapter-plan";
export const BOUNDARY_PLAN_COMPILER_DATA_ID = "nextjshx.boundary-plan";

export interface CompilerDataPlans {
  readonly adapter: AdapterPlan;
  readonly boundary: BoundaryPlan;
}

function requiredValue(
  files: readonly CompilerDataFile[],
  id: string,
  code: "NXHX-CLI-PLAN-0004" | "NXHX-CLI-BOUNDARY-0013",
  label: string,
): CompilerDataFile {
  const matches = files.filter((file) => file.id === id);
  const match = matches[0];
  if (matches.length !== 1 || match === undefined) {
    cliFailure(
      code,
      `Haxe did not return exactly one ${label}.`,
      id,
      `one private compiler value named ${id}`,
      matches.length === 0 ? "missing" : `${matches.length} values`,
      "Use the compiler-owned NextJsHx macro plan with the released Genes development session.",
    );
  }
  return match;
}

function jsonValue(
  file: CompilerDataFile,
  code: "NXHX-CLI-PLAN-0004" | "NXHX-CLI-BOUNDARY-0013",
  label: string,
): unknown {
  try {
    const source = new TextDecoder("utf-8", { fatal: true }).decode(
      file.readBytes(),
    );
    const parsed: unknown = JSON.parse(source);
    return parsed;
  } catch (error) {
    cliFailure(
      code,
      `Haxe returned an unreadable ${label}.`,
      file.id,
      "canonical UTF-8 JSON",
      error instanceof Error ? error.message : "invalid bytes",
      "Fix the Haxe diagnostic or regenerate with the matching NextJsHx and Genes versions.",
    );
  }
}

/**
 * Reads the private plan values returned by the NextJsHx Haxe macros.
 *
 * The shared Genes session keeps these values away from the public generated
 * files. This function requires one value for each plan and then applies the
 * same strict checks used for file-based plans.
 */
export function parseCompilerDataPlans(
  files: readonly CompilerDataFile[],
): CompilerDataPlans {
  const adapter = requiredValue(
    files,
    ADAPTER_PLAN_COMPILER_DATA_ID,
    "NXHX-CLI-PLAN-0004",
    "adapter plan",
  );
  const boundary = requiredValue(
    files,
    BOUNDARY_PLAN_COMPILER_DATA_ID,
    "NXHX-CLI-BOUNDARY-0013",
    "boundary plan",
  );
  return Object.freeze({
    adapter: parseAdapterPlan(
      jsonValue(adapter, "NXHX-CLI-PLAN-0004", "adapter plan"),
    ),
    boundary: parseBoundaryPlan(
      jsonValue(boundary, "NXHX-CLI-BOUNDARY-0013", "boundary plan"),
    ),
  });
}
