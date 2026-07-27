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
const DEFAULT_CONFIG = path.join(ROOT, "config/next-public-entrypoints.json");
const DEFAULT_FIXTURES = path.join(ROOT, "tests/next-surface/fixtures.json");
const DEFAULT_MANIFEST = path.join(ROOT, "surface/next-public-surface.json");
const CONFIG_SCHEMA = path.join(ROOT, "schemas/next-public-entrypoints.schema.json");
const FIXTURE_SCHEMA = path.join(ROOT, "schemas/next-surface-fixtures.schema.json");
const MANIFEST_SCHEMA = path.join(ROOT, "schemas/next-public-surface.schema.json");
const REQUIRE = createRequire(import.meta.url);
const PRIORITY_RANK = new Map([
  ["P0", 0],
  ["P1", 1],
  ["P2", 2],
]);
const EXPECTED_ENTRYPOINT_PRIORITIES = new Map([
  ["next", "P0"],
  ["next/types", "P0"],
  ["next/link", "P0"],
  ["next/image", "P0"],
  ["next/form", "P0"],
  ["next/navigation", "P0"],
  ["next/headers", "P0"],
  ["next/cache", "P0"],
  ["next/server", "P0"],
  ["globalThis", "P0"],
  ["next/dynamic", "P1"],
  ["next/script", "P1"],
  ["next/font/google", "P1"],
  ["next/font/local", "P1"],
  ["next/og", "P2"],
  ["next/web-vitals", "P2"],
  ["next/compat/router", "P2"],
]);
const EXPECTED_EXCLUSIONS = new Map([
  ["next/router", "legacy"],
  ["next/experimental/*", "experimental"],
]);

class SurfaceFailure extends Error {}

function bytewise(left, right) {
  return Buffer.compare(Buffer.from(left), Buffer.from(right));
}

function relativeLabel(filePath) {
  const relative = path.relative(ROOT, filePath).split(path.sep).join("/");
  return relative.startsWith("../") ? filePath : relative;
}

function readText(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch (error) {
    throw new SurfaceFailure(`cannot read ${relativeLabel(filePath)}: ${error.message}`);
  }
}

function readJson(filePath) {
  try {
    return JSON.parse(readText(filePath));
  } catch (error) {
    if (error instanceof SurfaceFailure) {
      throw error;
    }
    throw new SurfaceFailure(`invalid JSON in ${relativeLabel(filePath)}: ${error.message}`);
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
    throw new SurfaceFailure(`${label} violates its closed schema: ${formatAjvErrors(validate.errors)}`);
  }
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
  const source = typeof value === "string" ? value : JSON.stringify(canonicalValue(value));
  return `sha256:${crypto.createHash("sha256").update(source, "utf8").digest("hex")}`;
}

function jsonBytes(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function parseArguments(argv) {
  const mode = argv[0] ?? "check";
  if (!new Set(["candidate", "check", "render", "update"]).has(mode)) {
    throw new SurfaceFailure(
      `unknown mode ${mode}; expected candidate, check, render, or update`,
    );
  }
  const options = {
    mode,
    configPath: DEFAULT_CONFIG,
    fixturesPath: DEFAULT_FIXTURES,
    manifestPath: DEFAULT_MANIFEST,
    nextPackageRoot: undefined,
  };
  for (let index = 1; index < argv.length; index += 1) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (
      !new Set(["--config", "--fixtures", "--manifest", "--next-package-root"]).has(flag) ||
      value === undefined
    ) {
      throw new SurfaceFailure(`unknown or incomplete option ${flag}`);
    }
    const absolute = path.resolve(ROOT, value);
    if (flag === "--config") {
      options.configPath = absolute;
    } else if (flag === "--fixtures") {
      options.fixturesPath = absolute;
    } else if (flag === "--next-package-root") {
      options.nextPackageRoot = absolute;
    } else {
      options.manifestPath = absolute;
    }
    index += 1;
  }
  if (mode === "candidate" && options.nextPackageRoot === undefined) {
    throw new SurfaceFailure("candidate mode requires --next-package-root <directory>");
  }
  if (mode !== "candidate" && options.nextPackageRoot !== undefined) {
    throw new SurfaceFailure("--next-package-root is available only in candidate mode");
  }
  return options;
}

