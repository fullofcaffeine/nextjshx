import assert from "node:assert/strict";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { hostname } from "node:os";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { Ajv2020, type AnySchemaObject } from "ajv/dist/2020.js";

import {
  DEFAULT_OUTPUT_PROFILE,
  type PlannedGeneratedOutput,
  type PublicationDiagnosticCode,
  type PublicationFaultPoint,
  type PublishGeneratedOutputsOptions,
  PublicationCrashSimulationError,
  PublicationDiagnosticError,
  PUBLICATION_JOURNAL_SCHEMA_ID,
  createPublicationJournal,
  encodePublicationJournal,
  formatGeneratedOutput,
  parsePublicationJournal,
  publishGeneratedOutputs,
  recoverGeneratedOutputPublication,
} from "../src/index.js";

const TRANSACTION_SCHEMA_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../..",
  "schemas/generated-output-transaction.schema.json",
);
const MANIFEST_PATH = ".nextjshx/manifest.json";
const JOURNAL_PATH = ".nextjshx/transaction.json";
const LOCK_PATH = ".nextjshx/publish.lock";

interface OutputFixture {
  readonly path: string;
  readonly content: string;
  readonly source?: string;
}

const identityFormatter = (
  output: PlannedGeneratedOutput,
): string | Uint8Array => output.content;

function fixtureRoot(): string {
  const root = mkdtempSync(path.join(os.tmpdir(), "nextjshx-publication-"));
  mkdirSync(path.join(root, "src/app"), { recursive: true });
  return root;
}

function output(fixture: OutputFixture): PlannedGeneratedOutput {
  return {
    path: fixture.path,
    kind: "app-page-adapter",
    source: fixture.source ?? "fixture.Page",
    content: fixture.content,
  };
}

function options(
  root: string,
  fixtures: readonly OutputFixture[],
  extra: Partial<PublishGeneratedOutputsOptions> = {},
): PublishGeneratedOutputsOptions {
  return {
    projectRoot: root,
    manifestPath: MANIFEST_PATH,
    allowedOutputRoots: ["src/app"],
    allowedOutputFiles: [],
    nextVersion: "16.2.12",
    genesVersion: "1.37.1+test",
    outputProfile: DEFAULT_OUTPUT_PROFILE,
    outputs: fixtures.map(output),
    formatter: identityFormatter,
    ...extra,
  };
}

function live(root: string, relative: string): string {
  return readFileSync(path.join(root, ...relative.split("/")), "utf8");
}

function expectPublicationDiagnostic(
  error: unknown,
  code: PublicationDiagnosticCode,
): PublicationDiagnosticError {
  assert(
    error instanceof PublicationDiagnosticError,
    `expected stable publication diagnostic ${code}`,
  );
  assert.equal(error.diagnostic.code, code);
  assert.equal(error.diagnostic.docs, "docs/generated-output-publication.md");
  assert.notEqual(error.diagnostic.expected, "");
  assert.notEqual(error.diagnostic.resolution, "");
  return error;
}

async function expectRejectedDiagnostic(
  operation: Promise<unknown>,
  code: PublicationDiagnosticCode,
): Promise<PublicationDiagnosticError> {
  try {
    await operation;
  } catch (error) {
    return expectPublicationDiagnostic(error, code);
  }
  assert.fail(`expected ${code}`);
}

const PREVIOUS: readonly OutputFixture[] = [
  {
    path: "src/app/a/page.tsx",
    content: "export const value = 'same';\n",
    source: "fixture.A",
  },
  {
    path: "src/app/b/page.tsx",
    content: "export const value = 'before';\n",
    source: "fixture.B",
  },
  {
    path: "src/app/d/page.tsx",
    content: "export const value = 'stale';\n",
    source: "fixture.D",
  },
];
const INTENDED: readonly OutputFixture[] = [
  {
    path: "src/app/a/page.tsx",
    content: "export const value = 'same';\n",
    source: "fixture.A",
  },
  {
    path: "src/app/b/page.tsx",
    content: "export const value = 'after';\n",
    source: "fixture.B",
  },
  {
    path: "src/app/c/page.tsx",
    content: "export const value = 'new';\n",
    source: "fixture.C",
  },
];

