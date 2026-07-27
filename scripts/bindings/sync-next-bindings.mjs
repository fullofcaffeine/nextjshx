#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

import Ajv2020 from "ajv/dist/2020.js";
import ts from "typescript";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(SCRIPT_PATH), "../..");
const DEFAULT_SURFACE = path.join(ROOT, "surface/next-public-surface.json");
const DEFAULT_OVERRIDES = path.join(ROOT, "config/next-binding-overrides.json");
const DEFAULT_IMPLEMENTATIONS = path.join(
  ROOT,
  "config/next-binding-implementations.json",
);
const DEFAULT_IR = path.join(ROOT, "surface/next-binding-ir.json");
const DEFAULT_DRIFT_JSON = path.join(ROOT, "surface/next-surface-drift.json");
const DEFAULT_DRIFT_MARKDOWN = path.join(ROOT, "surface/next-surface-drift.md");
const SURFACE_SCHEMA = path.join(ROOT, "schemas/next-public-surface.schema.json");
const OVERRIDES_SCHEMA = path.join(ROOT, "schemas/next-binding-overrides.schema.json");
const IMPLEMENTATIONS_SCHEMA = path.join(
  ROOT,
  "schemas/next-binding-implementations.schema.json",
);
const IR_SCHEMA = path.join(ROOT, "schemas/next-binding-ir.schema.json");
const DRIFT_SCHEMA = path.join(ROOT, "schemas/next-surface-drift.schema.json");
const REQUIRE = createRequire(import.meta.url);
const PRIORITY_RANK = new Map([
  ["P0", 0],
  ["P1", 1],
  ["P2", 2],
]);
const CLASSIFICATION_RANK = new Map([
  ["breaking", 0],
  ["unsupported-construct", 1],
  ["behavioral-review-required", 2],
  ["additive", 3],
  ["compatible", 4],
]);
const ALLOWED_TYPE_CONSTRUCTS = new Set([
  "AnyKeyword",
  "ArrayType",
  "BooleanKeyword",
  "ConditionalType",
  "ExpressionWithTypeArguments",
  "FunctionType",
  "ImportType",
  "IndexedAccessType",
  "IntersectionType",
  "LiteralType",
  "NeverKeyword",
  "NumberKeyword",
  "ParenthesizedType",
  "StringKeyword",
  "TemplateLiteralType",
  "TemplateLiteralTypeSpan",
  "TypeLiteral",
  "TypeOperator",
  "TypeQuery",
  "TypeReference",
  "UndefinedKeyword",
  "UnionType",
  "UnknownKeyword",
  "VoidKeyword",
]);
const OWNER_BY_MODULE = new Map([
  ["globalThis", "nxhx-f34.3.5"],
  ["next", "nxhx-f34.3.3"],
  ["next/compat/router", "nxhx-f34.3.3"],
  ["next/navigation", "nxhx-f34.3.3"],
  ["next/types", "nxhx-f34.3.3"],
  ["next/dynamic", "nxhx-f34.3.4"],
  ["next/font/google", "nxhx-f34.3.4"],
  ["next/font/local", "nxhx-f34.3.4"],
  ["next/form", "nxhx-f34.3.4"],
  ["next/image", "nxhx-f34.3.4"],
  ["next/link", "nxhx-f34.3.4"],
  ["next/script", "nxhx-f34.3.4"],
  ["next/cache", "nxhx-f34.3.5"],
  ["next/headers", "nxhx-f34.3.5"],
  ["next/og", "nxhx-f34.3.5"],
  ["next/server", "nxhx-f34.3.5"],
  ["next/web-vitals", "nxhx-f34.3.5"],
]);

class BindingFailure extends Error {}

class UnsupportedConstructFailure extends BindingFailure {
  constructor(label, construct, declarationPath) {
    super(
      `${label} uses unsupported TypeScript construct ${construct} in ${declarationPath}; ` +
        "generation stopped before emitting Haxe. Add a general parser rule and regression fixture, then review the resulting IR drift.",
    );
    this.label = label;
    this.construct = construct;
    this.declarationPath = declarationPath;
  }
}

function bytewise(left, right) {
  return Buffer.compare(Buffer.from(left), Buffer.from(right));
}

function canonicalValue(value) {
  if (Array.isArray(value)) {
    return value.map(canonicalValue);
  }
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort(bytewise)
        .map((key) => [key, canonicalValue(value[key])]),
    );
  }
  return value;
}

function sha256(value) {
  const bytes = typeof value === "string" ? value : JSON.stringify(canonicalValue(value));
  return `sha256:${crypto.createHash("sha256").update(bytes, "utf8").digest("hex")}`;
}

function jsonBytes(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function normalizedText(source) {
  return source.replace(/\r\n?/g, "\n").replace(/[ \t]+$/gm, "").trim();
}

function relativeLabel(filePath) {
  const relative = path.relative(ROOT, filePath).split(path.sep).join("/");
  return relative.startsWith("../") || path.isAbsolute(relative) ? filePath : relative;
}

function readText(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch (error) {
    throw new BindingFailure(`cannot read ${relativeLabel(filePath)}: ${error.message}`);
  }
}

function readJson(filePath) {
  try {
    return JSON.parse(readText(filePath));
  } catch (error) {
    if (error instanceof BindingFailure) {
      throw error;
    }
    throw new BindingFailure(`invalid JSON in ${relativeLabel(filePath)}: ${error.message}`);
  }
}

function formatAjvErrors(errors) {
  return (errors ?? [])
    .map((error) => `${error.instancePath || "/"} ${error.message}`)
    .join("; ");
}

function validateSchema(value, schemaPath, label) {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  const validate = ajv.compile(readJson(schemaPath));
  if (!validate(value)) {
    throw new BindingFailure(`${label} violates its closed schema: ${formatAjvErrors(validate.errors)}`);
  }
}

function resolveOption(value) {
  return path.isAbsolute(value) ? value : path.resolve(ROOT, value);
}

function parseArguments(argv) {
  const mode = argv[0] ?? "check";
  if (!new Set(["candidate", "check", "render", "update", "drift", "probe"]).has(mode)) {
    throw new BindingFailure(
      `unknown mode ${mode}; expected candidate, check, render, update, drift, or probe`,
    );
  }
  const options = {
    mode,
    surfacePath: DEFAULT_SURFACE,
    overridesPath: DEFAULT_OVERRIDES,
    implementationsPath: DEFAULT_IMPLEMENTATIONS,
    irPath: DEFAULT_IR,
    driftJsonPath: DEFAULT_DRIFT_JSON,
    driftMarkdownPath: DEFAULT_DRIFT_MARKDOWN,
    artifact: "ir",
    format: "markdown",
    candidatePath: undefined,
    probePath: undefined,
    nextPackageRoot: undefined,
  };
  const pathFlags = new Map([
    ["--surface", "surfacePath"],
    ["--overrides", "overridesPath"],
    ["--implementations", "implementationsPath"],
    ["--ir", "irPath"],
    ["--drift-json", "driftJsonPath"],
    ["--drift-markdown", "driftMarkdownPath"],
    ["--candidate", "candidatePath"],
    ["--file", "probePath"],
    ["--next-package-root", "nextPackageRoot"],
  ]);
  for (let index = 1; index < argv.length; index += 1) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (value === undefined) {
      throw new BindingFailure(`incomplete option ${flag}`);
    }
    if (pathFlags.has(flag)) {
      options[pathFlags.get(flag)] = resolveOption(value);
    } else if (flag === "--artifact") {
      if (!new Set(["ir", "extern", "drift-json", "drift-markdown"]).has(value)) {
        throw new BindingFailure(`unknown render artifact ${value}`);
      }
      options.artifact = value;
    } else if (flag === "--format") {
      if (!new Set(["json", "markdown"]).has(value)) {
        throw new BindingFailure(`unknown drift format ${value}`);
      }
      options.format = value;
    } else {
      throw new BindingFailure(`unknown option ${flag}`);
    }
    index += 1;
  }
  if (mode === "drift" && options.candidatePath === undefined) {
    throw new BindingFailure("drift mode requires --candidate <normalized-binding-ir.json>");
  }
  if (mode === "probe" && options.probePath === undefined) {
    throw new BindingFailure("probe mode requires --file <declaration.d.ts>");
  }
  if (mode === "candidate" && options.nextPackageRoot === undefined) {
    throw new BindingFailure("candidate mode requires --next-package-root <directory>");
  }
  if (mode !== "candidate" && options.nextPackageRoot !== undefined) {
    throw new BindingFailure("--next-package-root is available only in candidate mode");
  }
  return options;
}