function uniqueMap(items, keyOf, label) {
  const result = new Map();
  for (const item of items) {
    const key = keyOf(item);
    if (result.has(key)) {
      throw new SurfaceFailure(`${label} contains duplicate ${key}`);
    }
    result.set(key, item);
  }
  return result;
}

function sortedEntrypoints(entrypoints) {
  return [...entrypoints].sort((left, right) => {
    const priority = PRIORITY_RANK.get(left.priority) - PRIORITY_RANK.get(right.priority);
    return priority === 0 ? bytewise(left.module, right.module) : priority;
  });
}

function sortedExports(exports) {
  return [...exports].sort((left, right) => bytewise(left.name, right.name));
}

function assertPriorityContract(config) {
  const entries = uniqueMap(config.entrypoints, (entry) => entry.module, "entrypoint allowlist");
  const missing = [...EXPECTED_ENTRYPOINT_PRIORITIES].filter(([module]) => !entries.has(module));
  const extra = [...entries].filter(([module]) => !EXPECTED_ENTRYPOINT_PRIORITIES.has(module));
  if (missing.length > 0 || extra.length > 0) {
    throw new SurfaceFailure(
      `P0/P1/P2 modules drifted from PRD 10.1; missing=${missing.map(([name]) => name).join(",") || "none"}; extra=${extra.map(([name]) => name).join(",") || "none"}`,
    );
  }
  for (const [module, expected] of EXPECTED_ENTRYPOINT_PRIORITIES) {
    const actual = entries.get(module).priority;
    if (actual !== expected) {
      throw new SurfaceFailure(`${module} must remain ${expected} per PRD 10.1, found ${actual}`);
    }
  }
  for (const entrypoint of config.entrypoints) {
    uniqueMap(entrypoint.exports, (entry) => entry.name, `${entrypoint.module} exports`);
    if (entrypoint.module === "globalThis" && entrypoint.source.kind !== "global") {
      throw new SurfaceFailure("globalThis must resolve through the pinned TypeScript DOM library");
    }
    if (entrypoint.module !== "globalThis" && entrypoint.source.kind !== "module") {
      throw new SurfaceFailure(`${entrypoint.module} must resolve as a public package module`);
    }
  }

  const exclusions = uniqueMap(
    config.excludedEntrypoints,
    (entry) => entry.module,
    "excluded entrypoints",
  );
  if (exclusions.size !== EXPECTED_EXCLUSIONS.size) {
    throw new SurfaceFailure("P3 exclusions must remain next/router and next/experimental/*");
  }
  for (const [module, stability] of EXPECTED_EXCLUSIONS) {
    const exclusion = exclusions.get(module);
    if (exclusion?.priority !== "P3" || exclusion?.stability !== stability) {
      throw new SurfaceFailure(`${module} must remain an explicitly excluded P3 ${stability} surface`);
    }
  }
}

function assertFixtureContract(config, catalog) {
  const fixtures = uniqueMap(catalog.fixtures, (fixture) => fixture.id, "surface fixtures");

  const referencedModules = new Set();
  for (const entrypoint of config.entrypoints) {
    const [fixturePath, fixtureId, extra] = entrypoint.fixture.split("#");
    if (
      fixturePath !== "tests/next-surface/fixtures.json" ||
      fixtureId === undefined ||
      extra !== undefined
    ) {
      throw new SurfaceFailure(`${entrypoint.module} has an unsupported fixture reference`);
    }
    const fixture = fixtures.get(fixtureId);
    if (fixture === undefined) {
      throw new SurfaceFailure(`${entrypoint.module} references unknown fixture ${fixtureId}`);
    }
    if (fixture.priority !== entrypoint.priority || !fixture.modules.includes(entrypoint.module)) {
      throw new SurfaceFailure(
        `${entrypoint.module} fixture ${fixtureId} does not prove its ${entrypoint.priority} declaration surface`,
      );
    }
    referencedModules.add(entrypoint.module);
  }

  const allowlisted = new Set(config.entrypoints.map((entrypoint) => entrypoint.module));
  for (const fixture of catalog.fixtures) {
    const sortedModules = [...fixture.modules].sort(bytewise);
    if (JSON.stringify(fixture.modules) !== JSON.stringify(sortedModules)) {
      throw new SurfaceFailure(`fixture ${fixture.id} modules must be bytewise sorted`);
    }
    for (const module of fixture.modules) {
      if (!allowlisted.has(module)) {
        throw new SurfaceFailure(`fixture ${fixture.id} names non-allowlisted module ${module}`);
      }
      if (!referencedModules.has(module)) {
        throw new SurfaceFailure(`fixture ${fixture.id} module ${module} is not referenced`);
      }
    }
  }
}

