import assert from "node:assert/strict";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { Ajv2020, type AnySchemaObject } from "ajv/dist/2020.js";
import { fileURLToPath } from "node:url";

import {
  CONFIG_SCHEMA_ID,
  LEGACY_CONFIG_SCHEMA_ID,
  ConfigDiagnosticError,
  type ConfigDiagnosticCode,
  discoverNextProject,
  effectiveHaxeDefines,
  effectiveOutputProfile,
  effectiveOutputProfileFingerprint,
  parseNextJsHxConfig,
  readNextJsHxConfig,
} from "../src/index.js";

const CONFIG_SCHEMA_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../..",
  "schemas/nextjshx-config.schema.json",
);

interface ConfigOverrides {
  readonly appRoot?: string | null;
  readonly boundaries?: Readonly<Record<string, unknown>>;
  readonly cacheComponents?: boolean;
  readonly experimentalCacheDirectives?: readonly string[];
  readonly nextPackage?: string;
  readonly upstreamDir?: string | null;
}

function fixtureRoot(): string {
  return mkdtempSync(path.join(os.tmpdir(), "nextjshx-config-"));
}

function writeJson(file: string, value: unknown): void {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function configValue(overrides: ConfigOverrides = {}): Record<string, unknown> {
  return {
    $schema: CONFIG_SCHEMA_ID,
    schemaVersion: 2,
    ...(overrides.appRoot === null ? {} : { appRoot: overrides.appRoot ?? "src/app" }),
    ...(overrides.boundaries === undefined ? {} : { boundaries: overrides.boundaries }),
    haxe: {
      hxml: "build.hxml",
      generatedRoot: "src-gen",
      defines: ["application.feature"],
      extraInputs: ["schema/domain.json"],
    },
    next: {
      package: overrides.nextPackage ?? "next",
      ...(overrides.upstreamDir === null
        ? {}
        : { upstreamDir: overrides.upstreamDir ?? "../next.js" }),
      typedRoutes: true,
      ...(overrides.cacheComponents === undefined
        ? {}
        : { cacheComponents: overrides.cacheComponents }),
      ...(overrides.experimentalCacheDirectives === undefined
        ? {}
        : {
            experimentalCacheDirectives: [
              ...overrides.experimentalCacheDirectives,
            ],
          }),
    },
    output: {
      manifest: ".nextjshx/manifest.json",
      format: "project",
      language: "typescript",
      intent: "reviewable",
      profileVersion: 1,
      sourceMaps: "external",
      sourcesContent: true,
      declarations: "public",
      jsxRuntime: "automatic",
    },
  };
}

function legacyConfigValue(): Record<string, unknown> {
  const value = configValue();
  value.$schema = LEGACY_CONFIG_SCHEMA_ID;
  value.schemaVersion = 1;
  value.haxe = {
    ...(value.haxe as Record<string, unknown>),
    defines: [
      "genes.ts",
      "genes.ts.no_extension",
      "genes.ts.jsx_import_source=react",
      "application.feature",
    ],
  };
  value.output = {
    manifest: ".nextjshx/manifest.json",
    format: "project",
  };
  return value;
}

function expectDiagnostic(
  operation: () => unknown,
  code: ConfigDiagnosticCode,
): ConfigDiagnosticError {
  try {
    operation();
  } catch (error) {
    assert(
      error instanceof ConfigDiagnosticError,
      "failure uses the stable config diagnostic type",
    );
    assert.equal(error.diagnostic.code, code);
    assert.equal(error.diagnostic.docs, "docs/configuration.md");
    assert.notEqual(error.diagnostic.expected, "");
    assert.notEqual(error.diagnostic.resolution, "");
    return error;
  }
  assert.fail(`expected ${code}`);
}

function createPackage(
  root: string,
  manager: string,
  appRoot: "app" | "src/app" = "src/app",
): void {
  writeJson(path.join(root, "package.json"), {
    name: "fixture-app",
    private: true,
    packageManager: manager,
    dependencies: { next: "16.2.12" },
  });
  const managerName = manager.slice(0, manager.indexOf("@"));
  const lockfile =
    managerName === "pnpm"
      ? "pnpm-lock.yaml"
      : managerName === "yarn"
        ? "yarn.lock"
        : managerName === "bun"
          ? "bun.lock"
          : "package-lock.json";
  writeFileSync(
    path.join(root, lockfile),
    managerName === "npm" ? "{}\n" : "\n",
    "utf8",
  );
  mkdirSync(path.join(root, appRoot), { recursive: true });
}

test("parses and freezes the closed schema-v2 config", () => {
  const decodedSchema: unknown = JSON.parse(readFileSync(CONFIG_SCHEMA_PATH, "utf8"));
  assert(
    typeof decodedSchema === "object" && decodedSchema !== null && !Array.isArray(decodedSchema),
    "config schema is a JSON object",
  );
  const configSchema = decodedSchema as AnySchemaObject;
  const validate = new Ajv2020({ allErrors: true, strict: true }).compile(configSchema);
  assert.equal(validate(configValue()), true, JSON.stringify(validate.errors));
  const config = parseNextJsHxConfig(configValue());
  assert.equal(config.schemaVersion, 2);
  assert.equal(config.appRoot, "src/app");
  assert.equal(config.next.package, "next");
  assert.equal(config.next.upstreamDir, "../next.js");
  assert.equal(config.next.cacheComponents, false);
  assert.deepEqual(config.next.experimentalCacheDirectives, []);
  assert.deepEqual(config.boundaries, {});
  assert.deepEqual(config.haxe.defines, ["application.feature"]);
  assert.deepEqual(effectiveOutputProfile(config), {
    language: "typescript",
    intent: "reviewable",
    profileVersion: 1,
    sourceMaps: "external",
    sourcesContent: true,
    declarations: "public",
    jsxRuntime: "automatic",
  });
  assert.deepEqual(effectiveHaxeDefines(config), [
    "application.feature",
    "genes.ts",
    "genes.ts.no_extension",
    "genes.ts.jsx_import_source=react",
  ]);
  assert.match(effectiveOutputProfileFingerprint(config), /^[0-9a-f]{64}$/);
  assert.deepEqual(config.haxe.extraInputs, ["schema/domain.json"]);
  assert(Object.isFrozen(config));
  assert(Object.isFrozen(config.haxe));
  assert(Object.isFrozen(config.haxe.defines));
  assert(Object.isFrozen(config.haxe.extraInputs));
  assert(Object.isFrozen(config.output.profile));
  assert(Object.isFrozen(config.next.experimentalCacheDirectives));
  assert(Object.isFrozen(config.boundaries));
});

test("reads schema v1 through a deterministic no-write migration report", () => {
  const config = parseNextJsHxConfig(legacyConfigValue());
  const current = parseNextJsHxConfig(configValue());
  assert.equal(config.schemaVersion, 1);
  assert.deepEqual(config.haxe.defines, ["application.feature"]);
  assert.deepEqual(config.migration, {
    fromSchemaVersion: 1,
    toSchemaVersion: 2,
    effectiveProfile: {
      language: "typescript",
      intent: "reviewable",
      profileVersion: 1,
      sourceMaps: "external",
      sourcesContent: true,
      declarations: "public",
      jsxRuntime: "automatic",
    },
    removedCompilerOwnedDefines: [
      "genes.ts",
      "genes.ts.no_extension",
      "genes.ts.jsx_import_source=react",
    ],
    retainedApplicationDefines: ["application.feature"],
  });
  assert.deepEqual(effectiveHaxeDefines(config), [
    "application.feature",
    "genes.ts",
    "genes.ts.no_extension",
    "genes.ts.jsx_import_source=react",
  ]);
  assert.equal(
    effectiveOutputProfileFingerprint(config),
    effectiveOutputProfileFingerprint(current),
  );
});

test("schema-v1 migration preserves supported classic TS and JavaScript define plans", () => {
  const classic = legacyConfigValue();
  classic.haxe = {
    ...(classic.haxe as Record<string, unknown>),
    defines: ["genes.ts", "genes.ts.no_extension", "genes.ts.jsx_classic"],
  };
  const classicConfig = parseNextJsHxConfig(classic);
  assert.equal(effectiveOutputProfile(classicConfig).jsxRuntime, "classic");
  assert.deepEqual(effectiveHaxeDefines(classicConfig), [
    "genes.ts",
    "genes.ts.no_extension",
    "genes.ts.jsx_classic",
  ]);

  const javascript = legacyConfigValue();
  javascript.haxe = {
    ...(javascript.haxe as Record<string, unknown>),
    defines: [
      "genes.no_extension",
      "genes.react.inline_markup",
      "genes.react.jsx_runtime_module=react",
      "dts",
    ],
  };
  const javascriptConfig = parseNextJsHxConfig(javascript);
  assert.deepEqual(effectiveOutputProfile(javascriptConfig), {
    language: "javascript",
    intent: "reviewable",
    profileVersion: 1,
    sourceMaps: "external",
    sourcesContent: true,
    declarations: "public",
    jsxRuntime: "automatic",
  });
  assert.deepEqual(effectiveHaxeDefines(javascriptConfig), [
    "genes.no_extension",
    "genes.react.inline_markup",
    "genes.react.jsx_runtime_module=react",
    "dts",
  ]);

  const contradictory = legacyConfigValue();
  contradictory.haxe = {
    ...(contradictory.haxe as Record<string, unknown>),
    defines: ["genes.ts", "genes.no_extension"],
  };
  expectDiagnostic(
    () => parseNextJsHxConfig(contradictory),
    "NXHX-CONFIG-VALUE-0007",
  );
  const unsupported = legacyConfigValue();
  unsupported.haxe = {
    ...(unsupported.haxe as Record<string, unknown>),
    defines: ["genes.ts", "genes.future_mechanism=unsafe"],
  };
  expectDiagnostic(
    () => parseNextJsHxConfig(unsupported),
    "NXHX-CONFIG-VALUE-0007",
  );
});

test("rejects unsupported output profile values without fallback", () => {
  for (const [field, value] of [
    ["language", "coffee"],
    ["intent", "native-source"],
    ["profileVersion", 2],
    ["sourceMaps", "hidden"],
    ["sourcesContent", "yes"],
    ["declarations", "sometimes"],
    ["jsxRuntime", "magic"],
  ] as const) {
    const config = configValue();
    config.output = {
      ...(config.output as Record<string, unknown>),
      [field]: value,
    };
    const error = expectDiagnostic(
      () => parseNextJsHxConfig(config),
      "NXHX-CONFIG-VALUE-0007",
    );
    assert.equal(error.diagnostic.subject, `$.output.${field}`);
  }
});

test("parses closed boundary warning budgets and rejects weakened values", () => {
  const config = parseNextJsHxConfig(configValue({
    boundaries: {
      maxDirectDependencies: 4,
      maxObservedClientBytes: 65536,
    },
  }));
  assert.deepEqual(config.boundaries, {
    maxDirectDependencies: 4,
    maxObservedClientBytes: 65536,
  });
  for (const boundaries of [
    { maxDirectDependencies: -1 },
    { maxObservedClientBytes: 1.5 },
  ]) {
    expectDiagnostic(
      () => parseNextJsHxConfig(configValue({ boundaries })),
      "NXHX-CONFIG-VALUE-0007",
    );
  }
  expectDiagnostic(
    () => parseNextJsHxConfig(configValue({ boundaries: { approximateBytes: 1 } })),
    "NXHX-CONFIG-UNKNOWN-0004",
  );
});

test("parses explicit Cache Components and separate experimental directives", () => {
  const value = configValue({
    cacheComponents: true,
    experimentalCacheDirectives: ["private", "remote"],
  });
  const config = parseNextJsHxConfig(value);
  assert.equal(config.next.cacheComponents, true);
  assert.deepEqual(config.next.experimentalCacheDirectives, ["private", "remote"]);

  for (const experimentalCacheDirectives of [
    ["private", "private"],
    ["shared"],
  ]) {
    expectDiagnostic(
      () =>
        parseNextJsHxConfig(
          configValue({ cacheComponents: true, experimentalCacheDirectives }),
        ),
      "NXHX-CONFIG-VALUE-0007",
    );
  }
  expectDiagnostic(
    () =>
      parseNextJsHxConfig(
        configValue({
          cacheComponents: false,
          experimentalCacheDirectives: ["private"],
        }),
      ),
    "NXHX-CONFIG-VALUE-0007",
  );
});

test("rejects unknown root and nested keys deterministically", () => {
  const rootUnknown = { ...configValue(), typo: true };
  const rootError = expectDiagnostic(
    () => parseNextJsHxConfig(rootUnknown),
    "NXHX-CONFIG-UNKNOWN-0004",
  );
  assert.equal(rootError.diagnostic.subject, "$");
  assert.match(rootError.diagnostic.message, /typo/);

  const nested = configValue();
  nested.haxe = { ...(nested.haxe as Record<string, unknown>), hxmll: "wrong.hxml" };
  const nestedError = expectDiagnostic(
    () => parseNextJsHxConfig(nested),
    "NXHX-CONFIG-UNKNOWN-0004",
  );
  assert.equal(nestedError.diagnostic.subject, "$.haxe");
});

test(
  "rejects unknown versions, unsafe paths, package paths, and duplicate defines",
  () => {
    const version = { ...configValue(), schemaVersion: 3 };
    expectDiagnostic(
      () => parseNextJsHxConfig(version),
      "NXHX-CONFIG-VERSION-0006",
    );

    const traversal = configValue();
    traversal.haxe = {
      ...(traversal.haxe as Record<string, unknown>),
      generatedRoot: "../outside",
    };
    expectDiagnostic(
      () => parseNextJsHxConfig(traversal),
      "NXHX-CONFIG-PATH-0008",
    );

    const packagePath = configValue({ nextPackage: "../next" });
    expectDiagnostic(
      () => parseNextJsHxConfig(packagePath),
      "NXHX-CONFIG-PACKAGE-0009",
    );

    const duplicate = configValue();
    duplicate.haxe = {
      ...(duplicate.haxe as Record<string, unknown>),
      defines: ["application.feature", "application.feature"],
    };
    expectDiagnostic(
      () => parseNextJsHxConfig(duplicate),
      "NXHX-CONFIG-VALUE-0007",
    );

    for (const reservedDefine of [
      "nextjshx.adapter-plan-output",
      "nextjshx.adapter-plan-output=.nextjshx/plans/attacker.json",
      "nextjshx.boundary-plan-output",
      "nextjshx.boundary-plan-output=.nextjshx/plans/attacker.json",
      "nextjshx.app-root=attacker/app",
      "nextjshx.cache-components",
      "nextjshx.experimental.cache-private",
      "nextjshx.experimental.cache-remote",
      "nextjshx.generated-root=attacker-output",
      "nextjshx.future-mechanism=unsafe",
      "genes.ts",
      "genes.ts.no_extension",
      "genes.ts.jsx_import_source=react",
      "genes.no_extension",
      "genes.react.inline_markup",
      "genes.react.jsx_runtime_module=react",
      "genes.future_mechanism=unsafe",
      "dts",
      "contains whitespace",
    ]) {
      const reserved = configValue();
      reserved.haxe = {
        ...(reserved.haxe as Record<string, unknown>),
        defines: [reservedDefine],
      };
      expectDiagnostic(
        () => parseNextJsHxConfig(reserved),
        "NXHX-CONFIG-VALUE-0007",
      );
    }

    const externalManifest = configValue();
    externalManifest.output = {
      ...(externalManifest.output as Record<string, unknown>),
      manifest: "public/manifest.json",
    };
    expectDiagnostic(
      () => parseNextJsHxConfig(externalManifest),
      "NXHX-CONFIG-VALUE-0007",
    );

    for (const reserved of [
      ".nextjshx/transaction.json",
      ".nextjshx/transactions/manifest.json",
      ".nextjshx/plans/manifest.json",
    ]) {
      const collidingManifest = configValue();
      collidingManifest.output = {
        ...(collidingManifest.output as Record<string, unknown>),
        manifest: reserved,
      };
      expectDiagnostic(
        () => parseNextJsHxConfig(collidingManifest),
        "NXHX-CONFIG-VALUE-0007",
      );
    }
  },
);

test("reads strict JSON without executing JavaScript config", () => {
  const root = fixtureRoot();
  try {
    const configPath = path.join(root, "nextjshx.config.json");
    writeFileSync(configPath, "export default process.env;\n", "utf8");
    expectDiagnostic(() => readNextJsHxConfig(configPath), "NXHX-CONFIG-JSON-0002");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("discovers a single npm package, src/app, versions, and configured paths", () => {
  const root = fixtureRoot();
  try {
    createPackage(root, "npm@10.8.2");
    writeJson(path.join(root, "nextjshx.config.json"), configValue());
    const result = discoverNextProject(path.join(root, "src/app"));

    assert.equal(result.packageRoot, root);
    assert.equal(result.workspaceRoot, root);
    assert.equal(result.appRootRelative, "src/app");
    assert.equal(result.packageManager.name, "npm");
    assert.equal(result.packageManager.version, "10.8.2");
    assert.equal(
      result.packageManager.lockfile,
      path.join(root, "package-lock.json"),
    );
    assert.equal(result.nextPackage.requestedVersion, "16.2.12");
    assert.equal(result.configuredPaths?.hxml, path.join(root, "build.hxml"));
    assert.equal(
      result.configuredPaths?.manifest,
      path.join(root, ".nextjshx/manifest.json"),
    );
    assert.equal(
      result.configuredPaths?.upstreamDir,
      path.resolve(root, "../next.js"),
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("distinguishes a pnpm workspace root from its Next package root", () => {
  const root = fixtureRoot();
  try {
    writeJson(path.join(root, "package.json"), {
      name: "fixture-workspace",
      private: true,
      packageManager: "pnpm@10.13.1",
      workspaces: ["packages/*"],
    });
    writeFileSync(path.join(root, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n", "utf8");
    const appPackage = path.join(root, "packages/web");
    writeJson(path.join(appPackage, "package.json"), {
      name: "fixture-web",
      private: true,
      dependencies: { next: "16.2.12" },
    });
    mkdirSync(path.join(appPackage, "app"), { recursive: true });
    writeJson(
      path.join(appPackage, "nextjshx.config.json"),
      configValue({ appRoot: "app", upstreamDir: null }),
    );

    const result = discoverNextProject(path.join(appPackage, "app"));
    assert.equal(result.workspaceRoot, root);
    assert.equal(result.packageRoot, appPackage);
    assert.equal(result.appRootRelative, "app");
    assert.equal(result.packageManager.name, "pnpm");
    assert.equal(result.packageManager.version, "10.13.1");
    assert.equal(result.nextPackage.requestedVersion, "16.2.12");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("detects app and src/app before init when config is absent", () => {
  for (const appRoot of ["app", "src/app"] as const) {
    const root = fixtureRoot();
    try {
      createPackage(root, "npm@10.8.2", appRoot);
      const result = discoverNextProject(root, { requireConfig: false });
      assert.equal(result.config, null);
      assert.equal(result.configPath, null);
      assert.equal(result.configuredPaths, null);
      assert.equal(result.appRootRelative, appRoot);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }
});

test("fails closed when app-root or package-manager discovery is ambiguous", () => {
  const appRoot = fixtureRoot();
  try {
    createPackage(appRoot, "npm@10.8.2", "app");
    mkdirSync(path.join(appRoot, "src/app"), { recursive: true });
    expectDiagnostic(
      () => discoverNextProject(appRoot, { requireConfig: false }),
      "NXHX-CONFIG-APP-ROOT-0013",
    );
  } finally {
    rmSync(appRoot, { recursive: true, force: true });
  }

  const managers = fixtureRoot();
  try {
    createPackage(managers, "npm@10.8.2");
    writeFileSync(path.join(managers, "yarn.lock"), "\n", "utf8");
    expectDiagnostic(
      () => discoverNextProject(managers, { requireConfig: false }),
      "NXHX-CONFIG-PACKAGE-MANAGER-0012",
    );
  } finally {
    rmSync(managers, { recursive: true, force: true });
  }
});

test("rejects a configured App Router symlink that escapes the package", {
  skip: process.platform === "win32",
}, () => {
  const root = fixtureRoot();
  const outside = fixtureRoot();
  try {
    createPackage(root, "npm@10.8.2");
    rmSync(path.join(root, "src/app"), { recursive: true, force: true });
    mkdirSync(path.join(root, "src"), { recursive: true });
    symlinkSync(outside, path.join(root, "src/app"), "dir");
    writeJson(path.join(root, "nextjshx.config.json"), configValue());
    expectDiagnostic(() => discoverNextProject(root), "NXHX-CONFIG-SYMLINK-0015");
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  }
});