function uniqueMap(items, keyOf, label) {
  const result = new Map();
  for (const item of items) {
    const key = keyOf(item);
    if (result.has(key)) {
      throw new BindingFailure(`${label} contains duplicate ${key}`);
    }
    result.set(key, item);
  }
  return result;
}

function insideRoot(filePath, root) {
  const relative = path.relative(root, filePath);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

function installedPackages(surface, explicitNextRoot = undefined) {
  let nextPackagePath;
  if (explicitNextRoot === undefined) {
    nextPackagePath = REQUIRE.resolve("next/package.json");
  } else {
    let realRoot;
    try {
      realRoot = fs.realpathSync.native(explicitNextRoot);
    } catch (error) {
      throw new BindingFailure(`cannot resolve explicit Next package root: ${error.message}`);
    }
    if (!fs.statSync(realRoot).isDirectory()) {
      throw new BindingFailure("explicit Next package root is not a directory");
    }
    nextPackagePath = path.join(realRoot, "package.json");
  }
  const typescriptPackagePath = REQUIRE.resolve("typescript/package.json");
  const nextPackage = readJson(nextPackagePath);
  const typescriptPackage = readJson(typescriptPackagePath);
  const expected = surface.sources.packages;
  if (nextPackage.name !== expected.next.name || nextPackage.version !== expected.next.version) {
    throw new BindingFailure(
      `installed Next identity is ${nextPackage.name}@${nextPackage.version}; normalized surface requires ${expected.next.name}@${expected.next.version}`,
    );
  }
  if (
    typescriptPackage.name !== expected.typescript.name ||
    typescriptPackage.version !== expected.typescript.version ||
    ts.version !== expected.typescript.version
  ) {
    throw new BindingFailure(
      `installed TypeScript identity is ${typescriptPackage.name}@${typescriptPackage.version} with compiler ${ts.version}; normalized surface requires ${expected.typescript.name}@${expected.typescript.version}`,
    );
  }
  return {
    next: {
      name: nextPackage.name,
      version: nextPackage.version,
      root: fs.realpathSync.native(path.dirname(nextPackagePath)),
    },
    typescript: {
      importName: expected.typescript.importName,
      name: typescriptPackage.name,
      version: typescriptPackage.version,
      root: fs.realpathSync.native(path.dirname(typescriptPackagePath)),
      libRoot: fs.realpathSync.native(
        path.dirname(ts.getDefaultLibFilePath({ target: ts.ScriptTarget.ES2022 })),
      ),
    },
  };
}

function declarationFile(origin, packages) {
  let candidate;
  let allowedRoot;
  if (origin.package === packages.next.name) {
    candidate = path.join(packages.next.root, ...origin.path.split("/"));
    allowedRoot = packages.next.root;
  } else if (origin.package === packages.typescript.name && origin.path.startsWith("lib/")) {
    candidate = path.join(packages.typescript.libRoot, ...origin.path.slice(4).split("/"));
    allowedRoot = packages.typescript.libRoot;
  } else if (origin.package === packages.typescript.name) {
    candidate = path.join(packages.typescript.root, ...origin.path.split("/"));
    allowedRoot = packages.typescript.root;
  } else {
    throw new BindingFailure(`declaration names unreviewed package ${origin.package}`);
  }
  let actual;
  try {
    actual = fs.realpathSync.native(candidate);
  } catch (error) {
    throw new BindingFailure(`cannot resolve ${origin.package}:${origin.path}: ${error.message}`);
  }
  if (!insideRoot(actual, allowedRoot)) {
    throw new BindingFailure(`${origin.package}:${origin.path} escaped its pinned package root`);
  }
  return actual;
}

function declarationName(node, fallback) {
  if ("name" in node && node.name !== undefined) {
    return node.name.getText(node.getSourceFile()).replace(/\s+/g, " ");
  }
  return fallback;
}

function normalizeDeclaration(printer, node) {
  return normalizedText(
    printer.printNode(ts.EmitHint.Unspecified, node, node.getSourceFile()),
  );
}

function declarationDigest(printer, node, fallback) {
  const syntaxKind = ts.SyntaxKind[node.kind];
  const declaredName = declarationName(node, fallback);
  return sha256({ syntaxKind, declaredName, text: normalizeDeclaration(printer, node) });
}

function documentationDigest(node) {
  const sourceFile = node.getSourceFile();
  const documents = [];
  const seen = new Set();
  let current = node;
  while (current !== undefined && !ts.isSourceFile(current)) {
    for (const doc of current.jsDoc ?? []) {
      const key = `${doc.pos}:${doc.end}`;
      if (!seen.has(key)) {
        documents.push(normalizedText(doc.getText(sourceFile)));
        seen.add(key);
      }
    }
    if (ts.isStatement(current)) {
      break;
    }
    current = current.parent;
  }
  const docs = documents.join("\n");
  return sha256(docs);
}

function typeConstructName(node) {
  if (ts.isImportTypeNode(node)) {
    return "ImportType";
  }
  return ts.SyntaxKind[node.kind] ?? `SyntaxKind${node.kind}`;
}

function inspectTypeConstructs(node, label, declarationPath, allowUnsupported = false) {
  const names = new Set();
  const unsupportedConstructs = new Set();
  let anyOccurrences = 0;
  let unknownOccurrences = 0;
  function visit(candidate) {
    if (ts.isTypeNode(candidate)) {
      const name = typeConstructName(candidate);
      if (!ALLOWED_TYPE_CONSTRUCTS.has(name)) {
        if (!allowUnsupported) {
          throw new UnsupportedConstructFailure(label, name, declarationPath);
        }
        unsupportedConstructs.add(name);
      } else {
        names.add(name);
      }
      if (name === "AnyKeyword") {
        anyOccurrences += 1;
      } else if (name === "UnknownKeyword") {
        unknownOccurrences += 1;
      }
    }
    ts.forEachChild(candidate, visit);
  }
  visit(node);
  return {
    typeConstructs: [...names].sort(bytewise),
    unsupportedConstructs: [...unsupportedConstructs].sort(bytewise),
    anyOccurrences,
    unknownOccurrences,
  };
}

function parseDeclarationFile(filePath, cache) {
  let sourceFile = cache.get(filePath);
  if (sourceFile === undefined) {
    sourceFile = ts.createSourceFile(
      filePath,
      readText(filePath),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );
    cache.set(filePath, sourceFile);
  }
  return sourceFile;
}

function findDeclaration(
  origin,
  packages,
  printer,
  sourceCache,
  label,
  allowUnsupported = false,
) {
  const filePath = declarationFile(origin, packages);
  const sourceFile = parseDeclarationFile(filePath, sourceCache);
  const matches = [];
  function visit(node) {
    if (
      ts.SyntaxKind[node.kind] === origin.syntaxKind &&
      declarationName(node, origin.declaredName) === origin.declaredName &&
      declarationDigest(printer, node, origin.declaredName) === origin.declarationHash
    ) {
      matches.push(node);
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  if (matches.length !== 1) {
    throw new BindingFailure(
      `${label} expected one ${origin.syntaxKind} ${origin.declaredName} matching ${origin.declarationHash} in ${origin.package}:${origin.path}, found ${matches.length}`,
    );
  }
  const node = matches[0];
  const typeInspection = inspectTypeConstructs(
    node,
    label,
    `${origin.package}:${origin.path}`,
    allowUnsupported,
  );
  return {
    node,
    record: {
      package: origin.package,
      path: origin.path,
      syntaxKind: origin.syntaxKind,
      declaredName: origin.declaredName,
      declarationHash: origin.declarationHash,
      documentationHash: documentationDigest(node),
      normalizedText: normalizeDeclaration(printer, node),
      typeConstructs: typeInspection.typeConstructs,
      internal: origin.internal,
    },
    anyOccurrences: typeInspection.anyOccurrences,
    unknownOccurrences: typeInspection.unknownOccurrences,
    unsupportedConstructs: typeInspection.unsupportedConstructs,
  };
}

function exportKey(module, name) {
  return `${module}\0${name}`;
}

function sortedSurfaceExports(surface) {
  return surface.publicEntrypoints
    .flatMap((entrypoint) =>
      entrypoint.exports.map((candidate) => ({ entrypoint, candidate })),
    )
    .sort((left, right) => {
      const priority =
        PRIORITY_RANK.get(left.entrypoint.priority) - PRIORITY_RANK.get(right.entrypoint.priority);
      if (priority !== 0) {
        return priority;
      }
      const moduleOrder = bytewise(left.entrypoint.module, right.entrypoint.module);
      return moduleOrder === 0
        ? bytewise(left.candidate.name, right.candidate.name)
        : moduleOrder;
    });
}

function generationOwner(module) {
  const owner = OWNER_BY_MODULE.get(module);
  if (owner === undefined) {
    throw new BindingFailure(`${module} has no explicit B03-B05 binding owner`);
  }
  return owner;
}

function assertOverridePolicy(overrides, surface) {
  if (overrides.reviewedSurfaceHash !== surface.surfaceHash) {
    throw new BindingFailure(
      `override review is pinned to ${overrides.reviewedSurfaceHash}, but the surface is ${surface.surfaceHash}; inspect drift before changing reviewedSurfaceHash`,
    );
  }
  uniqueMap(overrides.safetyOverrides, (item) => item.id, "safety overrides");
  uniqueMap(
    overrides.safetyOverrides,
    (item) => exportKey(item.module, item.export),
    "safety overrides",
  );
  uniqueMap(overrides.generators, (item) => item.output, "binding generators");
  uniqueMap(
    overrides.generators,
    (item) => exportKey(item.module, item.export),
    "binding generators",
  );
  uniqueMap(
    overrides.acceptedTransitions,
    (item) => `${item.fromIrHash}\0${item.toIrHash}`,
    "accepted transitions",
  );
}

function assertBytewiseSorted(values, label) {
  const sorted = [...values].sort(bytewise);
  if (JSON.stringify(values) !== JSON.stringify(sorted)) {
    throw new BindingFailure(`${label} must be bytewise sorted for deterministic review`);
  }
}

function assertImplementationPolicy(implementations, surface, overrides) {
  if (implementations.reviewedSurfaceHash !== surface.surfaceHash) {
    throw new BindingFailure(
      `implementation review is pinned to ${implementations.reviewedSurfaceHash}, but the surface is ${surface.surfaceHash}; inspect declaration drift before changing reviewedSurfaceHash`,
    );
  }
  uniqueMap(implementations.implementations, (item) => item.id, "curated implementations");
  assertBytewiseSorted(
    implementations.implementations.map((item) => item.id),
    "curated implementation ids",
  );
  const symbols = [];
  const outputs = [];
  for (const implementation of implementations.implementations) {
    if (implementation.owningBead !== generationOwner(implementation.module)) {
      throw new BindingFailure(
        `${implementation.id} owner ${implementation.owningBead} does not match ${implementation.module}'s binding owner ${generationOwner(implementation.module)}`,
      );
    }
    assertBytewiseSorted(
      implementation.symbols.map((symbol) => symbol.export),
      `${implementation.id} symbols`,
    );
    assertBytewiseSorted(implementation.outputs, `${implementation.id} outputs`);
    uniqueMap(
      implementation.symbols,
      (symbol) => symbol.export,
      `${implementation.id} symbols`,
    );
    for (const symbol of implementation.symbols) {
      symbols.push({ implementation, symbol });
    }
    for (const output of implementation.outputs) {
      if (!output.startsWith("src/nextjs/") || !output.endsWith(".hx")) {
        throw new BindingFailure(
          `${implementation.id} output ${output} must be a Haxe source under src/nextjs`,
        );
      }
      outputs.push({ implementation, output });
    }
    const fixturePath = path.join(ROOT, ...implementation.fixture.split("/"));
    if (!insideRoot(fixturePath, ROOT) || !fs.statSync(fixturePath).isDirectory()) {
      throw new BindingFailure(
        `${implementation.id} fixture ${implementation.fixture} must be a repository directory`,
      );
    }
  }
  const symbolMap = uniqueMap(
    symbols,
    ({ implementation, symbol }) => exportKey(implementation.module, symbol.export),
    "curated implementation symbols",
  );
  uniqueMap(outputs, (item) => item.output, "curated implementation outputs");
  const generatorSymbols = new Set(
    overrides.generators.map((item) => exportKey(item.module, item.export)),
  );
  for (const key of symbolMap.keys()) {
    if (generatorSymbols.has(key)) {
      throw new BindingFailure(
        `binding ${key.replace("\0", ".")} cannot be both mechanically generated and curated`,
      );
    }
  }
  return symbolMap;
}

function curatedOutputRecord(implementation, output) {
  const outputPath = path.join(ROOT, ...output.split("/"));
  if (!insideRoot(outputPath, ROOT)) {
    throw new BindingFailure(`${implementation.id} output escapes the repository: ${output}`);
  }
  let stat;
  try {
    stat = fs.lstatSync(outputPath);
  } catch (error) {
    throw new BindingFailure(`cannot inspect curated output ${output}: ${error.message}`);
  }
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new BindingFailure(`${implementation.id} output ${output} must be a regular file`);
  }
  const bytes = readText(outputPath);
  const code = bytes
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
  if (/\bDynamic\b/.test(code)) {
    throw new BindingFailure(
      `${implementation.id} output ${output} introduces Dynamic; use an exact type projection or genes.ts.Unknown boundary`,
    );
  }
  if (/@:jsRequire\s*\(\s*["']next\/dist(?:\/|["'])/.test(code)) {
    throw new BindingFailure(
      `${implementation.id} output ${output} runtime-imports private next/dist code`,
    );
  }
  if (bytes.includes("/Users/") || bytes.includes("\\\\Users\\")) {
    throw new BindingFailure(`${implementation.id} output ${output} contains a machine-local path`);
  }
  return { path: output, sha256: sha256(bytes) };
}

function haxeString(value) {
  return JSON.stringify(value);
}

function renderLiteralUnion(generator, selectedExport, node) {
  if (!ts.isTypeAliasDeclaration(node) || !ts.isUnionTypeNode(node.type)) {
    throw new UnsupportedConstructFailure(
      `${generator.module}.${generator.export}`,
      ts.isTypeAliasDeclaration(node)
        ? typeConstructName(node.type)
        : ts.SyntaxKind[node.kind],
      selectedExport.declarations[0].path,
    );
  }
  const literalValues = [];
  let undefinedCount = 0;
  for (const member of node.type.types) {
    if (member.kind === ts.SyntaxKind.UndefinedKeyword) {
      undefinedCount += 1;
    } else if (
      ts.isLiteralTypeNode(member) &&
      (ts.isStringLiteral(member.literal) || ts.isNoSubstitutionTemplateLiteral(member.literal))
    ) {
      literalValues.push(member.literal.text);
    } else {
      throw new UnsupportedConstructFailure(
        `${generator.module}.${generator.export}`,
        typeConstructName(member),
        selectedExport.declarations[0].path,
      );
    }
  }
  const configuredValues = generator.values.map((value) => value.typescript);
  if (undefinedCount !== 1 || JSON.stringify(literalValues) !== JSON.stringify(configuredValues)) {
    throw new BindingFailure(
      `${generator.module}.${generator.export} no longer matches its reviewed string literals plus one undefined; expected ${JSON.stringify(configuredValues)}, found ${JSON.stringify(literalValues)} with ${undefinedCount} undefined member(s)`,
    );
  }
  const haxeNames = generator.values.map((value) => value.haxe);
  if (new Set(haxeNames).size !== haxeNames.length) {
    throw new BindingFailure(`${generator.module}.${generator.export} has duplicate Haxe enum names`);
  }
  const expectedTypePath = `nextjs.raw.${generator.export}`;
  const expectedOutput = `src/${expectedTypePath.replaceAll(".", "/")}.hx`;
  if (selectedExport.haxeTypePath !== expectedTypePath || generator.output !== expectedOutput) {
    throw new BindingFailure(
      `${generator.module}.${generator.export} must generate ${expectedTypePath} at ${expectedOutput}`,
    );
  }
  const values = generator.values
    .map((value) => `\tfinal ${value.haxe} = ${haxeString(value.typescript)};`)
    .join("\n");
  const typeScriptValueUnion = generator.values
    .map((value) => JSON.stringify(value.typescript))
    .join(" | ");
  const typeScriptUnion = `${typeScriptValueUnion} | undefined`;
  return `package nextjs.raw;

import genes.ts.Undefinable;

/**
 * Server runtime values accepted by Next.js ${selectedExport.packageVersion}.
 *
 * Generated from \`${generator.module}.${generator.export}\`
 * (${selectedExport.signatureHash}). Do not edit this file directly; update the
 * reviewed declaration surface and run \`npm run bindings:next:update\`.
 */
@:ts.type(${haxeString(typeScriptUnion)})
typedef ${generator.export} = Undefinable<${generator.export}Value>;

/** Closed, typo-safe view of the upstream TypeScript string-literal union. */
@:ts.type(${haxeString(typeScriptValueUnion)})
enum abstract ${generator.export}Value(String) to String {
${values}
}
`;
}

function buildBindingIR(surface, overrides, implementations, packages) {
  assertOverridePolicy(overrides, surface);
  const implementationByExport = assertImplementationPolicy(
    implementations,
    surface,
    overrides,
  );
  const safetyByExport = uniqueMap(
    overrides.safetyOverrides,
    (item) => exportKey(item.module, item.export),
    "safety overrides",
  );
  const generatorByExport = uniqueMap(
    overrides.generators,
    (item) => exportKey(item.module, item.export),
    "binding generators",
  );
  const usedSafetyOverrides = new Set();
  const usedGenerators = new Set();
  const usedImplementations = new Set();
  const sourceCache = new Map();
  const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed, removeComments: true });
  const exports = [];
  const nodesByExport = new Map();

  for (const { entrypoint, candidate } of sortedSurfaceExports(surface)) {
    const key = exportKey(entrypoint.module, candidate.name);
    const label = `${entrypoint.module}.${candidate.name}`;
    const declarations = [];
    const nodes = [];
    let anyOccurrences = 0;
    let unknownOccurrences = 0;
    for (const origin of candidate.declarations) {
      const ingested = findDeclaration(origin, packages, printer, sourceCache, label);
      declarations.push(ingested.record);
      nodes.push(ingested.node);
      anyOccurrences += ingested.anyOccurrences;
      unknownOccurrences += ingested.unknownOccurrences;
    }
    nodesByExport.set(key, nodes);

    const appliedOverrides = [];
    const safetyOverride = safetyByExport.get(key);
    if (safetyOverride !== undefined) {
      if (safetyOverride.expectedSignatureHash !== candidate.signatureHash) {
        throw new BindingFailure(
          `${label} safety override ${safetyOverride.id} is pinned to ${safetyOverride.expectedSignatureHash}, found ${candidate.signatureHash}`,
        );
      }
      const occurrences =
        safetyOverride.action === "map-any-to-genes-unknown"
          ? anyOccurrences
          : unknownOccurrences;
      if (occurrences !== safetyOverride.expectedOccurrences) {
        throw new BindingFailure(
          `${label} safety override ${safetyOverride.id} expected ${safetyOverride.expectedOccurrences} occurrence(s), found ${occurrences}`,
        );
      }
      appliedOverrides.push({
        id: safetyOverride.id,
        action: safetyOverride.action,
        occurrences,
        target: "genes.ts.Unknown",
        owningBead: safetyOverride.owningBead,
      });
      usedSafetyOverrides.add(safetyOverride.id);
    }
    if (
      anyOccurrences > 0 &&
      safetyOverride?.action !== "map-any-to-genes-unknown"
    ) {
      throw new BindingFailure(
        `${label} contains ${anyOccurrences} any occurrence(s) without a signature-pinned map-any-to-genes-unknown override`,
      );
    }
    if (
      unknownOccurrences > 0 &&
      safetyOverride?.action !== "allow-external-unknown"
    ) {
      throw new BindingFailure(
        `${label} contains ${unknownOccurrences} unknown occurrence(s) without a signature-pinned allow-external-unknown override`,
      );
    }

    const generator = generatorByExport.get(key);
    let generation;
    const curated = implementationByExport.get(key);
    if (generator === undefined && curated === undefined) {
      generation = { status: "pending", owningBead: generationOwner(entrypoint.module) };
    } else if (generator !== undefined) {
      if (generator.expectedSignatureHash !== candidate.signatureHash) {
        throw new BindingFailure(
          `${label} generator is pinned to ${generator.expectedSignatureHash}, found ${candidate.signatureHash}`,
        );
      }
      generation = {
        status: "generated",
        strategy: generator.strategy,
        output: generator.output,
        owningBead: generator.owningBead,
      };
      usedGenerators.add(key);
    } else {
      if (curated.symbol.expectedSignatureHash !== candidate.signatureHash) {
        throw new BindingFailure(
          `${label} curated implementation ${curated.implementation.id} is pinned to ${curated.symbol.expectedSignatureHash}, found ${candidate.signatureHash}`,
        );
      }
      generation = {
        status: "curated",
        implementation: curated.implementation.id,
        strategy: curated.implementation.strategy,
        owningBead: curated.implementation.owningBead,
        fixture: curated.implementation.fixture,
      };
      usedImplementations.add(key);
    }

    const record = {
      module: entrypoint.module,
      name: candidate.name,
      priority: entrypoint.priority,
      kind: candidate.kind,
      stability: candidate.stability,
      signatureHash: candidate.signatureHash,
      haxeTypePath: candidate.haxeTypePath,
    };
    if (candidate.haxeMember !== undefined) {
      record.haxeMember = candidate.haxeMember;
    }
    record.exposure = candidate.exposure;
    record.fixture = entrypoint.fixture;
    record.declarations = declarations;
    record.safety = { anyOccurrences, unknownOccurrences, appliedOverrides };
    record.generation = generation;
    exports.push(record);
  }

  for (const safetyOverride of overrides.safetyOverrides) {
    if (!usedSafetyOverrides.has(safetyOverride.id)) {
      throw new BindingFailure(`safety override ${safetyOverride.id} did not match a reviewed export`);
    }
  }
  for (const key of implementationByExport.keys()) {
    if (!usedImplementations.has(key)) {
      throw new BindingFailure(
        `curated implementation ${key.replace("\0", ".")} did not match a reviewed export`,
      );
    }
  }

  const generated = new Map();
  for (const generator of overrides.generators) {
    const key = exportKey(generator.module, generator.export);
    if (!usedGenerators.has(key)) {
      throw new BindingFailure(`${generator.module}.${generator.export} generator did not match a reviewed export`);
    }
    const selectedExport = exports.find(
      (candidate) => candidate.module === generator.module && candidate.name === generator.export,
    );
    const nodes = nodesByExport.get(key);
    if (nodes.length !== 1) {
      throw new BindingFailure(
        `${generator.module}.${generator.export} generator requires exactly one declaration, found ${nodes.length}`,
      );
    }
    const bytes = renderLiteralUnion(
      generator,
      { ...selectedExport, packageVersion: packages.next.version },
      nodes[0],
    );
    generated.set(generator.output, bytes);
  }

  const generatedExterns = [...generated]
    .map(([output, bytes]) => {
      const generator = overrides.generators.find((candidate) => candidate.output === output);
      return {
        module: generator.module,
        export: generator.export,
        output,
        sha256: sha256(bytes),
      };
    })
    .sort((left, right) => bytewise(left.output, right.output));

  const curatedExterns = implementations.implementations.map((implementation) => ({
    id: implementation.id,
    module: implementation.module,
    exports: implementation.symbols.map((symbol) => symbol.export),
    strategy: implementation.strategy,
    owningBead: implementation.owningBead,
    fixture: implementation.fixture,
    outputs: implementation.outputs.map((output) =>
      curatedOutputRecord(implementation, output),
    ),
  }));

  const base = {
    $schema: "../schemas/next-binding-ir.schema.json",
    protocol: "nextjshx.next-binding-ir",
    version: 1,
    generatedBy: {
      script: "scripts/bindings/sync-next-bindings.mjs",
      typescriptVersion: packages.typescript.version,
    },
    sources: {
      allowlist: "config/next-public-entrypoints.json",
      surface: "surface/next-public-surface.json",
      overrides: "config/next-binding-overrides.json",
      implementations: "config/next-binding-implementations.json",
    },
    packages: {
      next: { name: packages.next.name, version: packages.next.version },
      typescript: {
        importName: packages.typescript.importName,
        name: packages.typescript.name,
        version: packages.typescript.version,
      },
    },
    surfaceHash: surface.surfaceHash,
    exports,
    generatedExterns,
    curatedExterns,
  };
  const ir = { ...base, irHash: sha256(base) };
  validateSchema(ir, IR_SCHEMA, "generated binding IR");
  return { ir, generated };
}

function projectedOverrideOccurrences(action, anyOccurrences, unknownOccurrences) {
  if (action === "map-any-to-genes-unknown") {
    return anyOccurrences;
  }
  if (action === "allow-external-unknown") {
    return unknownOccurrences;
  }
  throw new BindingFailure(`candidate projection encountered unknown safety action ${action}`);
}

function buildCandidateIR(surface, baseline, packages) {
  assertIrHash(baseline, "baseline binding IR");
  const baselineExports = uniqueMap(
    baseline.exports,
    (item) => exportKey(item.module, item.name),
    "baseline IR exports",
  );
  const sourceCache = new Map();
  const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed, removeComments: true });
  const exports = [];
  const additionalChanges = [];

  for (const { entrypoint, candidate } of sortedSurfaceExports(surface)) {
    const key = exportKey(entrypoint.module, candidate.name);
    const before = baselineExports.get(key);
    const label = `${entrypoint.module}.${candidate.name}`;
    const declarations = [];
    let anyOccurrences = 0;
    let unknownOccurrences = 0;
    const unsupported = [];
    for (const origin of candidate.declarations) {
      const ingested = findDeclaration(
        origin,
        packages,
        printer,
        sourceCache,
        label,
        true,
      );
      declarations.push(ingested.record);
      anyOccurrences += ingested.anyOccurrences;
      unknownOccurrences += ingested.unknownOccurrences;
      for (const construct of ingested.unsupportedConstructs) {
        unsupported.push({ construct, declarationPath: `${origin.package}:${origin.path}` });
      }
    }

    const appliedOverrides = (before?.safety.appliedOverrides ?? []).map((override) => ({
      ...override,
      occurrences: projectedOverrideOccurrences(
        override.action,
        anyOccurrences,
        unknownOccurrences,
      ),
    }));
    const generation =
      before?.generation ?? {
        status: "pending",
        owningBead: generationOwner(entrypoint.module),
      };
    const record = {
      module: entrypoint.module,
      name: candidate.name,
      priority: entrypoint.priority,
      kind: candidate.kind,
      stability: candidate.stability,
      signatureHash: candidate.signatureHash,
      haxeTypePath: candidate.haxeTypePath,
    };
    if (candidate.haxeMember !== undefined) {
      record.haxeMember = candidate.haxeMember;
    }
    record.exposure = candidate.exposure;
    record.fixture = entrypoint.fixture;
    record.declarations = declarations;
    record.safety = { anyOccurrences, unknownOccurrences, appliedOverrides };
    record.generation = generation;
    exports.push(record);
    for (const finding of unsupported) {
      pushChange(
        additionalChanges,
        "unsupported-construct",
        "NXHX-DRIFT-UNSUPPORTED-CONSTRUCT",
        record,
        `${label} uses unsupported TypeScript construct ${finding.construct} in ${finding.declarationPath}; add a generalized parser rule and fixture before accepting this Next version.`,
      );
    }
  }

  const base = {
    $schema: "../schemas/next-binding-ir.schema.json",
    protocol: "nextjshx.next-binding-ir",
    version: 1,
    generatedBy: {
      script: "scripts/bindings/sync-next-bindings.mjs",
      typescriptVersion: packages.typescript.version,
    },
    sources: {
      allowlist: "config/next-public-entrypoints.json",
      surface: "surface/next-public-surface.json",
      overrides: "config/next-binding-overrides.json",
      implementations: "config/next-binding-implementations.json",
    },
    packages: {
      next: { name: packages.next.name, version: packages.next.version },
      typescript: {
        importName: packages.typescript.importName,
        name: packages.typescript.name,
        version: packages.typescript.version,
      },
    },
    surfaceHash: surface.surfaceHash,
    exports,
    generatedExterns: structuredClone(baseline.generatedExterns),
    curatedExterns: structuredClone(baseline.curatedExterns ?? []),
  };
  const ir = { ...base, irHash: sha256(base) };
  validateSchema(ir, IR_SCHEMA, "candidate binding IR projection");
  return { ir, additionalChanges };
}