function installedPackages(config, explicitNextRoot = undefined) {
  let nextPackagePath;
  if (explicitNextRoot === undefined) {
    nextPackagePath = REQUIRE.resolve("next/package.json");
  } else {
    let realRoot;
    try {
      realRoot = fs.realpathSync.native(explicitNextRoot);
    } catch (error) {
      throw new SurfaceFailure(`cannot resolve explicit Next package root: ${error.message}`);
    }
    if (!fs.statSync(realRoot).isDirectory()) {
      throw new SurfaceFailure("explicit Next package root is not a directory");
    }
    nextPackagePath = path.join(realRoot, "package.json");
  }
  const typescriptPackagePath = REQUIRE.resolve("typescript/package.json");
  const nextPackage = readJson(nextPackagePath);
  const typescriptPackage = readJson(typescriptPackagePath);
  const expectedNext = config.packages.next;
  const expectedTypeScript = config.packages.typescript;
  if (
    nextPackage.name !== expectedNext.name ||
    (explicitNextRoot === undefined && nextPackage.version !== expectedNext.version)
  ) {
    throw new SurfaceFailure(
      `installed next identity is ${nextPackage.name}@${nextPackage.version}; allowlist requires ${expectedNext.name}@${expectedNext.version}`,
    );
  }
  if (
    typescriptPackage.name !== expectedTypeScript.name ||
    typescriptPackage.version !== expectedTypeScript.version ||
    ts.version !== expectedTypeScript.version
  ) {
    throw new SurfaceFailure(
      `installed TypeScript identity is ${typescriptPackage.name}@${typescriptPackage.version} with compiler ${ts.version}; allowlist requires ${expectedTypeScript.name}@${expectedTypeScript.version}`,
    );
  }
  return {
    next: {
      name: nextPackage.name,
      version: nextPackage.version,
      root: fs.realpathSync.native(path.dirname(nextPackagePath)),
      explicit: explicitNextRoot !== undefined,
    },
    typescript: {
      importName: expectedTypeScript.importName,
      name: typescriptPackage.name,
      version: typescriptPackage.version,
      root: fs.realpathSync.native(path.dirname(typescriptPackagePath)),
      libRoot: fs.realpathSync.native(
        path.dirname(ts.getDefaultLibFilePath({ target: ts.ScriptTarget.ES2022 })),
      ),
    },
  };
}

function compilerOptions() {
  return {
    allowJs: false,
    baseUrl: ROOT,
    jsx: ts.JsxEmit.ReactJSX,
    lib: ["lib.es2022.d.ts", "lib.dom.d.ts", "lib.dom.iterable.d.ts"],
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    noEmit: true,
    paths: {
      react: [path.join(ROOT, "node_modules/@types/react/index.d.ts")],
      "react/*": [path.join(ROOT, "node_modules/@types/react/*")],
      "react-dom": [path.join(ROOT, "node_modules/@types/react-dom/index.d.ts")],
      "react-dom/*": [path.join(ROOT, "node_modules/@types/react-dom/*")],
    },
    skipLibCheck: true,
    strict: true,
    target: ts.ScriptTarget.ES2022,
    types: ["node", "react", "react-dom"],
  };
}

function explicitEntrypointDeclaration(moduleName, packageRoot, allowMissing) {
  const relative = moduleName === "next" ? "index" : moduleName.slice("next/".length);
  const base = path.join(packageRoot, ...relative.split("/"));
  const candidates = [
    `${base}.d.ts`,
    `${base}.d.mts`,
    `${base}.d.cts`,
    path.join(base, "index.d.ts"),
    path.join(base, "index.d.mts"),
    path.join(base, "index.d.cts"),
  ];
  for (const candidate of candidates) {
    if (!fs.existsSync(candidate) || !fs.statSync(candidate).isFile()) {
      continue;
    }
    const resolved = fs.realpathSync.native(candidate);
    if (!insideRoot(resolved, packageRoot)) {
      throw new SurfaceFailure(`${moduleName} declaration escaped the explicit Next package root`);
    }
    return resolved;
  }
  if (allowMissing) {
    return undefined;
  }
  throw new SurfaceFailure(`${moduleName} has no declaration entrypoint under the explicit Next package root`);
}

