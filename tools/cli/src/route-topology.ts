import { cliFailure } from "./cli-diagnostic.js";

export type RouteParameterKind = "single" | "catch-all" | "optional-catch-all";
export type RouteTopology = "canonical" | "parallel-view" | "intercepted-view";

export interface RouteParameterReport {
  readonly name: string;
  readonly kind: RouteParameterKind;
  readonly segmentIndex: number;
}

export interface RouteInterceptionReport {
  readonly marker: "(.)" | "(..)" | "(..)(..)" | "(...)";
  readonly segmentIndex: number;
  readonly interceptingPath: string;
  readonly interceptedPath: string;
}

export interface RouteShape {
  readonly publicPattern: string;
  readonly topology: RouteTopology;
  readonly parallelSlots: readonly string[];
  readonly interception: RouteInterceptionReport | null;
  readonly parameters: readonly RouteParameterReport[];
}

type InterceptionMarker = RouteInterceptionReport["marker"];

interface ParsedRouteSegment {
  readonly source: string;
  readonly publicSource: string;
  readonly filesystemIndex: number;
  readonly parameter: Omit<RouteParameterReport, "segmentIndex"> | null;
}

const INTERCEPTION_MARKERS: readonly InterceptionMarker[] = [
  "(..)(..)",
  "(.)",
  "(..)",
  "(...)",
];

function routeFailure(
  subject: string,
  expected: string,
  actual: string,
  resolution: string,
): never {
  cliFailure(
    "NXHX-CLI-ROUTE-0007",
    "The route report encountered unsupported or ambiguous App Router topology.",
    subject,
    expected,
    actual,
    resolution,
  );
}

function publicPattern(segments: readonly ParsedRouteSegment[]): string {
  return segments.length === 0
    ? "/"
    : `/${segments.map((segment) => segment.publicSource).join("/")}`;
}

function routableSegment(
  source: string,
  filesystemSource: string,
  filesystemIndex: number,
  subject: string,
): ParsedRouteSegment {
  let name: string | null = null;
  let kind: RouteParameterKind | null = null;
  let match = /^\[\[\.\.\.([A-Za-z_][A-Za-z0-9_]*)\]\]$/.exec(source);
  if (match !== null) {
    name = match[1] as string;
    kind = "optional-catch-all";
  } else {
    match = /^\[\.\.\.([A-Za-z_][A-Za-z0-9_]*)\]$/.exec(source);
    if (match !== null) {
      name = match[1] as string;
      kind = "catch-all";
    } else {
      match = /^\[([A-Za-z_][A-Za-z0-9_]*)\]$/.exec(source);
      if (match !== null) {
        name = match[1] as string;
        kind = "single";
      }
    }
  }
  if (name !== null && kind !== null) {
    return Object.freeze({
      source: filesystemSource,
      publicSource: source,
      filesystemIndex,
      parameter: Object.freeze({ name, kind }),
    });
  }
  if (
    source.length === 0 ||
    source.trim() !== source ||
    /[\u0000-\u001f\u007f\[\]()@]/.test(source) ||
    source.startsWith(".") ||
    source.startsWith("_")
  ) {
    routeFailure(
      subject,
      "portable static, [param], [...param], or [[...param]] route segments",
      filesystemSource,
      "Correct the filesystem topology before claiming a typed public URL.",
    );
  }
  return Object.freeze({
    source: filesystemSource,
    publicSource: source,
    filesystemIndex,
    parameter: null,
  });
}

/**
 * Resolves an App Router filesystem path to its canonical request pattern.
 *
 * This mirrors Next's URL-elision and interception rules without claiming to
 * replace its router. The returned topology role lets callers distinguish
 * canonical owners from parallel and soft-navigation-only views.
 */