function assertIrHash(ir, label) {
  const base = { ...ir };
  delete base.irHash;
  const actual = sha256(base);
  if (actual !== ir.irHash) {
    throw new BindingFailure(`${label} irHash is ${ir.irHash}, recomputed ${actual}`);
  }
}

function ownerOf(candidate) {
  return candidate.generation.owningBead;
}

function declarationLocations(candidate) {
  return candidate.declarations.map((declaration) => ({
    package: declaration.package,
    path: declaration.path,
    internal: declaration.internal,
    syntaxKind: declaration.syntaxKind,
    declaredName: declaration.declaredName,
    declarationHash: declaration.declarationHash,
  }));
}

function documentationHashes(candidate) {
  return candidate.declarations.map((declaration) => declaration.documentationHash);
}

function pushChange(changes, classification, code, candidate, message) {
  const change = {
    classification,
    code,
    module: candidate.module,
  };
  if (candidate.name !== undefined) {
    change.export = candidate.name;
  }
  change.message = message;
  change.owner = candidate.name === undefined ? "nxhx-f34.3.6" : ownerOf(candidate);
  change.fixture =
    candidate.name === undefined
      ? "tests/next-surface/fixtures.json#pinned-packages"
      : candidate.fixture;
  changes.push(change);
}

function sortChanges(changes) {
  return changes.sort((left, right) => {
    const classification =
      CLASSIFICATION_RANK.get(left.classification) -
      CLASSIFICATION_RANK.get(right.classification);
    if (classification !== 0) {
      return classification;
    }
    return bytewise(
      `${left.module}\0${left.export ?? ""}\0${left.code}\0${left.message}`,
      `${right.module}\0${right.export ?? ""}\0${right.code}\0${right.message}`,
    );
  });
}