function resolveEntrypoints(config, packages, allowMissing) {
  const options = compilerOptions();
  const host = ts.createCompilerHost(options, true);
  const containingFile = path.join(ROOT, "__nextjshx_surface__.ts");
  const resolutions = new Map();
  const rootNames = [];
  for (const entrypoint of config.entrypoints) {
    if (entrypoint.source.kind !== "module") {
      continue;
    }
    let resolvedFile;
    if (packages.next.explicit) {
      resolvedFile = explicitEntrypointDeclaration(
        entrypoint.module,
        packages.next.root,
        allowMissing,
      );
    } else {
      const resolved = ts.resolveModuleName(entrypoint.module, containingFile, options, host)
        .resolvedModule;
      if (resolved === undefined || !/\.d\.(?:ts|mts|cts)$/.test(resolved.resolvedFileName)) {
        throw new SurfaceFailure(`${entrypoint.module} did not resolve to a declaration entrypoint`);
      }
      resolvedFile = fs.realpathSync.native(resolved.resolvedFileName);
    }
    resolutions.set(entrypoint.module, resolvedFile);
    if (resolvedFile !== undefined) {
      rootNames.push(resolvedFile);
    }
  }
  const program = ts.createProgram([...new Set(rootNames)].sort(bytewise), options, host);
  return { program, resolutions };
}

function insideRoot(filePath, root) {
  const relative = path.relative(root, filePath);
  return relative !== "" && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

function packageOrigin(fileName, packages) {
  const filePath = fs.realpathSync.native(fileName);
  if (insideRoot(filePath, packages.typescript.libRoot)) {
    return {
      package: packages.typescript.name,
      path: `lib/${path.relative(packages.typescript.libRoot, filePath).split(path.sep).join("/")}`,
    };
  }
  for (const packageInfo of [packages.next, packages.typescript]) {
    if (insideRoot(filePath, packageInfo.root)) {
      return {
        package: packageInfo.name,
        path: path.relative(packageInfo.root, filePath).split(path.sep).join("/"),
      };
    }
  }
  throw new SurfaceFailure(`selected declaration escaped the reviewed packages: ${fileName}`);
}

function sourceFileByRealPath(program, expectedPath) {
  const expected = fs.realpathSync.native(expectedPath);
  return program.getSourceFiles().find((sourceFile) => {
    try {
      return fs.realpathSync.native(sourceFile.fileName) === expected;
    } catch {
      return false;
    }
  });
}

function resolveAlias(checker, symbol, label) {
  let current = symbol;
  const seen = new Set();
  while ((current.flags & ts.SymbolFlags.Alias) !== 0) {
    if (seen.has(current)) {
      throw new SurfaceFailure(`${label} contains an alias cycle`);
    }
    seen.add(current);
    const target = checker.getAliasedSymbol(current);
    if (target === current || (target.flags & ts.SymbolFlags.Unknown) !== 0) {
      throw new SurfaceFailure(`${label} alias could not be resolved`);
    }
    current = target;
  }
  return current;
}

function symbolIsCallable(checker, symbol) {
  const declaration = symbol.valueDeclaration ?? symbol.declarations?.[0];
  if (declaration === undefined) {
    return false;
  }
  try {
    return checker.getSignaturesOfType(
      checker.getTypeOfSymbolAtLocation(symbol, declaration),
      ts.SignatureKind.Call,
    ).length > 0;
  } catch {
    return false;
  }
}

function resolvedExportKind(checker, symbol, configuredKind, label, allowKindDrift) {
  const kinds = new Set((symbol.declarations ?? []).map((declaration) => declaration.kind));
  const callable = symbolIsCallable(checker, symbol);
  const isType = kinds.has(ts.SyntaxKind.InterfaceDeclaration) || kinds.has(ts.SyntaxKind.TypeAliasDeclaration);
  const isClass = kinds.has(ts.SyntaxKind.ClassDeclaration);
  const isFunction = kinds.has(ts.SyntaxKind.FunctionDeclaration) || callable;
  const isValue = kinds.has(ts.SyntaxKind.VariableDeclaration) || kinds.has(ts.SyntaxKind.EnumDeclaration);
  const matches =
    (configuredKind === "type" && isType) ||
    (configuredKind === "class" && isClass) ||
    (configuredKind === "function" && isFunction) ||
    (configuredKind === "component" && (isFunction || isClass)) ||
    (configuredKind === "value" && isValue);
  if (!matches) {
    const actual = [...kinds].map((kind) => ts.SyntaxKind[kind]).sort(bytewise).join(", ");
    if (!allowKindDrift) {
      throw new SurfaceFailure(
        `${label} is configured as ${configuredKind} but resolves as ${actual || "unknown"}`,
      );
    }
    if (isType) {
      return "type";
    }
    if (isClass) {
      return "class";
    }
    if (isFunction) {
      return "function";
    }
    if (isValue) {
      return "value";
    }
    throw new SurfaceFailure(`${label} resolves as an unsupported export kind ${actual || "unknown"}`);
  }
  return configuredKind;
}

function normalizeDeclarationText(printer, declaration) {
  const sourceFile = declaration.getSourceFile();
  return printer
    .printNode(ts.EmitHint.Unspecified, declaration, sourceFile)
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+$/gm, "")
    .trim();
}

