import {
  existsSync,
  lstatSync,
  readFileSync,
  readdirSync,
  statSync,
} from "node:fs";
import path from "node:path";

export interface NextClientArtifact {
  readonly chunks: readonly string[];
  readonly bytes: number;
  readonly manifests: readonly string[];
}

export interface NextClientArtifactEvidence {
  readonly status: "available" | "unavailable";
  readonly reason: string;
  readonly artifacts: ReadonlyMap<string, NextClientArtifact>;
}

export interface NextClientArtifactInspection {
  readonly freshnessInputs?: readonly string[];
}

type JsonObject = Record<string, unknown>;

const MANIFEST_SUFFIX = "_client-reference-manifest.js";
const STATIC_CHUNK_PREFIX = "/_next/static/";
const MODULE_EVALUATION_SUFFIX = " <module evaluation>";

function objectValue(value: unknown): JsonObject | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as JsonObject
    : null;
}

function containedRegularFile(root: string, relative: string): string | null {
  const segments = relative.split("/");
  if (
    segments.length === 0 ||
    segments.some((segment) => segment === "" || segment === "." || segment === "..")
  ) {
    return null;
  }
  let current = root;
  for (let index = 0; index < segments.length; index += 1) {
    current = path.join(current, segments[index] as string);
    if (!existsSync(current)) {
      return null;
    }
    const status = lstatSync(current);
    if (
      status.isSymbolicLink() ||
      (index === segments.length - 1 ? !status.isFile() : !status.isDirectory())
    ) {
      return null;
    }
  }
  return current;
}

function walkManifestFiles(root: string): readonly string[] {
  if (!existsSync(root) || !lstatSync(root).isDirectory()) {
    return Object.freeze([]);
  }
  const files: string[] = [];
  const visit = (directory: string): void => {
    const entries = readdirSync(directory, { withFileTypes: true })
      .sort((left, right) => Buffer.from(left.name).compare(Buffer.from(right.name)));
    for (const entry of entries) {
      const candidate = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) {
        continue;
      }
      if (entry.isDirectory()) {
        visit(candidate);
      } else if (entry.isFile() && entry.name.endsWith(MANIFEST_SUFFIX)) {
        files.push(candidate);
      }
    }
  };
  visit(root);
  return Object.freeze(files);
}

function parseManifestClientModules(file: string): JsonObject | null {
  const source = readFileSync(file, "utf8");
  const assignment = source
    .split(/\r?\n/u)
    .find((line) => line.startsWith("globalThis.__RSC_MANIFEST[") && line.includes(" = "));
  if (assignment === undefined || !assignment.endsWith(";")) {
    return null;
  }
  const separator = assignment.indexOf(" = ");
  try {
    // This is a deliberately broad upstream JSON boundary. The parsed value is
    // immediately narrowed to the clientModules/chunks subset below.
    const decoded: unknown = JSON.parse(assignment.slice(separator + 3, -1));
    const root = objectValue(decoded);
    return root === null ? null : objectValue(root.clientModules);
  } catch {
    return null;
  }
}

function chunkValues(value: unknown): readonly string[] | null {
  const module = objectValue(value);
  if (module === null || !Array.isArray(module.chunks)) {
    return null;
  }
  const chunks: string[] = [];
  for (const chunk of module.chunks) {
    if (
      typeof chunk !== "string" ||
      !chunk.startsWith(STATIC_CHUNK_PREFIX) ||
      !chunk.endsWith(".js") ||
      chunk.includes("\\") ||
      chunk.includes("\0") ||
      chunk.split("/").some((segment) => segment === "..")
    ) {
      return null;
    }
    chunks.push(chunk.slice("/_next/".length));
  }
  return Object.freeze(chunks);
}

function moduleTarget(moduleKey: string, projectRoot: string): string | null {
  const canonical = moduleKey.endsWith(MODULE_EVALUATION_SUFFIX)
    ? moduleKey.slice(0, -MODULE_EVALUATION_SUFFIX.length)
    : moduleKey;
  const marker = "/[project]/";
  const normalizedRoot = projectRoot.split(path.sep).join("/");
  const rootName = path.posix.basename(normalizedRoot);
  const candidates = [
    `${marker}${rootName}/`,
    `${marker}${normalizedRoot}/`,
  ];
  for (const prefix of candidates) {
    const index = canonical.lastIndexOf(prefix);
    if (index >= 0) {
      return canonical.slice(index + prefix.length);
    }
  }
  const projectPrefix = "[project]/";
  if (canonical.startsWith(projectPrefix)) {
    const relative = canonical.slice(projectPrefix.length);
    const rootIndex = relative.lastIndexOf(`/${rootName}/`);
    return rootIndex >= 0
      ? relative.slice(rootIndex + rootName.length + 2)
      : relative;
  }
  return null;
}