function compareIr(baseline, candidate) {
  assertIrHash(baseline, "baseline binding IR");
  assertIrHash(candidate, "candidate binding IR");
  const changes = [];
  const baselineExports = uniqueMap(
    baseline.exports,
    (item) => exportKey(item.module, item.name),
    "baseline IR exports",
  );
  const candidateExports = uniqueMap(
    candidate.exports,
    (item) => exportKey(item.module, item.name),
    "candidate IR exports",
  );

  for (const [key, before] of baselineExports) {
    const after = candidateExports.get(key);
    if (after === undefined) {
      pushChange(
        changes,
        "breaking",
        "NXHX-DRIFT-EXPORT-REMOVED",
        before,
        `${before.module}.${before.name} was removed; update ${before.generation.owningBead} and ${before.fixture} before accepting this Next version.`,
      );
      continue;
    }
    if (before.signatureHash !== after.signatureHash || before.kind !== after.kind) {
      pushChange(
        changes,
        "breaking",
        "NXHX-DRIFT-SIGNATURE-CHANGED",
        after,
        `${after.module}.${after.name} changed its reviewed ${before.kind} signature from ${before.signatureHash} to ${after.signatureHash}.`,
      );
      continue;
    }
    if (
      before.haxeTypePath !== after.haxeTypePath ||
      before.haxeMember !== after.haxeMember ||
      before.exposure !== after.exposure ||
      JSON.stringify(before.safety) !== JSON.stringify(after.safety) ||
      JSON.stringify(before.generation) !== JSON.stringify(after.generation)
    ) {
      pushChange(
        changes,
        "breaking",
        "NXHX-DRIFT-BINDING-CONTRACT-CHANGED",
        after,
        `${after.module}.${after.name} changed its Haxe mapping, exposure, safety policy, or generation owner.`,
      );
      continue;
    }
    if (before.stability !== after.stability) {
      pushChange(
        changes,
        "behavioral-review-required",
        "NXHX-DRIFT-STABILITY-CHANGED",
        after,
        `${after.module}.${after.name} stability changed from ${before.stability} to ${after.stability}; review documentation and fixture expectations.`,
      );
    }
    if (JSON.stringify(documentationHashes(before)) !== JSON.stringify(documentationHashes(after))) {
      pushChange(
        changes,
        "behavioral-review-required",
        "NXHX-DRIFT-DOCUMENTATION-CHANGED",
        after,
        `${after.module}.${after.name} declaration documentation changed without a structural signature change; review behavioral guidance.`,
      );
    }
    if (JSON.stringify(declarationLocations(before)) !== JSON.stringify(declarationLocations(after))) {
      pushChange(
        changes,
        "compatible",
        "NXHX-DRIFT-DECLARATION-MOVED",
        after,
        `${after.module}.${after.name} kept the same public signature but its declaration origin moved; no runtime import of the internal path is permitted.`,
      );
    }
  }

  for (const [key, after] of candidateExports) {
    if (!baselineExports.has(key)) {
      pushChange(
        changes,
        "additive",
        "NXHX-DRIFT-EXPORT-ADDED",
        after,
        `${after.module}.${after.name} is a new reviewed export; implement or explicitly defer its binding and fixture before accepting it.`,
      );
    }
  }

  if (JSON.stringify(baseline.packages) !== JSON.stringify(candidate.packages)) {
    pushChange(
      changes,
      "behavioral-review-required",
      "NXHX-DRIFT-PACKAGE-VERSION-CHANGED",
      { module: "packages", name: undefined },
      `Pinned package identities changed from Next ${baseline.packages.next.version}/TypeScript ${baseline.packages.typescript.version} to Next ${candidate.packages.next.version}/TypeScript ${candidate.packages.typescript.version}.`,
    );
  }
  if (
    baseline.surfaceHash !== candidate.surfaceHash &&
    changes.length === 0
  ) {
    pushChange(
      changes,
      "behavioral-review-required",
      "NXHX-DRIFT-SURFACE-METADATA-CHANGED",
      { module: "surface", name: undefined },
      `The reviewed surface hash changed from ${baseline.surfaceHash} to ${candidate.surfaceHash} without an export-level difference; inspect allowlist metadata.`,
    );
  }
  if (
    JSON.stringify(baseline.generatedExterns) !== JSON.stringify(candidate.generatedExterns) &&
    !changes.some((change) => change.code === "NXHX-DRIFT-BINDING-CONTRACT-CHANGED")
  ) {
    const reference = candidate.exports.find((item) => item.generation.status === "generated") ?? {
      module: "generated-externs",
      name: undefined,
    };
    pushChange(
      changes,
      "breaking",
      "NXHX-DRIFT-GENERATED-EXTERN-CHANGED",
      reference,
      "Generated Haxe bytes changed without a corresponding reviewed binding-contract change; inspect generator determinism and the emitted diff.",
    );
  }
  if (
    JSON.stringify(baseline.curatedExterns ?? []) !==
      JSON.stringify(candidate.curatedExterns ?? []) &&
    !changes.some((change) => change.code === "NXHX-DRIFT-BINDING-CONTRACT-CHANGED")
  ) {
    const baselineGroups = new Map(
      (baseline.curatedExterns ?? []).map((group) => [group.id, group]),
    );
    const changedGroup = (candidate.curatedExterns ?? []).find(
      (group) => JSON.stringify(baselineGroups.get(group.id)) !== JSON.stringify(group),
    );
    const reference = candidate.exports.find(
      (item) =>
        changedGroup !== undefined &&
        item.module === changedGroup.module &&
        changedGroup.exports.includes(item.name),
    ) ?? {
      module: "curated-externs",
      name: undefined,
    };
    pushChange(
      changes,
      "breaking",
      "NXHX-DRIFT-CURATED-EXTERN-CHANGED",
      reference,
      "Curated Haxe source bytes changed without a corresponding reviewed binding-contract change; inspect the extern diff and strict parity fixture.",
    );
  }

  return sortChanges(changes);
}