function declarationName(declaration, fallback) {
  if ("name" in declaration && declaration.name !== undefined) {
    return declaration.name.getText(declaration.getSourceFile()).replace(/\s+/g, " ");
  }
  return fallback;
}

function declarationOrigins(symbol, packages, printer, requiredSourceFile = undefined) {
  const declarations = (symbol.declarations ?? []).filter(
    (declaration) =>
      requiredSourceFile === undefined || declaration.getSourceFile() === requiredSourceFile,
  );
  if (declarations.length === 0) {
    throw new SurfaceFailure(`${symbol.getName()} has no declaration nodes to inventory`);
  }
  return declarations.map((declaration) => {
    const origin = packageOrigin(declaration.getSourceFile().fileName, packages);
    const syntaxKind = ts.SyntaxKind[declaration.kind];
    const declaredName = declarationName(declaration, symbol.getName());
    const text = normalizeDeclarationText(printer, declaration);
    return {
      ...origin,
      syntaxKind,
      declaredName,
      declarationHash: sha256({ syntaxKind, declaredName, text }),
      internal: origin.package === "next" && origin.path.startsWith("dist/"),
    };
  });
}

function exportSignatureHash(configuredExport, declarations) {
  return sha256({
    name: configuredExport.name,
    kind: configuredExport.kind,
    declarations: declarations.map((declaration) => declaration.declarationHash),
  });
}

function entrypointSource(checker, program, resolutions, entrypoint, packages) {
  if (entrypoint.source.kind === "module") {
    const resolvedFile = resolutions.get(entrypoint.module);
    if (resolvedFile === undefined) {
      return {
        sourceFile: undefined,
        origin: undefined,
        getSymbol() {
          return undefined;
        },
      };
    }
    const sourceFile = sourceFileByRealPath(program, resolvedFile);
    if (sourceFile === undefined) {
      throw new SurfaceFailure(`${entrypoint.module} declaration source was not loaded`);
    }
    const moduleSymbol = checker.getSymbolAtLocation(sourceFile);
    if (moduleSymbol === undefined) {
      throw new SurfaceFailure(`${entrypoint.module} has no module symbol`);
    }
    const exports = uniqueMap(
      checker.getExportsOfModule(moduleSymbol),
      (symbol) => symbol.getName(),
      `${entrypoint.module} resolved exports`,
    );
    return {
      sourceFile,
      origin: packageOrigin(sourceFile.fileName, packages),
      getSymbol(name, allowMissing = false) {
        const symbol = exports.get(name);
        if (symbol === undefined) {
          if (allowMissing) {
            return undefined;
          }
          throw new SurfaceFailure(`${entrypoint.module} does not export ${name}`);
        }
        return resolveAlias(checker, symbol, `${entrypoint.module}.${name}`);
      },
    };
  }

  const libraryPath = path.join(packages.typescript.libRoot, entrypoint.source.library);
  const sourceFile = sourceFileByRealPath(program, libraryPath);
  if (sourceFile === undefined) {
    throw new SurfaceFailure(`TypeScript did not load ${entrypoint.source.library}`);
  }
  return {
    sourceFile,
    origin: packageOrigin(sourceFile.fileName, packages),
    getSymbol(name, allowMissing = false) {
      const symbol = checker.resolveName(name, sourceFile, ts.SymbolFlags.Type, false);
      if (symbol === undefined) {
        if (allowMissing) {
          return undefined;
        }
        throw new SurfaceFailure(`${entrypoint.module} does not define global type ${name}`);
      }
      return resolveAlias(checker, symbol, `${entrypoint.module}.${name}`);
    },
  };
}

