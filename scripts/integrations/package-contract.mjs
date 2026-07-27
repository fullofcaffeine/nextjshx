import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

import Ajv2020 from "ajv/dist/2020.js";
import ts from "typescript";

const DEPENDENCY_FIELDS = [
  "dependencies",
  "devDependencies",
  "optionalDependencies",
  "peerDependencies",
];

const ORDERED_ARRAY_FIELDS = [
  "categories",
  "declaredBy",
  "evidence",
  "haxeSources",
  "nativeSources",
  "strategies",
];

const HAXE_FORBIDDEN = [
  ["Dynamic", /\bDynamic\b/],
  ["Any", /\bAny\b/],
  ["untyped", /\buntyped\b/],
  ["cast", /\bcast\b/],
  ["Reflect", /\bReflect\b/],
  ["broad Unknown", /\bUnknown\b/],
];

const NATIVE_FORBIDDEN = [
  ["TypeScript suppression", /@ts-(?:ignore|nocheck)/],
];

export class PackageIntegrationFailure extends Error {}

function fail(code, message) {
  throw new PackageIntegrationFailure(`[${code}] ${message}`);
}

function readJson(file, label) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    fail("NXHX-INTEGRATION-IO-0001", `cannot read ${label}: ${error.message}`);
  }
}

function normalizedRepository(value) {
  const raw = typeof value === "string" ? value : value?.url;
  if (typeof raw !== "string") {
    return null;
  }
  const normalized = raw
    .replace(/^git\+/, "")
    .replace(/^git:\/\/github\.com\//, "https://github.com/")
    .replace(/\.git$/, "");
  return /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(normalized)
    ? `https://github.com/${normalized}`
    : normalized;
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function sortedCopy(values) {
  return [...values].sort((left, right) => left.localeCompare(right, "en"));
}

function requireSorted(values, label) {
  if (JSON.stringify(values) !== JSON.stringify(sortedCopy(values))) {
    fail("NXHX-INTEGRATION-ORDER-0002", `${label} must use canonical lexical ordering`);
  }
}

function resolveProjectFile(root, relative, label) {
  const resolved = path.resolve(root, relative);
  const fromRoot = path.relative(root, resolved);
  if (fromRoot === "" || fromRoot.startsWith(`..${path.sep}`) || path.isAbsolute(fromRoot)) {
    fail("NXHX-INTEGRATION-PATH-0003", `${label} escapes the repository root: ${relative}`);
  }
  let stat;
  try {
    stat = fs.lstatSync(resolved);
  } catch (error) {
    fail("NXHX-INTEGRATION-PATH-0003", `${label} does not exist: ${relative}`);
  }
  if (!stat.isFile() || stat.isSymbolicLink()) {
    fail("NXHX-INTEGRATION-PATH-0003", `${label} must be one regular non-symlink file: ${relative}`);
  }
  return resolved;
}

function packageRoot(root, packageName) {
  const containingFile = path.join(root, ".nextjshx-package-integration-oracle.ts");
  const resolved = ts.resolveModuleName(
    packageName,
    containingFile,
    {
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
    },
    ts.sys,
  ).resolvedModule?.resolvedFileName;
  let cursor;
  if (resolved !== undefined) {
    cursor = path.dirname(resolved);
  } else {
    const projectRequire = createRequire(path.join(root, "package.json"));
    try {
      cursor = path.dirname(projectRequire.resolve(packageName));
    } catch (error) {
      fail(
        "NXHX-INTEGRATION-PACKAGE-0004",
        `cannot resolve installed package ${packageName}: ${error.message}`,
      );
    }
  }

  while (cursor !== path.dirname(cursor)) {
    const candidate = path.join(cursor, "package.json");
    if (fs.existsSync(candidate)) {
      const manifest = readJson(candidate, `${packageName} package manifest`);
      if (manifest.name === packageName) {
        return { directory: cursor, manifest };
      }
    }
    cursor = path.dirname(cursor);
  }
  return fail(
    "NXHX-INTEGRATION-PACKAGE-0004",
    `resolved ${packageName}, but could not find its owning package manifest`,
  );
}

function typesPathFromExport(entry) {
  if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
    return null;
  }
  if (entry.import !== undefined) {
    const imported = typesPathFromExport(entry.import);
    if (imported !== null) {
      return imported;
    }
  }
  if (typeof entry.types === "string") {
    return entry.types;
  }
  if (entry.default !== undefined) {
    const fallback = typesPathFromExport(entry.default);
    if (fallback !== null) {
      return fallback;
    }
  }
  if (entry.require !== undefined) {
    return typesPathFromExport(entry.require);
  }
  return null;
}

function publicDeclaration(packageManifest, packageName, specifier, packageDirectory) {
  if (specifier !== packageName && !specifier.startsWith(`${packageName}/`)) {
    fail(
      "NXHX-INTEGRATION-MODULE-0005",
      `${specifier} is not an export of configured package ${packageName}`,
    );
  }
  const subpath = specifier === packageName ? "." : `./${specifier.slice(packageName.length + 1)}`;
  const exportsValue = packageManifest.exports;
  let declaration = null;
  if (exportsValue !== undefined) {
    const entry = subpath === "." && !Object.hasOwn(exportsValue, ".") ? exportsValue : exportsValue[subpath];
    if (entry === undefined) {
      fail(
        "NXHX-INTEGRATION-MODULE-0005",
        `${specifier} is absent from ${packageName}'s public exports map`,
      );
    }
    declaration = typesPathFromExport(entry);
  }
  if (declaration === null && subpath === "." && typeof packageManifest.types === "string") {
    declaration = packageManifest.types;
  }
  if (declaration === null) {
    const resolved = ts.resolveModuleName(
      specifier,
      path.join(packageDirectory, ".nextjshx-integration-declaration-oracle.ts"),
      {
        module: ts.ModuleKind.ESNext,
        moduleResolution: ts.ModuleResolutionKind.Bundler,
      },
      ts.sys,
    ).resolvedModule?.resolvedFileName;
    if (resolved !== undefined) {
      const relative = path.relative(packageDirectory, resolved);
      if (
        relative !== "" &&
        !relative.startsWith(`..${path.sep}`) &&
        !path.isAbsolute(relative) &&
        /\.d\.(?:ts|mts|cts)$/.test(resolved)
      ) {
        declaration = relative;
      }
    }
  }
  if (declaration === null) {
    fail(
      "NXHX-INTEGRATION-MODULE-0005",
      `${specifier} has no reviewed TypeScript declaration entry for the import condition`,
    );
  }
  return declaration.replace(/^\.\//, "");
}

function declarationExports(file, seen = new Set()) {
  const canonical = fs.realpathSync(file);
  if (seen.has(canonical)) {
    return new Set();
  }
  seen.add(canonical);
  const source = fs.readFileSync(canonical, "utf8");
  const parsed = ts.createSourceFile(canonical, source, ts.ScriptTarget.Latest, true);
  const names = new Set();
  const isExported = (statement) =>
    statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword) ?? false;
  const isDefault = (statement) =>
    statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.DefaultKeyword) ?? false;

  for (const statement of parsed.statements) {
    if (ts.isExportAssignment(statement)) {
      names.add("default");
      continue;
    }
    if (ts.isExportDeclaration(statement)) {
      if (statement.exportClause !== undefined && ts.isNamedExports(statement.exportClause)) {
        for (const element of statement.exportClause.elements) {
          names.add(element.name.text);
        }
        continue;
      }
      if (statement.exportClause !== undefined && ts.isNamespaceExport(statement.exportClause)) {
        names.add(statement.exportClause.name.text);
        continue;
      }
      if (statement.moduleSpecifier !== undefined && ts.isStringLiteral(statement.moduleSpecifier)) {
        const resolved = ts.resolveModuleName(
          statement.moduleSpecifier.text,
          canonical,
          {
            module: ts.ModuleKind.ESNext,
            moduleResolution: ts.ModuleResolutionKind.Bundler,
          },
          ts.sys,
        ).resolvedModule?.resolvedFileName;
        if (resolved !== undefined && /\.d\.(?:ts|mts|cts)$/.test(resolved)) {
          for (const name of declarationExports(resolved, seen)) {
            if (name !== "default") {
              names.add(name);
            }
          }
        }
      }
      continue;
    }
    if (!isExported(statement)) {
      continue;
    }
    if (isDefault(statement)) {
      names.add("default");
    }
    if (
      ts.isFunctionDeclaration(statement) ||
      ts.isClassDeclaration(statement) ||
      ts.isInterfaceDeclaration(statement) ||
      ts.isTypeAliasDeclaration(statement) ||
      ts.isEnumDeclaration(statement)
    ) {
      if (statement.name !== undefined) {
        names.add(statement.name.text);
      }
    } else if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name)) {
          names.add(declaration.name.text);
        }
      }
    }
  }
  return names;
}