function driftDecision(counts) {
  if (counts.breaking > 0 || counts.unsupportedConstruct > 0) {
    return {
      status: "blocked",
      exitCode: 1,
      action:
        "Do not update the baseline. Fix the owning binding and fixture, or add general parser support with regression coverage, then record a reviewed transition.",
    };
  }
  if (counts.additive > 0 || counts.behavioralReviewRequired > 0) {
    return {
      status: "review-required",
      exitCode: 2,
      action:
        "Review each owning binding and fixture, then record the exact from/to IR hashes in acceptedTransitions before updating checked artifacts.",
    };
  }
  if (counts.compatible > 0) {
    return {
      status: "compatible",
      exitCode: 0,
      action:
        "The public signatures are compatible; review the internal-origin move and record the exact transition before refreshing checked artifacts.",
    };
  }
  return {
    status: "clean",
    exitCode: 0,
    action: "No declaration, package, safety, documentation, ownership, or generated-output drift was detected.",
  };
}

function reportIdentity(ir, label) {
  return { path: label, irHash: ir.irHash, nextVersion: ir.packages.next.version };
}

function buildDriftReport(
  baseline,
  candidate,
  baselineLabel = "surface/next-binding-ir.json",
  candidateLabel = "surface/next-binding-ir.json",
  additionalChanges = [],
) {
  const changes = sortChanges([...compareIr(baseline, candidate), ...additionalChanges]);
  const counts = {
    compatible: changes.filter((change) => change.classification === "compatible").length,
    additive: changes.filter((change) => change.classification === "additive").length,
    behavioralReviewRequired: changes.filter(
      (change) => change.classification === "behavioral-review-required",
    ).length,
    breaking: changes.filter((change) => change.classification === "breaking").length,
    unsupportedConstruct: changes.filter(
      (change) => change.classification === "unsupported-construct",
    ).length,
  };
  const base = {
    $schema: "../schemas/next-surface-drift.schema.json",
    protocol: "nextjshx.next-surface-drift",
    version: 1,
    generatedBy: { script: "scripts/bindings/sync-next-bindings.mjs" },
    baseline: reportIdentity(baseline, baselineLabel),
    candidate: reportIdentity(candidate, candidateLabel),
    counts,
    changes,
    decision: driftDecision(counts),
  };
  const report = { ...base, reportHash: sha256(base) };
  validateSchema(report, DRIFT_SCHEMA, "binding drift report");
  return report;
}

