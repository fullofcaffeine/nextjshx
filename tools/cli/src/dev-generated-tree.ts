import { createHash } from "node:crypto";
import {
  existsSync,
  lstatSync,
  readdirSync,
  readFileSync,
} from "node:fs";
import path from "node:path";
import ts from "typescript";

import type { AdapterPlan } from "./adapter-plan.js";
import {
  mdxComponentsOutputPathForAppRoot,
  proxyOutputPathForAppRoot,
} from "./adapter-renderer.js";

const MAX_GENERATED_FILES = 10_000;
const MAX_GENERATED_BYTES = 128 * 1024 * 1024;

interface GeneratedFileState {
  readonly sha256: string;
  readonly content: Buffer;
}

export interface GeneratedTreeSnapshot {
  readonly root: string;
  readonly files: ReadonlyMap<string, GeneratedFileState>;
}

function digest(content: Buffer): string {
  return createHash("sha256").update(content).digest("hex");
}

function safeGeneratedRoot(root: string): string {
  const absolute = path.resolve(root);
  if (!existsSync(absolute)) {
    return absolute;
  }
  const stats = lstatSync(absolute);
  if (stats.isSymbolicLink() || !stats.isDirectory()) {
    throw new Error(`development generated root is ${stats.isSymbolicLink() ? "a symbolic link" : "not a directory"}: ${absolute}`);
  }
  return absolute;
}

/**
 * Capture the exact generated implementation tree after Haxe succeeds. The
 * bounds prevent a misconfigured output root from turning adapter rendering
 * into an unbounded filesystem read.
 */
export function snapshotGeneratedTree(root: string): GeneratedTreeSnapshot {
  const absoluteRoot = safeGeneratedRoot(root);
  const files = new Map<string, GeneratedFileState>();
  if (!existsSync(absoluteRoot)) {
    return Object.freeze({ root: absoluteRoot, files });
  }
  let bytes = 0;
  const visit = (directory: string): void => {
    for (const child of readdirSync(directory, { withFileTypes: true }).sort((left, right) =>
      Buffer.from(left.name).compare(Buffer.from(right.name)),
    )) {
      const absolute = path.join(directory, child.name);
      const stats = lstatSync(absolute);
      if (stats.isSymbolicLink()) {
        throw new Error(`development generated tree contains a symbolic link: ${absolute}`);
      }
      if (stats.isDirectory()) {
        visit(absolute);
        continue;
      }
      if (!stats.isFile()) {
        throw new Error(`development generated tree contains a special filesystem entry: ${absolute}`);
      }
      const content = readFileSync(absolute);
      bytes += content.byteLength;
      if (files.size + 1 > MAX_GENERATED_FILES || bytes > MAX_GENERATED_BYTES) {
        throw new Error("development generated tree exceeds the 10,000-file or 128 MiB safety bound");
      }
      files.set(path.relative(absoluteRoot, absolute), Object.freeze({
        sha256: digest(content),
        content,
      }));
    }
  };
  visit(absoluteRoot);
  return Object.freeze({ root: absoluteRoot, files });
}

const MODULE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx"] as const;

function moduleIdentity(candidate: string): string {
  const extension = MODULE_EXTENSIONS.find((suffix) => candidate.endsWith(suffix));
  return extension === undefined ? candidate : candidate.slice(0, -extension.length);
}

function resolveModule(
  modules: ReadonlyMap<string, string>,
  identity: string,
): string | undefined {
  return modules.get(identity) ?? modules.get(path.join(identity, "index"));
}

function adapterOutputPath(appRootRelative: string, kind: string, targetPath: string): string {
  if (kind === "proxy") {
    const output = proxyOutputPathForAppRoot(appRootRelative);
    if (output === null) {
      throw new Error(`unsupported App Router root for proxy.ts: ${appRootRelative}`);
    }
    return output;
  }
  if (kind === "mdx-components") {
    const output = mdxComponentsOutputPathForAppRoot(appRootRelative);
    if (output === null) {
      throw new Error(`unsupported App Router root for mdx-components.tsx: ${appRootRelative}`);
    }
    return output;
  }
  return path.posix.join(appRootRelative, targetPath);
}

/**
 * Compute one exact digest per adapter over the generated implementation module
 * and every generated relative import reachable from it. A body or shared
 * dependency change therefore updates only adapters whose Haxe module graph
 * changed, giving Next a canonical content invalidation at its convention file.
 */
export function adapterImplementationDigests(
  projectRoot: string,
  generatedRoot: string,
  appRootRelative: string,
  plan: AdapterPlan,
): ReadonlyMap<string, string> {
  const root = path.resolve(projectRoot);
  const snapshot = snapshotGeneratedTree(generatedRoot);
  const modules = new Map<string, string>();
  for (const relative of snapshot.files.keys()) {
    if (!MODULE_EXTENSIONS.some((extension) => relative.endsWith(extension))) {
      continue;
    }
    const identity = moduleIdentity(path.resolve(snapshot.root, relative));
    if (modules.has(identity)) {
      throw new Error(`generated module identity is ambiguous: ${identity}`);
    }
    modules.set(identity, relative);
  }

  const dependencies = new Map<string, readonly string[]>();
  const directDependencies = (relative: string): readonly string[] => {
    const cached = dependencies.get(relative);
    if (cached !== undefined) {
      return cached;
    }
    const state = snapshot.files.get(relative);
    if (state === undefined) {
      throw new Error(`generated dependency disappeared from its snapshot: ${relative}`);
    }
    const absolute = path.resolve(snapshot.root, relative);
    const imported = ts.preProcessFile(state.content.toString("utf8"), true, true)
      .importedFiles
      .map((entry) => entry.fileName)
      .filter((specifier) => specifier.startsWith("."))
      .flatMap((specifier) => {
        const identity = moduleIdentity(path.resolve(path.dirname(absolute), specifier));
        const dependency = resolveModule(modules, identity);
        return dependency === undefined ? [] : [dependency];
      });
    const result = Object.freeze([...new Set(imported)].sort((left, right) =>
      Buffer.from(left).compare(Buffer.from(right)),
    ));
    dependencies.set(relative, result);
    return result;
  };

  const result = new Map<string, string>();
  for (const intent of plan.intents) {
    const output = adapterOutputPath(
      appRootRelative,
      intent.kind,
      intent.targetPath,
    );
    const implementation = moduleIdentity(path.resolve(
      root,
      path.dirname(output.split("/").join(path.sep)),
      intent.implementation.modulePath,
    ));
    const entry = resolveModule(modules, implementation);
    if (entry === undefined) {
      throw new Error(
        `adapter implementation module is absent from generated output: ${intent.implementation.modulePath}`,
      );
    }
    const reachable = new Set<string>();
    const visit = (relative: string): void => {
      if (reachable.has(relative)) {
        return;
      }
      reachable.add(relative);
      for (const dependency of directDependencies(relative)) {
        visit(dependency);
      }
    };
    visit(entry);
    const hash = createHash("sha256");
    for (const relative of [...reachable].sort((left, right) =>
      Buffer.from(left).compare(Buffer.from(right)),
    )) {
      const state = snapshot.files.get(relative);
      if (state === undefined) {
        throw new Error(`reachable generated module disappeared: ${relative}`);
      }
      hash.update(relative.split(path.sep).join("/"));
      hash.update("\0");
      hash.update(state.sha256);
      hash.update("\n");
    }
    result.set(output, hash.digest("hex"));
  }
  return result;
}