function verifyOwnedSource(root, relative, forbidden, kind) {
  const file = resolveProjectFile(root, relative, `${kind} source`);
  const source = fs.readFileSync(file, "utf8");
  for (const [label, pattern] of forbidden) {
    if (pattern.test(source)) {
      fail(
        "NXHX-INTEGRATION-SOURCE-0006",
        `${relative} contains forbidden ${label} in a reviewed ${kind} boundary`,
      );
    }
  }
}

function verifyNativeTypeScript(root, relative) {
  const file = resolveProjectFile(root, relative, "TypeScript/JavaScript source");
  const source = fs.readFileSync(file, "utf8");
  for (const [label, pattern] of NATIVE_FORBIDDEN) {
    if (pattern.test(source)) {
      fail(
        "NXHX-INTEGRATION-SOURCE-0006",
        `${relative} contains forbidden ${label} in a reviewed TypeScript/JavaScript boundary`,
      );
    }
  }
  const kind = relative.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const parsed = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, kind);
  const visit = (node) => {
    if (node.kind === ts.SyntaxKind.AnyKeyword) {
      fail(
        "NXHX-INTEGRATION-SOURCE-0006",
        `${relative} contains forbidden any in a reviewed TypeScript/JavaScript boundary`,
      );
    }
    if (node.kind === ts.SyntaxKind.UnknownKeyword) {
      fail(
        "NXHX-INTEGRATION-SOURCE-0006",
        `${relative} contains forbidden broad unknown in a reviewed TypeScript/JavaScript boundary`,
      );
    }
    if (ts.isAsExpression(node) || ts.isTypeAssertionExpression(node) || ts.isNonNullExpression(node)) {
      fail(
        "NXHX-INTEGRATION-SOURCE-0006",
        `${relative} contains a forbidden TypeScript assertion in a reviewed boundary`,
      );
    }
    ts.forEachChild(node, visit);
  };
  visit(parsed);
}