async function previousState(root: string): Promise<string> {
  await publishGeneratedOutputs(options(root, PREVIOUS));
  return live(root, MANIFEST_PATH);
}

function assertPreviousState(root: string, manifest: string): void {
  assert.equal(live(root, "src/app/a/page.tsx"), PREVIOUS[0]?.content);
  assert.equal(live(root, "src/app/b/page.tsx"), PREVIOUS[1]?.content);
  assert.equal(live(root, "src/app/d/page.tsx"), PREVIOUS[2]?.content);
  assert.equal(existsSync(path.join(root, "src/app/c/page.tsx")), false);
  assert.equal(live(root, MANIFEST_PATH), manifest);
}

test("formats deterministic TypeScript and rejects syntax before live publication", async () => {
  const formatted = await formatGeneratedOutput({
    path: "src/app/page.tsx",
    kind: "app-page-adapter",
    source: "fixture.Page",
    content: "export default function Page(){return <main>Hello</main>}",
  });
  assert.equal(
    formatted.content,
    "export default function Page() { return <main>Hello</main>; }\n",
  );
  assert.deepEqual(
    await formatGeneratedOutput(formatted),
    formatted,
    "default formatting is idempotent",
  );
  let formatterPass = 0;
  await expectRejectedDiagnostic(
    formatGeneratedOutput(
      {
        path: "src/app/page.tsx",
        kind: "app-page-adapter",
        source: "fixture.Page",
        content: "export const value = 1;\n",
      },
      (value) =>
        `${String(value.content)}// formatter pass ${(formatterPass += 1)}\n`,
    ),
    "NXHX-TRANSACTION-FORMAT-0005",
  );

  const root = fixtureRoot();
  try {
    await expectRejectedDiagnostic(
      publishGeneratedOutputs(
        options(root, [
          {
            path: "src/app/page.tsx",
            content: "export default function Page( {",
          },
        ]),
      ),
      "NXHX-TRANSACTION-SYNTAX-0006",
    );
    assert.equal(existsSync(path.join(root, "src/app/page.tsx")), false);
    assert.equal(existsSync(path.join(root, MANIFEST_PATH)), false);
    assert.equal(existsSync(path.join(root, JOURNAL_PATH)), false);
    assert.equal(existsSync(path.join(root, LOCK_PATH)), false);

    await expectRejectedDiagnostic(
      publishGeneratedOutputs(
        options(
          root,
          [{ path: "src/app/page.tsx", content: "export const value = 1;\n" }],
          {
            formatter: () => {
              throw new Error("formatter sentinel");
            },
          },
        ),
      ),
      "NXHX-TRANSACTION-FORMAT-0005",
    );
    assert.equal(existsSync(path.join(root, "src/app/page.tsx")), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("journal v1 is closed, canonical, schema-valid, and semantically checked", () => {
  const journal = createPublicationJournal({
    transactionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    phase: "prepared",
    manifestPath: MANIFEST_PATH,
    allowedOutputRoots: ["src/app"],
    allowedOutputFiles: [],
    previousManifestSha256: null,
    previousManifestMode: null,
    intendedManifestSha256: "a".repeat(64),
    intendedManifestMode: 0o644,
    changes: [
      {
        path: "src/app/page.tsx",
        disposition: "create",
        previousOwnershipSha256: null,
        intendedOwnershipSha256: "b".repeat(64),
        previousSha256: null,
        intendedSha256: "b".repeat(64),
        previousMode: null,
        intendedMode: 0o644,
      },
    ],
  });
  const encoded = encodePublicationJournal(journal);
  assert.equal(
    encodePublicationJournal(parsePublicationJournal(JSON.parse(encoded))),
    encoded,
  );
  const schema = JSON.parse(
    readFileSync(TRANSACTION_SCHEMA_PATH, "utf8"),
  ) as AnySchemaObject;
  assert.equal(schema.$id, PUBLICATION_JOURNAL_SCHEMA_ID);
  const validate = new Ajv2020({ allErrors: true, strict: true }).compile(
    schema,
  );
  assert.equal(
    validate(JSON.parse(encoded)),
    true,
    JSON.stringify(validate.errors),
  );
  const legacy = JSON.parse(encoded) as {
    changes: Array<Record<string, unknown>>;
  };
  for (const change of legacy.changes) {
    delete change.previousOwnershipSha256;
    delete change.intendedOwnershipSha256;
  }
  assert.deepEqual(
    parsePublicationJournal(legacy).changes,
    journal.changes,
    "legacy v1 entries derive ownership from their live-file digests",
  );
  const invalid = JSON.parse(encoded) as Record<string, unknown>;
  invalid.unknown = true;
  assert.throws(
    () => parsePublicationJournal(invalid),
    (error) =>
      expectPublicationDiagnostic(error, "NXHX-TRANSACTION-JOURNAL-0002") !==
      null,
  );
  const colliding = JSON.parse(encoded) as Record<string, unknown>;
  colliding.manifestPath = ".nextjshx/transaction.json";
  assert.equal(validate(colliding), false);
  assert.throws(
    () => parsePublicationJournal(colliding),
    (error) =>
      expectPublicationDiagnostic(error, "NXHX-TRANSACTION-JOURNAL-0002") !==
      null,
  );

  const exactFileJournal = createPublicationJournal({
    transactionId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    phase: "prepared",
    manifestPath: MANIFEST_PATH,
    allowedOutputRoots: ["src/app"],
    allowedOutputFiles: ["src/proxy.ts"],
    previousManifestSha256: null,
    previousManifestMode: null,
    intendedManifestSha256: "c".repeat(64),
    intendedManifestMode: 0o644,
    changes: [
      {
        path: "src/proxy.ts",
        disposition: "create",
        previousOwnershipSha256: null,
        intendedOwnershipSha256: "d".repeat(64),
        previousSha256: null,
        intendedSha256: "d".repeat(64),
        previousMode: null,
        intendedMode: 0o644,
      },
    ],
  });
  const widened = JSON.parse(
    encodePublicationJournal(exactFileJournal),
  ) as Record<string, unknown>;
  const widenedChanges = widened.changes as Array<Record<string, unknown>>;
  const widenedChange = widenedChanges[0];
  assert(widenedChange !== undefined);
  widenedChange.path = "src/unrelated.ts";
  assert.throws(
    () => parsePublicationJournal(widened),
    (error) =>
      expectPublicationDiagnostic(error, "NXHX-TRANSACTION-JOURNAL-0002") !==
      null,
  );
});

test("publishes create/update/remove atomically, manifest last, without rewriting unchanged files", async () => {
  const root = fixtureRoot();
  try {
    const previousManifest = await previousState(root);
    const unchangedPath = path.join(root, "src/app/a/page.tsx");
    const before = statSync(unchangedPath, { bigint: true });
    const events: PublicationFaultPoint[] = [];
    let manifestReplaced = false;
    const result = await publishGeneratedOutputs(
      options(root, INTENDED, {
        faultInjector(point): void {
          events.push(point);
          if (point.kind === "output-published") {
            assert.equal(live(root, MANIFEST_PATH), previousManifest);
          }
          if (point.kind === "manifest-published") {
            manifestReplaced = true;
            assert.notEqual(live(root, MANIFEST_PATH), previousManifest);
          }
        },
        postValidate(): void {
          assert.equal(manifestReplaced, true);
          assert.equal(live(root, "src/app/b/page.tsx"), INTENDED[1]?.content);
          assert.equal(live(root, "src/app/c/page.tsx"), INTENDED[2]?.content);
          assert.equal(
            existsSync(path.join(root, "src/app/d/page.tsx")),
            false,
          );
        },
      }),
    );
    const after = statSync(unchangedPath, { bigint: true });
    assert.deepEqual(result.created, ["src/app/c/page.tsx"]);
    assert.deepEqual(result.updated, ["src/app/b/page.tsx"]);
    assert.deepEqual(result.unchanged, ["src/app/a/page.tsx"]);
    assert.deepEqual(result.removed, ["src/app/d/page.tsx"]);
    assert.equal(before.ino, after.ino);
    assert.equal(before.mtimeNs, after.mtimeNs);
    assert.equal(statSync(path.join(root, "src/app/c")).mode & 0o777, 0o755);
    assert.deepEqual(
      events
        .filter((event) => event.kind === "output-published")
        .map((event) => (event as { readonly path: string }).path),
      ["src/app/b/page.tsx", "src/app/c/page.tsx", "src/app/d/page.tsx"],
    );
    assert.equal(existsSync(path.join(root, JOURNAL_PATH)), false);
    assert.equal(existsSync(path.join(root, LOCK_PATH)), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("adopts and releases one byte-identical adapter without rewriting the live file", async () => {
  const root = fixtureRoot();
  const fixture = {
    path: "src/app/adopted/page.tsx",
    content: "export const value = 'native';\n",
    source: "fixture.Adopted",
  };
  try {
    const target = path.join(root, ...fixture.path.split("/"));
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, fixture.content, { encoding: "utf8", mode: 0o640 });
    const before = statSync(target);

    const adopted = await publishGeneratedOutputs(
      options(root, [fixture], {
        transfer: { operation: "adopt", path: fixture.path },
      }),
    );
    const afterAdopt = statSync(target);
    assert.equal(adopted.action, "published");
    assert.deepEqual(adopted.unchanged, [fixture.path]);
    assert.equal(afterAdopt.ino, before.ino);
    assert.equal(afterAdopt.mode & 0o777, 0o640);
    assert.equal(live(root, fixture.path), fixture.content);

    const released = await publishGeneratedOutputs(
      options(root, [], {
        transfer: { operation: "release", path: fixture.path },
      }),
    );
    const afterRelease = statSync(target);
    assert.equal(released.action, "published");
    assert.deepEqual(released.unchanged, [fixture.path]);
    assert.equal(afterRelease.ino, before.ino);
    assert.equal(afterRelease.mode & 0o777, 0o640);
    assert.equal(live(root, fixture.path), fixture.content);
    assert.equal(JSON.parse(live(root, MANIFEST_PATH)).outputs.length, 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("repair restores modified or missing output and validation failure restores exact prior state", async () => {
  const root = fixtureRoot();
  const fixture = {
    path: "src/app/repaired/page.tsx",
    content: "export const value = 'generated';\n",
    source: "fixture.Repaired",
  };
  try {
    await publishGeneratedOutputs(options(root, [fixture]));
    const target = path.join(root, ...fixture.path.split("/"));
    const manifestBefore = live(root, MANIFEST_PATH);
    writeFileSync(target, "export const value = 'locally modified';\n", {
      encoding: "utf8",
    });
    chmodSync(target, 0o640);
    await assert.rejects(
      publishGeneratedOutputs(
        options(root, [fixture], {
          transfer: { operation: "repair", path: fixture.path },
          postValidate: () => {
            throw new Error("validation failed");
          },
        }),
      ),
    );
    assert.equal(
      live(root, fixture.path),
      "export const value = 'locally modified';\n",
    );
    assert.equal(statSync(target).mode & 0o777, 0o640);
    assert.equal(live(root, MANIFEST_PATH), manifestBefore);

    await publishGeneratedOutputs(
      options(root, [fixture], {
        transfer: { operation: "repair", path: fixture.path },
      }),
    );
    assert.equal(live(root, fixture.path), fixture.content);

    rmSync(target);
    await publishGeneratedOutputs(
      options(root, [fixture], {
        transfer: { operation: "repair", path: fixture.path },
      }),
    );
    assert.equal(live(root, fixture.path), fixture.content);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("repair crash recovery restores the exact modified bytes and ownership manifest", async () => {
  const root = fixtureRoot();
  const fixture = {
    path: "src/app/crash-repair/page.tsx",
    content: "export const value = 'generated';\n",
    source: "fixture.CrashRepair",
  };
  try {
    await publishGeneratedOutputs(options(root, [fixture]));
    const target = path.join(root, ...fixture.path.split("/"));
    const modified = "export const value = 'modified before repair';\n";
    const manifest = live(root, MANIFEST_PATH);
    writeFileSync(target, modified, "utf8");
    chmodSync(target, 0o640);

    await assert.rejects(
      publishGeneratedOutputs(
        options(root, [fixture], {
          transfer: { operation: "repair", path: fixture.path },
          faultInjector(point): void {
            if (point.kind === "output-published") {
              throw new PublicationCrashSimulationError(point);
            }
          },
        }),
      ),
      PublicationCrashSimulationError,
    );
    assert.equal(live(root, fixture.path), fixture.content);

    const recovered = await recoverGeneratedOutputPublication({
      projectRoot: root,
    });
    assert.equal(recovered.action, "rolled-back");
    assert.equal(live(root, fixture.path), modified);
    assert.equal(statSync(target).mode & 0o777, 0o640);
    assert.equal(live(root, MANIFEST_PATH), manifest);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

for (const operation of ["adopt", "release", "repair"] as const) {
  test(`${operation} crash after manifest publication restores prior ownership and live bytes`, async () => {
    const root = fixtureRoot();
    const fixture = {
      path: `src/app/${operation}-manifest-crash/page.tsx`,
      content: `export const value = '${operation}';\n`,
      source: `fixture.${operation}`,
    };
    try {
      const target = path.join(root, ...fixture.path.split("/"));
      mkdirSync(path.dirname(target), { recursive: true });
      if (operation === "adopt") {
        writeFileSync(target, fixture.content, "utf8");
      } else {
        await publishGeneratedOutputs(options(root, [fixture]));
      }
      if (operation === "repair") {
        writeFileSync(target, "export const value = 'modified';\n", "utf8");
        chmodSync(target, 0o640);
      }
      const previousManifest = existsSync(path.join(root, MANIFEST_PATH))
        ? live(root, MANIFEST_PATH)
        : null;
      const previousBytes = live(root, fixture.path);
      const previousMode = statSync(target).mode & 0o777;

      await assert.rejects(
        publishGeneratedOutputs(
          options(root, operation === "release" ? [] : [fixture], {
            transfer: { operation, path: fixture.path },
            faultInjector(point): void {
              if (point.kind === "manifest-published") {
                throw new PublicationCrashSimulationError(point);
              }
            },
          }),
        ),
        PublicationCrashSimulationError,
      );

      const recovered = await recoverGeneratedOutputPublication({
        projectRoot: root,
      });
      assert.equal(recovered.action, "rolled-back");
      assert.equal(live(root, fixture.path), previousBytes);
      assert.equal(statSync(target).mode & 0o777, previousMode);
      if (previousManifest === null) {
        assert.equal(existsSync(path.join(root, MANIFEST_PATH)), false);
      } else {
        assert.equal(live(root, MANIFEST_PATH), previousManifest);
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
}

test("publishes a configured nested control manifest atomically", async () => {
  const root = fixtureRoot();
  const nestedManifest = ".nextjshx/state/owned.json";
  try {
    const result = await publishGeneratedOutputs(
      options(
        root,
        [{ path: "src/app/page.tsx", content: "export const value = 1;\n" }],
        { manifestPath: nestedManifest },
      ),
    );
    assert.equal(result.action, "published");
    assert.match(live(root, nestedManifest), /nextjshx\.generated-output/);
    assert.equal(existsSync(path.join(root, MANIFEST_PATH)), false);
    assert.equal(existsSync(path.join(root, JOURNAL_PATH)), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("post-publication validation failure restores exact prior adapters and modes", async () => {
  const root = fixtureRoot();
  try {
    const previousManifest = await previousState(root);
    const updatedPath = path.join(root, "src/app/b/page.tsx");
    chmodSync(updatedPath, 0o604);
    await expectRejectedDiagnostic(
      publishGeneratedOutputs(
        options(root, INTENDED, {
          postValidate(): never {
            throw new Error("typecheck sentinel");
          },
        }),
      ),
      "NXHX-TRANSACTION-VALIDATION-0008",
    );
    assertPreviousState(root, previousManifest);
    assert.equal(statSync(updatedPath).mode & 0o777, 0o604);
    assert.equal(existsSync(path.join(root, JOURNAL_PATH)), false);
    assert.equal(existsSync(path.join(root, LOCK_PATH)), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

const CRASH_CASES: ReadonlyArray<{
  readonly name: string;
  readonly matches: (point: PublicationFaultPoint) => boolean;
}> = [
  {
    name: "prepared journal",
    matches: (point) => point.kind === "journal-prepared",
  },
  {
    name: "publishing phase",
    matches: (point) => point.kind === "phase-publishing",
  },
  {
    name: "updated output",
    matches: (point) =>
      point.kind === "output-published" && point.path === "src/app/b/page.tsx",
  },
  {
    name: "created output",
    matches: (point) =>
      point.kind === "output-published" && point.path === "src/app/c/page.tsx",
  },
  {
    name: "removed output",
    matches: (point) =>
      point.kind === "output-published" && point.path === "src/app/d/page.tsx",
  },
  {
    name: "manifest rename",
    matches: (point) => point.kind === "manifest-published",
  },
  {
    name: "published phase",
    matches: (point) => point.kind === "phase-published",
  },
];

for (const crashCase of CRASH_CASES) {
  test(`recovers a simulated crash after ${crashCase.name}`, async () => {
    const root = fixtureRoot();
    try {
      const previousManifest = await previousState(root);
      await assert.rejects(
        publishGeneratedOutputs(
          options(root, INTENDED, {
            faultInjector(point): void {
              if (crashCase.matches(point)) {
                throw new PublicationCrashSimulationError(point);
              }
            },
          }),
        ),
        PublicationCrashSimulationError,
      );
      assert.equal(existsSync(path.join(root, JOURNAL_PATH)), true);
      assert.equal(existsSync(path.join(root, LOCK_PATH)), false);
      const recovery = await recoverGeneratedOutputPublication({
        projectRoot: root,
      });
      assert.equal(recovery.action, "rolled-back");
      assertPreviousState(root, previousManifest);
      assert.equal(existsSync(path.join(root, JOURNAL_PATH)), false);
      assert.equal(existsSync(path.join(root, LOCK_PATH)), false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
}

const ROLLBACK_CRASH_CASES: ReadonlyArray<{
  readonly name: string;
  readonly matches: (point: PublicationFaultPoint) => boolean;
}> = [
  {
    name: "rollback phase",
    matches: (point) => point.kind === "phase-rolling-back",
  },
  {
    name: "manifest restoration",
    matches: (point) => point.kind === "manifest-restored",
  },
  {
    name: "removed-output restoration",
    matches: (point) =>
      point.kind === "output-restored" && point.path === "src/app/d/page.tsx",
  },
  {
    name: "created-output removal",
    matches: (point) =>
      point.kind === "output-restored" && point.path === "src/app/c/page.tsx",
  },
  {
    name: "updated-output restoration",
    matches: (point) =>
      point.kind === "output-restored" && point.path === "src/app/b/page.tsx",
  },
];

for (const crashCase of ROLLBACK_CRASH_CASES) {
  test(`resumes a second crash after ${crashCase.name}`, async () => {
    const root = fixtureRoot();
    try {
      const previousManifest = await previousState(root);
      await assert.rejects(
        publishGeneratedOutputs(
          options(root, INTENDED, {
            faultInjector(point): void {
              if (point.kind === "phase-published") {
                throw new PublicationCrashSimulationError(point);
              }
            },
          }),
        ),
        PublicationCrashSimulationError,
      );
      await assert.rejects(
        recoverGeneratedOutputPublication({
          projectRoot: root,
          faultInjector(point): void {
            if (crashCase.matches(point)) {
              throw new PublicationCrashSimulationError(point);
            }
          },
        }),
        PublicationCrashSimulationError,
      );
      assert.equal(existsSync(path.join(root, JOURNAL_PATH)), true);
      const recovery = await recoverGeneratedOutputPublication({
        projectRoot: root,
      });
      assert.equal(recovery.action, "rolled-back");
      assertPreviousState(root, previousManifest);
      assert.equal(existsSync(path.join(root, JOURNAL_PATH)), false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
}

test("published crash recovery can rerun validation and commit intended bytes", async () => {
  const root = fixtureRoot();
  try {
    await previousState(root);
    await assert.rejects(
      publishGeneratedOutputs(
        options(root, INTENDED, {
          faultInjector(point): void {
            if (point.kind === "phase-published") {
              throw new PublicationCrashSimulationError(point);
            }
          },
        }),
      ),
      PublicationCrashSimulationError,
    );
    let validated = false;
    const recovery = await recoverGeneratedOutputPublication({
      projectRoot: root,
      postValidate(): void {
        validated = true;
        assert.equal(live(root, "src/app/b/page.tsx"), INTENDED[1]?.content);
      },
    });
    assert.equal(validated, true);
    assert.equal(recovery.action, "committed");
    assert.equal(live(root, "src/app/c/page.tsx"), INTENDED[2]?.content);
    assert.equal(existsSync(path.join(root, "src/app/d/page.tsx")), false);
    assert.equal(existsSync(path.join(root, JOURNAL_PATH)), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("committed-phase crash recovery keeps validated intended bytes", async () => {
  const root = fixtureRoot();
  try {
    await previousState(root);
    await assert.rejects(
      publishGeneratedOutputs(
        options(root, INTENDED, {
          postValidate(): void {},
          faultInjector(point): void {
            if (point.kind === "phase-committed") {
              throw new PublicationCrashSimulationError(point);
            }
          },
        }),
      ),
      PublicationCrashSimulationError,
    );
    const recovery = await recoverGeneratedOutputPublication({
      projectRoot: root,
    });
    assert.equal(recovery.action, "committed");
    assert.equal(live(root, "src/app/b/page.tsx"), INTENDED[1]?.content);
    assert.equal(live(root, "src/app/c/page.tsx"), INTENDED[2]?.content);
    assert.equal(existsSync(path.join(root, "src/app/d/page.tsx")), false);
    assert.equal(existsSync(path.join(root, JOURNAL_PATH)), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("recovery stops without touching an unexpected live file", async () => {
  const root = fixtureRoot();
  try {
    const previousManifest = await previousState(root);
    await assert.rejects(
      publishGeneratedOutputs(
        options(root, INTENDED, {
          faultInjector(point): void {
            if (
              point.kind === "output-published" &&
              point.path === "src/app/b/page.tsx"
            ) {
              throw new PublicationCrashSimulationError(point);
            }
          },
        }),
      ),
      PublicationCrashSimulationError,
    );
    writeFileSync(
      path.join(root, "src/app/b/page.tsx"),
      "// hand-edited sentinel\n",
      "utf8",
    );
    await expectRejectedDiagnostic(
      recoverGeneratedOutputPublication({ projectRoot: root }),
      "NXHX-TRANSACTION-STATE-0003",
    );
    assert.equal(live(root, "src/app/b/page.tsx"), "// hand-edited sentinel\n");
    assert.equal(live(root, "src/app/d/page.tsx"), PREVIOUS[2]?.content);
    assert.equal(live(root, MANIFEST_PATH), previousManifest);
    assert.equal(existsSync(path.join(root, JOURNAL_PATH)), true);
    assert.equal(existsSync(path.join(root, LOCK_PATH)), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("concurrent publishers cannot race", async () => {
  const root = fixtureRoot();
  let formatterEntered: () => void = () => {};
  let releaseFormatter: () => void = () => {};
  const entered = new Promise<void>((resolve) => {
    formatterEntered = resolve;
  });
  const gate = new Promise<void>((resolve) => {
    releaseFormatter = resolve;
  });
  try {
    const first = publishGeneratedOutputs(
      options(
        root,
        [{ path: "src/app/page.tsx", content: "export const value = 1;\n" }],
        {
          async formatter(outputValue): Promise<string | Uint8Array> {
            formatterEntered();
            await gate;
            return outputValue.content;
          },
        },
      ),
    );
    await entered;
    await expectRejectedDiagnostic(
      publishGeneratedOutputs(
        options(root, [
          {
            path: "src/app/other/page.tsx",
            content: "export const value = 2;\n",
          },
        ]),
      ),
      "NXHX-TRANSACTION-LOCKED-0001",
    );
    releaseFormatter();
    assert.equal((await first).action, "published");
  } finally {
    releaseFormatter();
    rmSync(root, { recursive: true, force: true });
  }
});

test("recovery alone clears a provably stale same-host lock", async () => {
  const root = fixtureRoot();
  try {
    mkdirSync(path.join(root, ".nextjshx"), { recursive: true });
    writeFileSync(
      path.join(root, LOCK_PATH),
      `${JSON.stringify(
        {
          protocol: "nextjshx.generated-output-lock",
          version: 1,
          nonce: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          transactionId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          pid: 99_999_999,
          hostname: hostname(),
        },
        null,
        2,
      )}\n`,
      { encoding: "utf8", mode: 0o600 },
    );
    const result = await recoverGeneratedOutputPublication({
      projectRoot: root,
    });
    assert.equal(result.action, "none");
    assert.equal(existsSync(path.join(root, LOCK_PATH)), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