function freshnessReason(buildId: string, inputs: readonly string[]): string | null {
  const builtAt = lstatSync(buildId).mtimeMs;
  let visited = 0;
  const visit = (candidate: string): boolean => {
    if (!existsSync(candidate)) {
      return false;
    }
    const status = lstatSync(candidate);
    if (status.isSymbolicLink()) {
      return true;
    }
    visited += 1;
    if (visited > 50_000 || status.mtimeMs > builtAt) {
      return true;
    }
    if (!status.isDirectory()) {
      return false;
    }
    for (const entry of readdirSync(candidate, { withFileTypes: true })) {
      if (
        entry.name === ".git" ||
        entry.name === ".next" ||
        entry.name === ".nextjshx" ||
        entry.name === "node_modules"
      ) {
        continue;
      }
      if (visit(path.join(candidate, entry.name))) {
        return true;
      }
    }
    return false;
  };
  for (const input of [...new Set(inputs)].sort()) {
    if (visit(input)) {
      return "Project inputs changed after the completed Next build; run nextjshx build before using byte evidence.";
    }
  }
  return null;
}

function completedBuildReason(
  projectRoot: string,
  nextVersion: string,
  freshnessInputs: readonly string[],
): string | null {
  const nextRoot = path.join(projectRoot, ".next");
  if (
    !existsSync(nextRoot) ||
    lstatSync(nextRoot).isSymbolicLink() ||
    !lstatSync(nextRoot).isDirectory()
  ) {
    return "No contained Next production build directory was found.";
  }
  const buildId = containedRegularFile(nextRoot, "BUILD_ID");
  const framework = containedRegularFile(nextRoot, "diagnostics/framework.json");
  if (buildId === null || readFileSync(buildId, "utf8").trim().length === 0) {
    return "No completed Next production build was found (.next/BUILD_ID is absent).";
  }
  if (framework === null) {
    return "The completed build has no inspectable Next framework identity.";
  }
  try {
    // This is an external Next build artifact and is immediately narrowed.
    const decoded: unknown = JSON.parse(readFileSync(framework, "utf8"));
    const identity = objectValue(decoded);
    if (identity?.name !== "Next.js" || identity.version !== nextVersion) {
      return `The completed build was not produced by the configured Next ${nextVersion}.`;
    }
  } catch {
    return "The completed build has a malformed Next framework identity.";
  }
  return freshnessReason(buildId, freshnessInputs);
}

export function inspectNextClientArtifacts(
  projectRoot: string,
  nextVersion: string,
  options: NextClientArtifactInspection = {},
): NextClientArtifactEvidence {
  const unavailable = completedBuildReason(
    projectRoot,
    nextVersion,
    options.freshnessInputs ?? [],
  );
  if (unavailable !== null) {
    return Object.freeze({
      status: "unavailable" as const,
      reason: unavailable,
      artifacts: new Map<string, NextClientArtifact>(),
    });
  }
  const nextRoot = path.join(projectRoot, ".next");
  const manifests = walkManifestFiles(path.join(nextRoot, "server/app"));
  if (manifests.length === 0) {
    return Object.freeze({
      status: "unavailable" as const,
      reason: "The completed build exposes no App Router client-reference manifests.",
      artifacts: new Map<string, NextClientArtifact>(),
    });
  }
  const observations = new Map<string, { chunks: Set<string>; manifests: Set<string> }>();
  for (const manifest of manifests) {
    const modules = parseManifestClientModules(manifest);
    if (modules === null) {
      continue;
    }
    const relativeManifest = path.relative(projectRoot, manifest).split(path.sep).join("/");
    for (const [moduleKey, value] of Object.entries(modules)) {
      const target = moduleTarget(moduleKey, projectRoot);
      const chunks = chunkValues(value);
      if (target === null || chunks === null) {
        continue;
      }
      const observation = observations.get(target) ?? {
        chunks: new Set<string>(),
        manifests: new Set<string>(),
      };
      for (const chunk of chunks) {
        observation.chunks.add(chunk);
      }
      observation.manifests.add(relativeManifest);
      observations.set(target, observation);
    }
  }
  const artifacts = new Map<string, NextClientArtifact>();
  for (const [target, observation] of [...observations].sort(([left], [right]) =>
    Buffer.from(left).compare(Buffer.from(right))
  )) {
    const chunks = [...observation.chunks].sort((left, right) =>
      Buffer.from(left).compare(Buffer.from(right))
    );
    let bytes = 0;
    let valid = true;
    for (const chunk of chunks) {
      const file = containedRegularFile(nextRoot, chunk);
      if (file === null) {
        valid = false;
        break;
      }
      bytes += statSync(file).size;
    }
    if (valid) {
      artifacts.set(target, Object.freeze({
        chunks: Object.freeze(chunks.map((chunk) => `.next/${chunk}`)),
        bytes,
        manifests: Object.freeze([...observation.manifests].sort()),
      }));
    }
  }
  return Object.freeze({
    status: "available" as const,
    reason:
      "Observed from a compatible completed Next production build; native and third-party transitive graph completeness remains Next-owned.",
    artifacts,
  });
}