function dependencyVersion(packageFile, packageName) {
  const manifest = readJson(packageFile, path.basename(packageFile));
  for (const field of DEPENDENCY_FIELDS) {
    const value = manifest[field]?.[packageName];
    if (typeof value === "string") {
      return value;
    }
  }
  return null;
}

export function validatePackageIntegrationDocument(document, schema) {
  const validate = new Ajv2020({ allErrors: true, strict: true }).compile(schema);
  if (!validate(document)) {
    const detail = validate.errors
      .map((error) => `${error.instancePath || "/"} ${error.message}`)
      .join("; ");
    fail("NXHX-INTEGRATION-SCHEMA-0007", `invalid package integration manifest: ${detail}`);
  }
}

export function verifyPackageIntegrationDocument(document, root) {
  const lock = readJson(path.join(root, "package-lock.json"), "package-lock.json");
  requireSorted(
    document.integrations.map((integration) => integration.id),
    "integration ids",
  );
  const seenIds = new Set();
  const seenPackages = new Set();

  for (const integration of document.integrations) {
    if (seenIds.has(integration.id)) {
      fail("NXHX-INTEGRATION-IDENTITY-0008", `duplicate integration id ${integration.id}`);
    }
    if (seenPackages.has(integration.package)) {
      fail(
        "NXHX-INTEGRATION-IDENTITY-0008",
        `package ${integration.package} must have one canonical integration record`,
      );
    }
    seenIds.add(integration.id);
    seenPackages.add(integration.package);
    for (const field of ORDERED_ARRAY_FIELDS) {
      requireSorted(integration[field], `${integration.id}.${field}`);
    }
    requireSorted(
      integration.modules.map((module) => module.specifier),
      `${integration.id}.modules`,
    );

    const installed = packageRoot(root, integration.package);
    if (installed.manifest.version !== integration.version) {
      fail(
        "NXHX-INTEGRATION-VERSION-0009",
        `${integration.package} expected ${integration.version}, found ${installed.manifest.version}`,
      );
    }
    if (installed.manifest.license !== integration.license) {
      fail(
        "NXHX-INTEGRATION-LICENSE-0010",
        `${integration.package} expected license ${integration.license}, found ${installed.manifest.license ?? "none"}`,
      );
    }
    const repository = normalizedRepository(installed.manifest.repository);
    if (repository !== integration.repository) {
      fail(
        "NXHX-INTEGRATION-PROVENANCE-0011",
        `${integration.package} expected repository ${integration.repository}, found ${repository ?? "none"}`,
      );
    }

    const lockEntry = lock.packages?.[`node_modules/${integration.package}`];
    if (lockEntry === undefined) {
      fail(
        "NXHX-INTEGRATION-LOCK-0012",
        `${integration.package} is absent from package-lock.json's installed package map`,
      );
    }
    if (lockEntry.version !== integration.version || lockEntry.integrity !== integration.integrity) {
      fail(
        "NXHX-INTEGRATION-LOCK-0012",
        `${integration.package} lock identity does not match version ${integration.version} and reviewed integrity`,
      );
    }
    if (lockEntry.license !== integration.license) {
      fail(
        "NXHX-INTEGRATION-LOCK-0012",
        `${integration.package} lock license does not match ${integration.license}`,
      );
    }

    for (const relative of integration.declaredBy) {
      const packageFile = resolveProjectFile(root, relative, `${integration.id} dependency owner`);
      const declared = dependencyVersion(packageFile, integration.package);
      if (declared !== integration.version) {
        fail(
          "NXHX-INTEGRATION-PIN-0013",
          `${relative} must declare ${integration.package} at exact version ${integration.version}; found ${declared ?? "none"}`,
        );
      }
    }

    for (const module of integration.modules) {
      requireSorted(module.requiredExports, `${integration.id}.${module.specifier}.requiredExports`);
      const selected = publicDeclaration(
        installed.manifest,
        integration.package,
        module.specifier,
        installed.directory,
      );
      if (selected !== module.declaration) {
        fail(
          "NXHX-INTEGRATION-DECLARATION-0014",
          `${module.specifier} now resolves import types from ${selected}; reviewed ${module.declaration}`,
        );
      }
      const declaration = path.resolve(installed.directory, module.declaration);
      const fromPackage = path.relative(installed.directory, declaration);
      if (fromPackage.startsWith(`..${path.sep}`) || path.isAbsolute(fromPackage)) {
        fail(
          "NXHX-INTEGRATION-DECLARATION-0014",
          `${module.specifier} declaration escapes its installed package`,
        );
      }
      let bytes;
      try {
        bytes = fs.readFileSync(declaration);
      } catch (error) {
        fail(
          "NXHX-INTEGRATION-DECLARATION-0014",
          `cannot read ${module.specifier} declaration ${module.declaration}: ${error.message}`,
        );
      }
      const digest = sha256(bytes);
      if (digest !== module.declarationSha256) {
        fail(
          "NXHX-INTEGRATION-DIGEST-0015",
          `${module.specifier} declaration digest changed: expected ${module.declarationSha256}, found ${digest}`,
        );
      }
      const exports = declarationExports(declaration);
      for (const required of module.requiredExports) {
        if (!exports.has(required)) {
          fail(
            "NXHX-INTEGRATION-EXPORT-0016",
            `${module.specifier} no longer exports required symbol ${required}`,
          );
        }
      }
    }

    for (const relative of integration.haxeSources) {
      verifyOwnedSource(root, relative, HAXE_FORBIDDEN, "Haxe");
    }
    for (const relative of integration.nativeSources) {
      verifyNativeTypeScript(root, relative);
    }
    for (const relative of integration.evidence) {
      resolveProjectFile(root, relative, `${integration.id} evidence`);
    }
  }

  return {
    integrations: document.integrations.length,
    modules: document.integrations.reduce((count, integration) => count + integration.modules.length, 0),
    packages: [...seenPackages],
  };
}

export function loadPackageIntegrationContract(root) {
  const manifestFile = path.join(root, "config/package-integrations.json");
  const schemaFile = path.join(root, "schemas/package-integrations.schema.json");
  const document = readJson(manifestFile, "config/package-integrations.json");
  const schema = readJson(schemaFile, "schemas/package-integrations.schema.json");
  validatePackageIntegrationDocument(document, schema);
  return { document, schema };
}

export function verifyRepositoryPackageIntegrations(root) {
  const { document } = loadPackageIntegrationContract(root);
  return verifyPackageIntegrationDocument(document, root);
}