function buildInventory(config, catalog, packages, { allowKindDrift = false } = {}) {
  const { program, resolutions } = resolveEntrypoints(config, packages, allowKindDrift);
  const checker = program.getTypeChecker();
  const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed, removeComments: true });
  const actualHashes = new Map();
  const internal = new Map();
  const publicEntrypoints = [];

  for (const entrypoint of sortedEntrypoints(config.entrypoints)) {
    const resolved = entrypointSource(checker, program, resolutions, entrypoint, packages);
    const exports = [];
    for (const configuredExport of sortedExports(entrypoint.exports)) {
      const label = `${entrypoint.module}.${configuredExport.name}`;
      const symbol = resolved.getSymbol(configuredExport.name, allowKindDrift);
      if (symbol === undefined) {
        continue;
      }
      const kind = resolvedExportKind(
        checker,
        symbol,
        configuredExport.kind,
        label,
        allowKindDrift,
      );
      const declarations = declarationOrigins(
        symbol,
        packages,
        printer,
        entrypoint.source.kind === "global" ? resolved.sourceFile : undefined,
      );
      const signatureHash = exportSignatureHash({ ...configuredExport, kind }, declarations);
      actualHashes.set(label, signatureHash);
      const publicExport = {
        name: configuredExport.name,
        kind,
        stability: configuredExport.stability,
        signatureHash,
        haxeTypePath: configuredExport.haxeTypePath,
      };
      if (configuredExport.haxeMember !== undefined) {
        publicExport.haxeMember = configuredExport.haxeMember;
      }
      publicExport.exposure = configuredExport.exposure;
      publicExport.declarations = declarations;
      exports.push(publicExport);

      for (const declaration of declarations.filter((candidate) => candidate.internal)) {
        const key = [
          declaration.package,
          declaration.path,
          declaration.syntaxKind,
          declaration.declaredName,
          declaration.declarationHash,
        ].join("\0");
        let supporting = internal.get(key);
        if (supporting === undefined) {
          supporting = {
            package: declaration.package,
            path: declaration.path,
            syntaxKind: declaration.syntaxKind,
            declaredName: declaration.declaredName,
            declarationHash: declaration.declarationHash,
            compatibilityPromise: false,
            runtimeImportAllowed: false,
            supports: [],
          };
          internal.set(key, supporting);
        }
        supporting.supports.push({ module: entrypoint.module, export: configuredExport.name });
      }
    }
    const publicEntrypoint = {
      module: entrypoint.module,
      source: entrypoint.source,
      priority: entrypoint.priority,
      fixture: entrypoint.fixture,
      selectionRationale: entrypoint.selectionRationale,
      ...(resolved.origin === undefined ? {} : { entrypointDeclaration: resolved.origin }),
      exports,
    };
    publicEntrypoints.push(publicEntrypoint);
  }

  const internalSupportingDeclarations = [...internal.values()]
    .map((declaration) => ({
      ...declaration,
      supports: declaration.supports.sort((left, right) => {
        const moduleOrder = bytewise(left.module, right.module);
        return moduleOrder === 0 ? bytewise(left.export, right.export) : moduleOrder;
      }),
    }))
    .sort((left, right) =>
      bytewise(
        `${left.path}\0${left.syntaxKind}\0${left.declaredName}\0${left.declarationHash}`,
        `${right.path}\0${right.syntaxKind}\0${right.declaredName}\0${right.declarationHash}`,
      ),
    );

  const baseManifest = {
    $schema: "../schemas/next-public-surface.schema.json",
    protocol: "nextjshx.next-public-surface",
    version: 1,
    generatedBy: {
      script: "scripts/bindings/next-surface.mjs",
      typescriptVersion: packages.typescript.version,
    },
    sources: {
      allowlist: "config/next-public-entrypoints.json",
      fixtures: "tests/next-surface/fixtures.json",
      packages: {
        next: { name: packages.next.name, version: packages.next.version },
        typescript: {
          importName: packages.typescript.importName,
          name: packages.typescript.name,
          version: packages.typescript.version,
        },
      },
    },
    publicEntrypoints,
    internalSupportingDeclarations,
    excludedEntrypoints: [...config.excludedEntrypoints].sort((left, right) =>
      bytewise(left.module, right.module),
    ),
  };
  const manifest = { ...baseManifest, surfaceHash: sha256(baseManifest) };
  validateSchema(manifest, MANIFEST_SCHEMA, "normalized surface manifest");
  return { manifest, actualHashes };
}

