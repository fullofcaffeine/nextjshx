import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  existsSync,
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
import { fileURLToPath } from "node:url";

import { Ajv2020, type AnySchemaObject } from "ajv/dist/2020.js";

import {
  type GeneratedOutputIdentity,
  type OwnershipDiagnosticCode,
  type OwnershipPreflightOptions,
  DEFAULT_OUTPUT_PROFILE,
  OwnershipDiagnosticError,
  createGeneratedOutputManifest,
  encodeGeneratedOutputManifest,
  parseGeneratedOutputManifest,
  preflightGeneratedOutputs,
  preflightOwnershipTransfer,
} from "../src/index.js";

const MANIFEST_SCHEMA_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../..",
  "schemas/generated-output-manifest.schema.json",
);
const MANIFEST_PATH = ".nextjshx/manifest.json";

interface OwnedFixture {
  readonly path: string;
  readonly kind?: string;
  readonly source?: string;
  readonly content: string;
}

function fixtureRoot(): string {
  const root = mkdtempSync(path.join(os.tmpdir(), "nextjshx-ownership-"));
  mkdirSync(path.join(root, "src/app"), { recursive: true });
  return root;
}

function sha256(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

function identity(fixture: OwnedFixture): GeneratedOutputIdentity {
  return {
    path: fixture.path,
    kind: fixture.kind ?? "app-page-adapter",
    source: fixture.source ?? "fixture.Page",
    sha256: sha256(fixture.content),
  };
}

function writeOwnedState(root: string, fixtures: readonly OwnedFixture[]): string {
  for (const fixture of fixtures) {
    const target = path.join(root, ...fixture.path.split("/"));
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, fixture.content, "utf8");
  }
  const manifest = createGeneratedOutputManifest(
    "16.2.12",
    "1.37.1+test",
    DEFAULT_OUTPUT_PROFILE,
    fixtures.map(identity),
  );
  const manifestPath = path.join(root, MANIFEST_PATH);
  mkdirSync(path.dirname(manifestPath), { recursive: true });
  const encoded = encodeGeneratedOutputManifest(manifest);
  writeFileSync(manifestPath, encoded, "utf8");
  return encoded;
}

function options(
  root: string,
  outputs: OwnershipPreflightOptions["outputs"],
  allowedOutputRoots: readonly string[] = ["src/app"],
  allowedOutputFiles: readonly string[] = [],
): OwnershipPreflightOptions {
  return {
    projectRoot: root,
    manifestPath: MANIFEST_PATH,
    allowedOutputRoots,
    allowedOutputFiles,
    nextVersion: "16.2.12",
    genesVersion: "1.37.1+test",
    outputProfile: DEFAULT_OUTPUT_PROFILE,
    outputs,
  };
}