function renderDriftMarkdown(report) {
  const lines = [
    "# Next.js binding surface drift",
    "",
    `- Baseline: \`${report.baseline.path}\` (${report.baseline.nextVersion}, \`${report.baseline.irHash}\`)`,
    `- Candidate: \`${report.candidate.path}\` (${report.candidate.nextVersion}, \`${report.candidate.irHash}\`)`,
    `- Decision: **${report.decision.status}** (exit ${report.decision.exitCode})`,
    "",
    "| Classification | Count |",
    "| --- | ---: |",
    `| Breaking | ${report.counts.breaking} |`,
    `| Unsupported construct | ${report.counts.unsupportedConstruct} |`,
    `| Behavioral review required | ${report.counts.behavioralReviewRequired} |`,
    `| Additive | ${report.counts.additive} |`,
    `| Compatible internal move | ${report.counts.compatible} |`,
    "",
  ];
  if (report.changes.length === 0) {
    lines.push("No drift detected.", "");
  } else {
    lines.push("## Changes", "");
    for (const change of report.changes) {
      const symbol = change.export === undefined ? change.module : `${change.module}.${change.export}`;
      lines.push(
        `- **${change.classification}** \`${change.code}\` — \`${symbol}\`: ${change.message} Owner: \`${change.owner}\`; fixture: \`${change.fixture}\`.`,
      );
    }
    lines.push("");
  }
  lines.push("## Required action", "", report.decision.action, "");
  return lines.join("\n");
}

