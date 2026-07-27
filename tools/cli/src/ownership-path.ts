import path from "node:path";

import { ownershipFailure } from "./ownership-diagnostic.js";

const WINDOWS_DEVICE = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i;
const FORBIDDEN_PORTABLE_CHARACTER = /[\u0000-\u001f<>:"|?*]/;
const TYPESCRIPT_OUTPUT = /\.tsx?$/;
const PACKAGE_MANAGER_LOCKFILE =
  /^(?:package-lock\.json|npm-shrinkwrap\.json|pnpm-lock\.yaml|yarn\.lock|bun\.lockb?)$/;
const NEXT_CONFIG = /^next\.config\.(?:js|mjs|cjs|ts|mts|cts)$/;
const TYPESCRIPT_CONFIG = /^tsconfig(?:\.[^.]+)*\.json$/;
const ENV_FILE = /^\.env(?:\..+)?$/;
const DEPLOYMENT_FILE =
  /^(?:vercel\.json|netlify\.toml|fly\.toml|render\.yaml|amplify\.yml|wrangler\.(?:jsonc?|toml)|docker-compose(?:\.[^.]+)*\.ya?ml|Dockerfile)$/;

function pathFailure(candidate: string, subject: string): never {
  ownershipFailure(
    "NXHX-OWNERSHIP-PATH-0003",
    `${subject} is not a normalized portable project path.`,
    candidate,
    "a slash-separated NFC path with safe relative segments",
    candidate,
    "Use one project-relative TypeScript path with no absolute, dot, parent, " +
      "empty, or platform-specific segments.",
  );
}

export function validatePortableProjectPath(
  candidate: string,
  subject: string,
  requireTypeScriptOutput: boolean,
): string {
  if (
    candidate.length === 0 ||
    candidate.length > 4096 ||
    candidate.normalize("NFC") !== candidate ||
    path.posix.isAbsolute(candidate) ||
    path.win32.isAbsolute(candidate) ||
    candidate.includes("\\") ||
    FORBIDDEN_PORTABLE_CHARACTER.test(candidate)
  ) {
    pathFailure(candidate, subject);
  }
  const segments = candidate.split("/");
  if (
    segments.some(
      (segment) =>
        segment === "" ||
        segment === "." ||
        segment === ".." ||
        segment.endsWith(".") ||
        segment.endsWith(" ") ||
        Buffer.byteLength(segment, "utf8") > 255 ||
        WINDOWS_DEVICE.test(segment),
    )
  ) {
    pathFailure(candidate, subject);
  }
  if (requireTypeScriptOutput && !TYPESCRIPT_OUTPUT.test(candidate)) {
    ownershipFailure(
      "NXHX-OWNERSHIP-TARGET-0013",
      `${subject} must name a TypeScript or TSX output.`,
      candidate,
      "a path ending in .ts or .tsx",
      path.extname(candidate) || "no extension",
      "Render framework adapters as reviewable TypeScript/TSX and keep other assets application-owned.",
    );
  }
  return candidate;
}

export function reservedOutputReason(candidate: string): string | null {
  const segments = candidate.split("/");
  const basename = segments.at(-1) as string;
  if (segments.some((segment) => segment === ".git" || segment === "node_modules")) {
    return "Git metadata and installed dependencies are never generated outputs";
  }
  if ([".nextjshx", ".next", "public"].includes(segments[0] as string)) {
    return "control data, Next build output, and public assets are reserved";
  }
  if (
    basename === "package.json" ||
    basename === "next-env.d.ts" ||
    basename === "nextjshx.config.json" ||
    basename === "pnpm-workspace.yaml" ||
    basename === "lerna.json" ||
    basename === "rush.json" ||
    PACKAGE_MANAGER_LOCKFILE.test(basename) ||
    NEXT_CONFIG.test(basename) ||
    TYPESCRIPT_CONFIG.test(basename) ||
    ENV_FILE.test(basename) ||
    DEPLOYMENT_FILE.test(basename)
  ) {
    return (
      "application, workspace, environment, deployment, or framework " +
      "configuration is never implicitly owned"
    );
  }
  return null;
}

export function validateOutputPath(candidate: string, subject: string): string {
  const validated = validatePortableProjectPath(candidate, subject, false);
  const reserved = reservedOutputReason(validated);
  if (reserved !== null) {
    ownershipFailure(
      "NXHX-OWNERSHIP-RESERVED-0004",
      `${subject} points at a reserved application path.`,
      validated,
      "a non-reserved manifest-owned adapter target",
      reserved,
      "Keep this file application-owned and choose a supported generated adapter target.",
    );
  }
  if (!TYPESCRIPT_OUTPUT.test(validated)) {
    ownershipFailure(
      "NXHX-OWNERSHIP-TARGET-0013",
      `${subject} must name a TypeScript or TSX output.`,
      validated,
      "a path ending in .ts or .tsx",
      path.extname(validated) || "no extension",
      "Render framework adapters as reviewable TypeScript/TSX and keep other assets application-owned.",
    );
  }
  return validated;
}