test("allows one exact convention file without granting its sibling directory", () => {
  const root = fixtureRoot();
  try {
    const proxy = {
      path: "src/proxy.ts",
      kind: "proxy-adapter",
      source: "fixture.RequestProxy.proxy",
      content: "export const proxy = () => null;\n",
    };
    const result = preflightGeneratedOutputs(
      options(root, [proxy], ["src/app"], ["src/proxy.ts"]),
    );
    assert.deepEqual(
      result.changes.map((change) => [change.path, change.disposition]),
      [["src/proxy.ts", "create"]],
    );
    assert.deepEqual(
      result.allowedOutputFiles,
      [path.join(result.projectRoot, "src/proxy.ts")],
    );

    expectDiagnostic(
      () =>
        preflightGeneratedOutputs(
          options(
            root,
            [{ ...proxy, path: "src/native.ts" }],
            ["src/app"],
            ["src/proxy.ts"],
          ),
        ),
      "NXHX-OWNERSHIP-ESCAPE-0007",
    );

    writeFileSync(path.join(root, "src/proxy.ts"), "// native proxy\n", "utf8");
    expectDiagnostic(
      () =>
        preflightGeneratedOutputs(
          options(root, [proxy], ["src/app"], ["src/proxy.ts"]),
        ),
      "NXHX-OWNERSHIP-UNOWNED-0008",
    );

    expectDiagnostic(
      () =>
        preflightGeneratedOutputs(
          options(root, [], ["src/app"], ["src/app/page.tsx"]),
        ),
      "NXHX-OWNERSHIP-DUPLICATE-0005",
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("blocks an unowned native MDX registry at the exact root convention path", () => {
  const root = fixtureRoot();
  try {
    const registry = {
      path: "mdx-components.tsx",
      kind: "mdx-components-adapter",
      source: "fixture.AtlasMdxComponents.components",
      content: "export const useMDXComponents = AtlasMdxComponents.components;\n",
    };
    const permitted = preflightGeneratedOutputs(
      options(root, [registry], ["app"], ["mdx-components.tsx"]),
    );
    assert.deepEqual(
      permitted.changes.map((change) => [change.path, change.disposition]),
      [["mdx-components.tsx", "create"]],
    );

    writeFileSync(
      path.join(root, "mdx-components.tsx"),
      "// Native application-owned MDX registry.\n",
      "utf8",
    );
    expectDiagnostic(
      () =>
        preflightGeneratedOutputs(
          options(root, [registry], ["app"], ["mdx-components.tsx"]),
        ),
      "NXHX-OWNERSHIP-UNOWNED-0008",
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("ownership transfer is exact-path, byte-equal, and isolated from unrelated drift", () => {
  const root = fixtureRoot();
  try {
    const owned = {
      path: "src/app/owned/page.tsx",
      content: "export const owned = true;\n",
    };
    writeOwnedState(root, [owned]);
    const adopt = {
      path: "src/app/adopt/page.tsx",
      kind: "app-page-adapter",
      source: "fixture.Adopt",
      content: "export const adopted = true;\n",
    };
    const adoptTarget = path.join(root, adopt.path);
    mkdirSync(path.dirname(adoptTarget), { recursive: true });
    writeFileSync(adoptTarget, adopt.content, "utf8");

    const adopted = preflightOwnershipTransfer(
      options(root, [
        { ...owned, kind: "app-page-adapter", source: "fixture.Page" },
        adopt,
      ]),
      { operation: "adopt", path: adopt.path },
    );
    assert.deepEqual(
      adopted.changes.map((change) => [
        change.path,
        change.previousOwnershipSha256,
        change.intendedOwnershipSha256,
        change.disposition,
      ]),
      [
        [adopt.path, null, sha256(adopt.content), "unchanged"],
        [owned.path, sha256(owned.content), sha256(owned.content), "unchanged"],
      ],
    );

    writeFileSync(adoptTarget, `${adopt.content}// drift\n`, "utf8");
    expectDiagnostic(
      () =>
        preflightOwnershipTransfer(
          options(root, [
            { ...owned, kind: "app-page-adapter", source: "fixture.Page" },
            adopt,
          ]),
          { operation: "adopt", path: adopt.path },
        ),
      "NXHX-OWNERSHIP-TRANSFER-0014",
    );

    writeFileSync(adoptTarget, adopt.content, "utf8");
    writeFileSync(
      path.join(root, owned.path),
      `${owned.content}// unrelated drift\n`,
      "utf8",
    );
    expectDiagnostic(
      () =>
        preflightOwnershipTransfer(
          options(root, [
            { ...owned, kind: "app-page-adapter", source: "fixture.Page" },
            adopt,
          ]),
          { operation: "adopt", path: adopt.path },
        ),
      "NXHX-OWNERSHIP-TRANSFER-0014",
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

function expectDiagnostic(
  operation: () => unknown,
  code: OwnershipDiagnosticCode,
): OwnershipDiagnosticError {
  try {
    operation();
  } catch (error) {
    assert(
      error instanceof OwnershipDiagnosticError,
      "failure uses the stable ownership diagnostic type",
    );
    assert.equal(error.diagnostic.code, code);
    assert.equal(error.diagnostic.docs, "docs/generated-output-ownership.md");
    assert.notEqual(error.diagnostic.expected, "");
    assert.notEqual(error.diagnostic.resolution, "");
    return error;
  }
  assert.fail(`expected ${code}`);
}

test("creates deterministic canonical schema-v2 manifest bytes", () => {
  const decodedSchema: unknown = JSON.parse(readFileSync(MANIFEST_SCHEMA_PATH, "utf8"));
  assert(
    typeof decodedSchema === "object" && decodedSchema !== null && !Array.isArray(decodedSchema),
    "manifest schema is a JSON object",
  );
  const schema = decodedSchema as AnySchemaObject;
  const second = identity({ path: "src/app/z/page.tsx", content: "second\n" });
  const first = identity({ path: "src/app/a/page.tsx", content: "first\n" });
  const manifest = createGeneratedOutputManifest(
    "16.2.12",
    "1.37.1+test",
    DEFAULT_OUTPUT_PROFILE,
    [second, first],
  );
  const encoded = encodeGeneratedOutputManifest(manifest);
  const parsed = parseGeneratedOutputManifest(JSON.parse(encoded));
  const validate = new Ajv2020({ allErrors: true, strict: true }).compile(schema);

  assert.deepEqual(
    parsed.outputs.map((output) => output.path),
    ["src/app/a/page.tsx", "src/app/z/page.tsx"],
  );
  assert.match(parsed.generation, /^[0-9a-f]{64}$/);
  assert.equal(encodeGeneratedOutputManifest(parsed), encoded);
  assert.equal(validate(JSON.parse(encoded)), true, JSON.stringify(validate.errors));
});

test("profile policy participates in manifest identity and legacy manifests migrate in memory", () => {
  const output = identity({
    path: "src/app/page.tsx",
    content: "export default function Page() {}\n",
  });
  const optimized = Object.freeze({
    ...DEFAULT_OUTPUT_PROFILE,
    intent: "optimized" as const,
  });
  const reviewableManifest = createGeneratedOutputManifest(
    "16.2.12",
    "1.37.1+test",
    DEFAULT_OUTPUT_PROFILE,
    [output],
  );
  const optimizedManifest = createGeneratedOutputManifest(
    "16.2.12",
    "1.37.1+test",
    optimized,
    [output],
  );
  assert.notEqual(
    reviewableManifest.outputProfileFingerprint,
    optimizedManifest.outputProfileFingerprint,
  );
  assert.notEqual(reviewableManifest.generation, optimizedManifest.generation);

  const legacyGeneration = createHash("sha256")
    .update(`${output.path}\0${output.sha256}\n`, "utf8")
    .digest("hex");
  const legacy = {
    protocol: "nextjshx.generated-output",
    version: 1,
    generation: legacyGeneration,
    nextVersion: "16.2.12",
    genesVersion: "1.37.1+test",
    outputs: [output],
  };
  const migrated = parseGeneratedOutputManifest(legacy);
  assert.equal(migrated.version, 2);
  assert.deepEqual(migrated.outputProfile, DEFAULT_OUTPUT_PROFILE);
  assert.equal(
    migrated.outputProfileFingerprint,
    reviewableManifest.outputProfileFingerprint,
  );
  assert.equal(
    JSON.parse(encodeGeneratedOutputManifest(migrated)).version,
    2,
  );
});

test("plans new files without creating targets or control data", () => {
  const root = fixtureRoot();
  try {
    const result = preflightGeneratedOutputs(
      options(root, [
        {
          path: "src/app/page.tsx",
          kind: "app-page-adapter",
          source: "fixture.HomePage",
          content: "export default function Page() {}\n",
        },
      ]),
    );
    assert.equal(result.previousManifest, null);
    assert.deepEqual(result.changes.map((change) => change.disposition), ["create"]);
    assert.equal(existsSync(path.join(root, "src/app/page.tsx")), false);
    assert.equal(existsSync(path.join(root, MANIFEST_PATH)), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("classifies verified create, update, unchanged, and remove states", () => {
  const root = fixtureRoot();
  const previous = [
    { path: "src/app/a/page.tsx", content: "same\n" },
    { path: "src/app/b/page.tsx", content: "before\n" },
    { path: "src/app/d/page.tsx", content: "stale\n" },
  ];
  try {
    const manifestBytes = writeOwnedState(root, previous);
    const result = preflightGeneratedOutputs(
      options(root, [
        {
          path: "src/app/a/page.tsx",
          kind: "app-page-adapter",
          source: "fixture.A",
          content: "same\n",
        },
        {
          path: "src/app/b/page.tsx",
          kind: "app-page-adapter",
          source: "fixture.B",
          content: "after\n",
        },
        {
          path: "src/app/c/page.tsx",
          kind: "app-page-adapter",
          source: "fixture.C",
          content: "new\n",
        },
      ]),
    );
    assert.deepEqual(
      result.changes.map((change) => [change.path, change.disposition]),
      [
        ["src/app/a/page.tsx", "unchanged"],
        ["src/app/b/page.tsx", "update"],
        ["src/app/c/page.tsx", "create"],
        ["src/app/d/page.tsx", "remove"],
      ],
    );
    assert.equal(readFileSync(path.join(root, "src/app/b/page.tsx"), "utf8"), "before\n");
    assert.equal(readFileSync(path.join(root, "src/app/d/page.tsx"), "utf8"), "stale\n");
    assert.equal(existsSync(path.join(root, "src/app/c/page.tsx")), false);
    assert.equal(readFileSync(path.join(root, MANIFEST_PATH), "utf8"), manifestBytes);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("rejects an existing unowned target even when its bytes match", () => {
  const root = fixtureRoot();
  try {
    const target = path.join(root, "src/app/page.tsx");
    writeFileSync(target, "native\n", "utf8");
    const error = expectDiagnostic(
      () =>
        preflightGeneratedOutputs(
          options(root, [
            {
              path: "src/app/page.tsx",
              kind: "app-page-adapter",
              source: "fixture.HomePage",
              content: "native\n",
            },
          ]),
        ),
      "NXHX-OWNERSHIP-UNOWNED-0008",
    );
    assert.equal(error.diagnostic.source, "fixture.HomePage");
    assert.match(error.diagnostic.resolution, /keep the native route/);
    assert.equal(readFileSync(target, "utf8"), "native\n");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("rejects modified and missing owned outputs before planning changes", () => {
  const modifiedRoot = fixtureRoot();
  try {
    writeOwnedState(modifiedRoot, [
      { path: "src/app/page.tsx", content: "owned\n", source: "fixture.HomePage" },
    ]);
    const target = path.join(modifiedRoot, "src/app/page.tsx");
    writeFileSync(target, "hand edited\n", "utf8");
    const error = expectDiagnostic(
      () =>
        preflightGeneratedOutputs(
          options(modifiedRoot, [
            {
              path: "src/app/new/page.tsx",
              kind: "app-page-adapter",
              source: "fixture.NewPage",
              content: "new\n",
            },
          ]),
        ),
      "NXHX-OWNERSHIP-MODIFIED-0009",
    );
    assert.equal(error.diagnostic.expected, sha256("owned\n"));
    assert.equal(error.diagnostic.actual, sha256("hand edited\n"));
    assert.equal(existsSync(path.join(modifiedRoot, "src/app/new/page.tsx")), false);
  } finally {
    rmSync(modifiedRoot, { recursive: true, force: true });
  }

  const missingRoot = fixtureRoot();
  try {
    writeOwnedState(missingRoot, [{ path: "src/app/page.tsx", content: "owned\n" }]);
    rmSync(path.join(missingRoot, "src/app/page.tsx"), { force: true });
    expectDiagnostic(
      () => preflightGeneratedOutputs(options(missingRoot, [])),
      "NXHX-OWNERSHIP-MISSING-0010",
    );
  } finally {
    rmSync(missingRoot, { recursive: true, force: true });
  }
});

test("rejects unsafe, reserved, non-TypeScript, and out-of-root targets", () => {
  const cases: ReadonlyArray<readonly [string, OwnershipDiagnosticCode]> = [
    ["/absolute/page.tsx", "NXHX-OWNERSHIP-PATH-0003"],
    ["src/app/../escape.tsx", "NXHX-OWNERSHIP-PATH-0003"],
    ["src\\app\\page.tsx", "NXHX-OWNERSHIP-PATH-0003"],
    [".next/types/app.ts", "NXHX-OWNERSHIP-RESERVED-0004"],
    ["src/app/tsconfig.json", "NXHX-OWNERSHIP-RESERVED-0004"],
    ["src/app/image.png", "NXHX-OWNERSHIP-TARGET-0013"],
    ["other/page.tsx", "NXHX-OWNERSHIP-ESCAPE-0007"],
  ];
  for (const [target, code] of cases) {
    const root = fixtureRoot();
    try {
      expectDiagnostic(
        () =>
          preflightGeneratedOutputs(
            options(root, [
              {
                path: target,
                kind: "app-page-adapter",
                source: "fixture.Page",
                content: "generated\n",
              },
            ]),
          ),
        code,
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }
});

test("rejects ownership manifests that collide with transaction control", () => {
  for (const manifestPath of [
    ".nextjshx/transaction.json",
    ".nextjshx/transactions/manifest.json",
  ]) {
    const root = fixtureRoot();
    try {
      expectDiagnostic(
        () =>
          preflightGeneratedOutputs({
            ...options(root, []),
            manifestPath,
          }),
        "NXHX-OWNERSHIP-MANIFEST-0001",
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }
});

test("rejects filesystem-equivalent duplicate planned outputs", () => {
  const root = fixtureRoot();
  try {
    expectDiagnostic(
      () =>
        preflightGeneratedOutputs(
          options(root, [
            {
              path: "src/app/Shop/page.tsx",
              kind: "app-page-adapter",
              source: "fixture.ShopUpper",
              content: "upper\n",
            },
            {
              path: "src/app/shop/page.tsx",
              kind: "app-page-adapter",
              source: "fixture.ShopLower",
              content: "lower\n",
            },
          ]),
        ),
      "NXHX-OWNERSHIP-DUPLICATE-0005",
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("rejects unknown and internally inconsistent manifests", () => {
  const root = fixtureRoot();
  try {
    const encoded = writeOwnedState(root, [
      { path: "src/app/page.tsx", content: "owned\n" },
    ]);
    const manifestPath = path.join(root, MANIFEST_PATH);
    const unknownVersion = JSON.parse(encoded) as Record<string, unknown>;
    unknownVersion.version = 3;
    writeFileSync(manifestPath, `${JSON.stringify(unknownVersion, null, 2)}\n`, "utf8");
    expectDiagnostic(
      () => preflightGeneratedOutputs(options(root, [])),
      "NXHX-OWNERSHIP-VERSION-0002",
    );

    const badGeneration = JSON.parse(encoded) as Record<string, unknown>;
    badGeneration.generation = "0".repeat(64);
    writeFileSync(manifestPath, `${JSON.stringify(badGeneration, null, 2)}\n`, "utf8");
    expectDiagnostic(
      () => preflightGeneratedOutputs(options(root, [])),
      "NXHX-OWNERSHIP-GENERATION-0011",
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("rejects symlink targets, parent traversal, and allowlisted roots", {
  skip: process.platform === "win32",
}, () => {
  const outside = fixtureRoot();
  const targetRoot = fixtureRoot();
  const parentRoot = fixtureRoot();
  const allowedRoot = fixtureRoot();
  try {
    const outsideFile = path.join(outside, "native.tsx");
    writeFileSync(outsideFile, "outside\n", "utf8");
    symlinkSync(outsideFile, path.join(targetRoot, "src/app/page.tsx"));
    expectDiagnostic(
      () =>
        preflightGeneratedOutputs(
          options(targetRoot, [
            {
              path: "src/app/page.tsx",
              kind: "app-page-adapter",
              source: "fixture.Page",
              content: "generated\n",
            },
          ]),
        ),
      "NXHX-OWNERSHIP-SYMLINK-0006",
    );

    symlinkSync(outside, path.join(parentRoot, "src/app/linked"), "dir");
    expectDiagnostic(
      () =>
        preflightGeneratedOutputs(
          options(parentRoot, [
            {
              path: "src/app/linked/page.tsx",
              kind: "app-page-adapter",
              source: "fixture.LinkedPage",
              content: "generated\n",
            },
          ]),
        ),
      "NXHX-OWNERSHIP-SYMLINK-0006",
    );

    symlinkSync(outside, path.join(allowedRoot, "generated"), "dir");
    expectDiagnostic(
      () => preflightGeneratedOutputs(options(allowedRoot, [], ["generated"])),
      "NXHX-OWNERSHIP-SYMLINK-0006",
    );
  } finally {
    rmSync(outside, { recursive: true, force: true });
    rmSync(targetRoot, { recursive: true, force: true });
    rmSync(parentRoot, { recursive: true, force: true });
    rmSync(allowedRoot, { recursive: true, force: true });
  }
});