export function routeShape(segmentPath: string, subject: string): RouteShape {
  if (segmentPath === "") {
    return Object.freeze({
      publicPattern: "/",
      topology: "canonical",
      parallelSlots: Object.freeze([]),
      interception: null,
      parameters: Object.freeze([]),
    });
  }
  const routable: ParsedRouteSegment[] = [];
  const parallelSlots: string[] = [];
  const slotNames = new Set<string>();
  const names = new Set<string>();
  const segments = segmentPath.split("/");
  let marker: InterceptionMarker | null = null;
  let markerIndex = -1;
  let markerFilesystemIndex = -1;
  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index] as string;
    const filesystemIndex = index + 1;
    const foundMarker = INTERCEPTION_MARKERS.find((candidate) =>
      segment.startsWith(candidate)
    );
    if (foundMarker !== undefined) {
      if (marker !== null) {
        routeFailure(
          subject,
          "at most one intercepting segment",
          segmentPath,
          "Keep one explicit interception target per App Router declaration.",
        );
      }
      const target = segment.slice(foundMarker.length);
      if (target.length === 0) {
        routeFailure(
          subject,
          "an interception marker attached directly to a target segment",
          segment,
          "Use a shape such as (.)photo or (..)[id].",
        );
      }
      marker = foundMarker;
      markerIndex = routable.length;
      markerFilesystemIndex = filesystemIndex;
      const parsed = routableSegment(target, segment, filesystemIndex, subject);
      if (parsed.parameter !== null) {
        if (names.has(parsed.parameter.name)) {
          routeFailure(
            subject,
            "unique dynamic parameter names",
            parsed.parameter.name,
            "Fix the route declaration and regenerate its typed companions.",
          );
        }
        names.add(parsed.parameter.name);
      }
      routable.push(parsed);
      continue;
    }
    if (segment.startsWith("@")) {
      const slot = segment.slice(1);
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(slot) || slot === "children") {
        routeFailure(
          subject,
          "a named parallel slot such as @modal; @children is reserved",
          segment,
          "Rename the slot to a closed layout-property identifier.",
        );
      }
      if (slotNames.has(slot)) {
        routeFailure(
          subject,
          "unique parallel-slot ancestry",
          segment,
          "Remove the repeated slot segment before generating adapters.",
        );
      }
      slotNames.add(slot);
      parallelSlots.push(slot);
      continue;
    }
    const routeGroup = /^\(([^()[\]@]+)\)$/.exec(segment);
    if (routeGroup !== null) {
      const groupName = routeGroup[1] as string;
      if (
        /^\.+$/.test(groupName) ||
        groupName.startsWith("_") ||
        groupName.trim() !== groupName ||
        /[\u0000-\u001f\u007f<>:"|?*#%]/.test(groupName)
      ) {
        routeFailure(
          subject,
          "a named portable App Router group such as (marketing)",
          segment,
          "Rename the group before generating or inventorying the route.",
        );
      }
      continue;
    }
    const parsed = routableSegment(segment, segment, filesystemIndex, subject);
    if (parsed.parameter !== null) {
      if (names.has(parsed.parameter.name)) {
        routeFailure(
          subject,
          "unique dynamic parameter names",
          parsed.parameter.name,
          "Fix the route declaration and regenerate its typed companions.",
        );
      }
      names.add(parsed.parameter.name);
    }
    routable.push(parsed);
  }
  for (let index = 0; index < routable.length; index += 1) {
    const parameter = routable[index]?.parameter;
    if (
      parameter !== null &&
      parameter !== undefined &&
      parameter.kind !== "single" &&
      index !== routable.length - 1
    ) {
      routeFailure(
        subject,
        "[...param] or [[...param]] as the final public URL segment",
        `${parameter.name} at filesystem segment ${routable[index]?.filesystemIndex}`,
        "Move the catch-all to the end or keep the unsupported route outside typed route generation.",
      );
    }
  }

  let resolved = [...routable];
  let interception: RouteInterceptionReport | null = null;
  if (marker !== null) {
    const before = routable.slice(0, markerIndex);
    const target = routable.slice(markerIndex);
    let keep: number;
    switch (marker) {
      case "(.)":
        keep = before.length;
        break;
      case "(..)":
        if (before.length === 0) {
          routeFailure(
            subject,
            "at least one preceding route segment for (..)",
            segmentPath,
            "Use (.) for a root-level sibling interception.",
          );
        }
        keep = before.length - 1;
        break;
      case "(..)(..)":
        if (before.length < 2) {
          routeFailure(
            subject,
            "at least two preceding route segments for (..)(..)",
            segmentPath,
            "Use (..), (.), or (...) at this route depth.",
          );
        }
        keep = before.length - 2;
        break;
      case "(...)":
        keep = 0;
        break;
    }
    resolved = [...before.slice(0, keep), ...target];
    interception = Object.freeze({
      marker,
      segmentIndex: markerFilesystemIndex,
      interceptingPath: publicPattern(before),
      interceptedPath: publicPattern(resolved),
    });
  }

  const parameters = resolved.flatMap((segment, index): readonly RouteParameterReport[] =>
    segment.parameter === null
      ? []
      : [Object.freeze({
          ...segment.parameter,
          segmentIndex: index + 1,
        })]
  );
  return Object.freeze({
    publicPattern: publicPattern(resolved),
    topology: interception !== null
      ? "intercepted-view"
      : parallelSlots.length > 0
        ? "parallel-view"
        : "canonical",
    parallelSlots: Object.freeze(parallelSlots),
    interception,
    parameters: Object.freeze(parameters),
  });
}