function currentArtifacts(ir, generated) {
  const report = buildDriftReport(ir, ir);
  return {
    ir: jsonBytes(ir),
    extern: generated.size === 1 ? [...generated.values()][0] : undefined,
    report,
    driftJson: jsonBytes(report),
    driftMarkdown: renderDriftMarkdown(report),
  };
}

function atomicWrite(filePath, bytes) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.tmp-${process.pid}-${crypto.randomBytes(8).toString("hex")}`;
  try {
    fs.writeFileSync(temporary, bytes, { encoding: "utf8", flag: "wx", mode: 0o644 });
    fs.renameSync(temporary, filePath);
  } finally {
    fs.rmSync(temporary, { force: true });
  }
}

function sameClassifications(report, transition) {
  const actual = [...new Set(report.changes.map((change) => change.classification))].sort(bytewise);
  const expected = [...transition.classifications].sort(bytewise);
  return JSON.stringify(actual) === JSON.stringify(expected);
}

function assertReviewedTransition(current, candidate, overrides) {
  if (current.irHash === candidate.irHash) {
    return;
  }
  const report = buildDriftReport(
    current,
    candidate,
    "surface/next-binding-ir.json",
    "generated/installed-next-binding-ir.json",
  );
  const accepted = overrides.acceptedTransitions.find(
    (transition) =>
      transition.fromIrHash === current.irHash &&
      transition.toIrHash === candidate.irHash &&
      sameClassifications(report, transition),
  );
  if (accepted === undefined) {
    const classifications = [
      ...new Set(report.changes.map((change) => change.classification)),
    ].sort(bytewise);
    throw new BindingFailure(
      `${renderDriftMarkdown(report)}\nRefusing update without acceptedTransitions entry from ${current.irHash} to ${candidate.irHash} for ${JSON.stringify(classifications)}.`,
    );
  }
}

function assertTransitionChain(overrides, expectedIrHash) {
  let cursor = overrides.bootstrapReview.initialIrHash;
  for (const transition of overrides.acceptedTransitions) {
    if (transition.fromIrHash !== cursor) {
      throw new BindingFailure(
        `acceptedTransitions is not contiguous: expected fromIrHash ${cursor}, found ${transition.fromIrHash}`,
      );
    }
    cursor = transition.toIrHash;
  }
  if (cursor !== expectedIrHash) {
    throw new BindingFailure(
      `review transition chain ends at ${cursor}, but the checked binding IR is ${expectedIrHash}`,
    );
  }
}

function loadInputs(options) {
  const surface = readJson(options.surfacePath);
  const overrides = readJson(options.overridesPath);
  const implementations = readJson(options.implementationsPath);
  validateSchema(surface, SURFACE_SCHEMA, "normalized public surface");
  validateSchema(overrides, OVERRIDES_SCHEMA, "reviewed binding overrides");
  validateSchema(
    implementations,
    IMPLEMENTATIONS_SCHEMA,
    "curated binding implementations",
  );
  const packages = installedPackages(surface);
  return { surface, overrides, implementations, packages };
}

function runProbe(options) {
  const source = ts.createSourceFile(
    options.probePath,
    readText(options.probePath),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const inspected = inspectTypeConstructs(
    source,
    `probe ${path.basename(options.probePath)}`,
    relativeLabel(options.probePath),
  );
  console.log(
    `[next-bindings] probe OK: ${relativeLabel(options.probePath)} uses ${inspected.typeConstructs.join(", ") || "no type constructs"}`,
  );
}

function runDrift(options) {
  const baseline = readJson(options.irPath);
  const candidate = readJson(options.candidatePath);
  validateSchema(baseline, IR_SCHEMA, "baseline binding IR");
  validateSchema(candidate, IR_SCHEMA, "candidate binding IR");
  const report = buildDriftReport(
    baseline,
    candidate,
    "surface/next-binding-ir.json",
    `candidate/${path.basename(options.candidatePath)}`,
  );
  process.stdout.write(
    options.format === "json" ? jsonBytes(report) : renderDriftMarkdown(report),
  );
  process.exitCode = report.decision.exitCode;
}

function runCandidate(options) {
  const surface = readJson(options.surfacePath);
  const baseline = readJson(options.irPath);
  validateSchema(surface, SURFACE_SCHEMA, "candidate normalized public surface");
  validateSchema(baseline, IR_SCHEMA, "baseline binding IR");
  const packages = installedPackages(surface, options.nextPackageRoot);
  const candidateProjection = buildCandidateIR(surface, baseline, packages);
  const candidate = candidateProjection.ir;
  const report = buildDriftReport(
    baseline,
    candidate,
    "surface/next-binding-ir.json",
    `candidate/next-${packages.next.version}-binding-ir.json`,
    candidateProjection.additionalChanges,
  );
  process.stdout.write(
    options.format === "json" ? jsonBytes(report) : renderDriftMarkdown(report),
  );
  process.exitCode = report.decision.exitCode;
}

function runGeneration(options) {
  const { surface, overrides, implementations, packages } = loadInputs(options);
  const built = buildBindingIR(surface, overrides, implementations, packages);
  const artifacts = currentArtifacts(built.ir, built.generated);

  if (options.mode === "render") {
    if (options.artifact === "ir") {
      process.stdout.write(artifacts.ir);
    } else if (options.artifact === "extern") {
      if (artifacts.extern === undefined) {
        throw new BindingFailure("extern rendering requires exactly one configured generator");
      }
      process.stdout.write(artifacts.extern);
    } else if (options.artifact === "drift-json") {
      process.stdout.write(artifacts.driftJson);
    } else {
      process.stdout.write(artifacts.driftMarkdown);
    }
    return;
  }

  if (options.mode === "update") {
    if (/^(?:1|true)$/i.test(process.env.CI ?? "")) {
      throw new BindingFailure("binding updates are disabled in CI");
    }
    if (fs.existsSync(options.irPath)) {
      const current = readJson(options.irPath);
      validateSchema(current, IR_SCHEMA, "checked binding IR");
      assertReviewedTransition(current, built.ir, overrides);
    } else if (
      overrides.bootstrapReview.bead !== "nxhx-f34.3.2" ||
      overrides.reviewedSurfaceHash !== surface.surfaceHash ||
      overrides.bootstrapReview.initialIrHash !== built.ir.irHash
    ) {
      throw new BindingFailure(
        "initial binding IR creation requires the nxhx-f34.3.2 bootstrap review pinned to this surface and exact initial IR hash",
      );
    }
    assertTransitionChain(overrides, built.ir.irHash);
    atomicWrite(options.irPath, artifacts.ir);
    for (const [output, bytes] of built.generated) {
      atomicWrite(path.join(ROOT, ...output.split("/")), bytes);
    }
    atomicWrite(options.driftJsonPath, artifacts.driftJson);
    atomicWrite(options.driftMarkdownPath, artifacts.driftMarkdown);
    console.log(
      `[next-bindings] updated ${relativeLabel(options.irPath)}, ${built.generated.size} generated Haxe extern(s), and drift reports for Next ${packages.next.version}`,
    );
    return;
  }

  const checkedIr = readJson(options.irPath);
  validateSchema(checkedIr, IR_SCHEMA, "checked binding IR");
  assertIrHash(checkedIr, "checked binding IR");
  assertTransitionChain(overrides, checkedIr.irHash);
  if (jsonBytes(checkedIr) !== artifacts.ir) {
    const report = buildDriftReport(
      checkedIr,
      built.ir,
      "surface/next-binding-ir.json",
      "generated/installed-next-binding-ir.json",
    );
    throw new BindingFailure(
      `${renderDriftMarkdown(report)}\nChecked binding IR is stale; review the report and run npm run bindings:next:update only after recording the exact transition.`,
    );
  }
  for (const [output, bytes] of built.generated) {
    const outputPath = path.join(ROOT, ...output.split("/"));
    if (readText(outputPath) !== bytes) {
      throw new BindingFailure(`${output} is stale; review and run npm run bindings:next:update`);
    }
  }
  if (readText(options.driftJsonPath) !== artifacts.driftJson) {
    throw new BindingFailure(`${relativeLabel(options.driftJsonPath)} is stale`);
  }
  if (readText(options.driftMarkdownPath) !== artifacts.driftMarkdown) {
    throw new BindingFailure(`${relativeLabel(options.driftMarkdownPath)} is stale`);
  }
  console.log(
    `[next-bindings] OK: Next ${packages.next.version}, ${built.ir.exports.length} ingested exports, ${built.generated.size} generated Haxe extern(s), no drift`,
  );
}

try {
  const options = parseArguments(process.argv.slice(2));
  if (options.mode === "probe") {
    runProbe(options);
  } else if (options.mode === "candidate") {
    runCandidate(options);
  } else if (options.mode === "drift") {
    runDrift(options);
  } else {
    runGeneration(options);
  }
} catch (error) {
  if (error instanceof UnsupportedConstructFailure) {
    console.error(`[next-bindings] UNSUPPORTED: ${error.message}`);
  } else {
    console.error(`[next-bindings] ERROR: ${error.message}`);
  }
  process.exitCode = 1;
}