function assertExpectedHashes(config, actualHashes) {
  for (const entrypoint of config.entrypoints) {
    for (const configuredExport of entrypoint.exports) {
      const label = `${entrypoint.module}.${configuredExport.name}`;
      const actual = actualHashes.get(label);
      if (actual !== configuredExport.signatureHash) {
        throw new SurfaceFailure(
          `${label} signature drifted: expected ${configuredExport.signatureHash}, found ${actual}; review the declaration and run npm run surface:next:update`,
        );
      }
    }
  }
}

function updatedConfig(config, actualHashes) {
  const updated = structuredClone(config);
  for (const entrypoint of updated.entrypoints) {
    for (const configuredExport of entrypoint.exports) {
      configuredExport.signatureHash = actualHashes.get(
        `${entrypoint.module}.${configuredExport.name}`,
      );
    }
  }
  validateSchema(updated, CONFIG_SCHEMA, "updated entrypoint allowlist");
  return updated;
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

function run(options) {
  const config = readJson(options.configPath);
  const catalog = readJson(options.fixturesPath);
  validateSchema(config, CONFIG_SCHEMA, "entrypoint allowlist");
  validateSchema(catalog, FIXTURE_SCHEMA, "surface fixture catalog");
  assertPriorityContract(config);
  assertFixtureContract(config, catalog);
  const packages = installedPackages(config, options.nextPackageRoot);
  const { manifest, actualHashes } = buildInventory(config, catalog, packages, {
    allowKindDrift: options.mode === "candidate",
  });

  if (options.mode === "candidate") {
    process.stdout.write(jsonBytes(manifest));
    return;
  }

  if (options.mode === "render") {
    assertExpectedHashes(config, actualHashes);
    process.stdout.write(jsonBytes(manifest));
    return;
  }

  if (options.mode === "update") {
    if (/^(?:1|true)$/i.test(process.env.CI ?? "")) {
      throw new SurfaceFailure("surface updates are disabled in CI");
    }
    const nextConfig = updatedConfig(config, actualHashes);
    atomicWrite(options.configPath, jsonBytes(nextConfig));
    atomicWrite(options.manifestPath, jsonBytes(manifest));
    console.log(
      `[next-surface] updated ${relativeLabel(options.configPath)} and ${relativeLabel(options.manifestPath)}`,
    );
    return;
  }

  assertExpectedHashes(config, actualHashes);
  const expected = jsonBytes(manifest);
  const current = readText(options.manifestPath);
  if (current !== expected) {
    throw new SurfaceFailure(
      `${relativeLabel(options.manifestPath)} is stale; review drift and run npm run surface:next:update`,
    );
  }
  const exportCount = manifest.publicEntrypoints.reduce(
    (total, entrypoint) => total + entrypoint.exports.length,
    0,
  );
  console.log(
    `[next-surface] OK: ${manifest.publicEntrypoints.length} entrypoints, ${exportCount} exports, ${manifest.internalSupportingDeclarations.length} internal declaration origins`,
  );
}

try {
  run(parseArguments(process.argv.slice(2)));
} catch (error) {
  console.error(`[next-surface] ERROR: ${error.message}`);
  process.exitCode = 1;
}
