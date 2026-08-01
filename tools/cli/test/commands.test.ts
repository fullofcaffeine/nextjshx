import assert from "node:assert/strict";
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  CliDiagnosticError,
  type AdapterIntent,
  type AdapterPlan,
  type BoundaryPlan,
  type CommandRuntime,
  type ProcessRequest,
  type ProcessResult,
  OwnershipDiagnosticError,
  PublicationCrashSimulationError,
  PublicationDiagnosticError,
  parseAdapterPlan,
  parseBoundaryPlan,
  runCli,
  runBoundariesCommand,
  runBuildCommand,
  runCleanCommand,
  runDoctorCommand,
  runGenerateCommand,
  runOwnershipTransferCommand,
  runRoutesCommand,
  runTypecheckCommand,
} from "../src/index.js";

const PLAN_DEFINE = "nextjshx.adapter-plan-output=";
const BOUNDARY_PLAN_DEFINE = "nextjshx.boundary-plan-output=";
const APP_ROOT_DEFINE = "nextjshx.app-root=src/app";
const GENERATED_ROOT_DEFINE = "nextjshx.generated-root=src-gen";
const FIXED_UUID = "11111111-1111-4111-8111-111111111111";

interface FakeToolchain {
  plan: AdapterPlan;
  boundaryPlan: BoundaryPlan;
  afterBuildPlan?: AdapterPlan;
  routeParityFiles?: readonly string[];
  routeParitySource?: string;
  gitCommit: string;
  emitGeneratedRoot: boolean;
  haxeExit: number;
  nextExit: number;
  nextBuildExit: number;
  nextBuildOutput: string;
  routeParityExit: number;
  typescriptExit: number;
  readonly requests: ProcessRequest[];
}

function emptyBoundaryPlan(): BoundaryPlan {
  return parseBoundaryPlan({
    $schema: "https://nextjshx.dev/schemas/boundary-plan-v1.json",
    schemaVersion: 1,
    boundaries: [],
  });
}

function clientBoundaryPlan(owner: string, targetPath: string): BoundaryPlan {
  const shortName = owner.split(".").at(-1) as string;
  return parseBoundaryPlan({
    $schema: "https://nextjshx.dev/schemas/boundary-plan-v1.json",
    schemaVersion: 1,
    boundaries: [
      {
        kind: "client",
        moduleName: owner,
        ownerName: owner,
        signal: ":next.clientComponent",
        position: sourcePosition(shortName),
        references: [
          {
            kind: "server-function",
            targetOwner: "fixture.Actions",
            targetField: "save",
            targetPath: "_nextjshx/action/save.ts",
            position: sourcePosition(shortName),
          },
        ],
        dependencies: [
          {
            moduleName: "fixture.Shared",
            classification: "shared-pure",
            position: sourcePosition(shortName),
          },
        ],
      },
    ],
  });
}

function writeJson(file: string, value: unknown): void {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function sourcePosition(typeName: string): Record<string, unknown> {
  return {
    file: `src/routes/${typeName}.hx`,
    startLine: 1,
    startCharacter: 1,
    endLine: 2,
    endCharacter: 1,
  };
}

interface IntentOptions {
  readonly targetPath: string;
  readonly segmentPath: string;
  readonly typeName: string;
  readonly kind?: AdapterIntent["kind"];
  readonly sourceField?: string;
}

function intentValue(options: IntentOptions): Record<string, unknown> {
  const sourceField = options.sourceField ?? "render";
  const shortName = options.typeName.split(".").at(-1) as string;
  const position = sourcePosition(shortName);
  const clientComponent = options.kind === "client-component";
  const page = options.kind === undefined || options.kind === "page";
  const publicRoute =
    options.segmentPath === "" ? "/" : `/${options.segmentPath}`;
  const adapterPath = path.posix.join("src/app", options.targetPath);
  const modulePath = path.posix.relative(
    path.posix.dirname(adapterPath),
    `src-gen/${shortName}`,
  );
  return {
    kind: options.kind ?? "page",
    source: {
      typeName: options.typeName,
      fieldName: sourceField,
      typePosition: position,
      fieldPosition: position,
      metadataPosition: position,
    },
    segmentPath: options.segmentPath,
    targetPath: options.targetPath,
    implementation: {
      modulePath,
      symbol: shortName,
    },
    imports: [
      {
        modulePath,
        symbol: shortName,
        alias: null,
        typeOnly: false,
      },
      ...(clientComponent
        ? [
            {
              modulePath: "react",
              symbol: "ComponentType",
              alias: null,
              typeOnly: true,
            },
          ]
        : page
          ? [
              {
                modulePath: "react",
                symbol: "JSX",
                alias: null,
                typeOnly: true,
              },
            ]
          : []),
    ],
    directives: clientComponent ? ["use client"] : [],
    exports: [
      {
        kind: "default",
        name: "default",
        sourceField,
        signature: clientComponent
          ? `ComponentType<Parameters<typeof ${shortName}.render>[0]>`
          : page
            ? `(props: PageProps<${JSON.stringify(publicRoute)}>) => JSX.Element`
            : "() => null",
      },
    ],
    config: [],
  };
}

function plan(...intents: readonly Record<string, unknown>[]): AdapterPlan {
  const sorted = [...intents].sort((left, right) =>
    Buffer.from(left.targetPath as string).compare(
      Buffer.from(right.targetPath as string),
    ),
  );
  return parseAdapterPlan({
    $schema: "https://nextjshx.dev/schemas/adapter-plan.schema.json",
    schemaVersion: 1,
    toolchain: {
      nextjshx: "0.0.0-development",
      haxe: "4.3.7",
      genesTs: "1.41.0+0b7a4ca9d10682baeeb6a457ac666a02b7dc2376",
      next: "16.2.12",
    },
    intents: sorted,
  });
}

function simplePlan(name = "Page", variant = "base"): AdapterPlan {
  const intent = intentValue({
    targetPath: `${name.toLowerCase()}/page.tsx`,
    segmentPath: name.toLowerCase(),
    typeName: `fixture.${name}`,
  });
  if (variant !== "base" && variant !== "render") {
    intent.config = [
      { name: "runtime", value: { kind: "string", value: "edge" } },
    ];
  }
  return plan(intent);
}

function proxyIntentValue(): Record<string, unknown> {
  const position = sourcePosition("RequestProxy");
  return {
    kind: "proxy",
    source: {
      typeName: "fixture.RequestProxy",
      fieldName: "proxy",
      typePosition: position,
      fieldPosition: position,
      metadataPosition: position,
    },
    segmentPath: "",
    targetPath: "proxy.ts",
    implementation: {
      modulePath: "../src-gen/RequestProxy",
      symbol: "RequestProxy",
    },
    imports: [
      {
        modulePath: "../src-gen/RequestProxy",
        symbol: "RequestProxy",
        alias: null,
        typeOnly: false,
      },
      {
        modulePath: "next/server",
        symbol: "NextProxy",
        alias: "NextJsHxProxy",
        typeOnly: true,
      },
      {
        modulePath: "next/server",
        symbol: "ProxyConfig",
        alias: "NextJsHxProxyConfig",
        typeOnly: true,
      },
    ],
    directives: [],
    exports: [
      {
        kind: "named",
        name: "proxy",
        sourceField: "proxy",
        signature: "NextJsHxProxy",
      },
    ],
    config: [
      {
        name: "matcher",
        value: {
          kind: "string-array",
          value: ["/haxe", "/products/:path*"],
        },
      },
    ],
  };
}

function fixtureRoot(): string {
  const root = mkdtempSync(path.join(os.tmpdir(), "nextjshx-commands-"));
  mkdirSync(path.join(root, "src/app"), { recursive: true });
  writeJson(path.join(root, "package.json"), {
    name: "nextjshx-command-fixture",
    private: true,
    packageManager: "npm@10.8.2",
    scripts: {
      generate: "nextjshx generate",
      typecheck: "nextjshx typecheck",
    },
    dependencies: {
      next: "16.2.12",
      react: "19.2.7",
      "react-dom": "19.2.7",
    },
    devDependencies: {
      typescript: "6.0.2",
    },
  });
  writeJson(path.join(root, "package-lock.json"), {
    name: "nextjshx-command-fixture",
    lockfileVersion: 3,
  });
  writeJson(path.join(root, "nextjshx.config.json"), {
    $schema: "https://nextjshx.dev/schemas/config-v1.json",
    schemaVersion: 1,
    appRoot: "src/app",
    haxe: {
      hxml: "build.hxml",
      generatedRoot: "src-gen",
      defines: ["genes.ts", "genes.ts.no_extension"],
    },
    next: {
      package: "next",
      typedRoutes: true,
    },
    output: {
      manifest: ".nextjshx/manifest.json",
      format: "project",
    },
  });
  writeFileSync(
    path.join(root, "build.hxml"),
    "-cp src\n-main fixture.Main\n-js src-gen/main.js\n",
    "utf8",
  );
  writeFileSync(
    path.join(root, "src/index.ts"),
    "export const fixture = true;\n",
    "utf8",
  );
  writeJson(path.join(root, "tsconfig.json"), {
    compilerOptions: {
      strict: true,
      noEmit: true,
    },
    include: [".next/types/**/*.ts", "src/**/*.ts", "src/**/*.tsx"],
  });
  for (const [name, version] of [
    ["next", "16.2.12"],
    ["react", "19.2.7"],
    ["react-dom", "19.2.7"],
    ["typescript", "6.0.2"],
  ] as const) {
    writeJson(path.join(root, "node_modules", name, "package.json"), {
      name,
      version,
    });
  }
  return root;
}

function success(): ProcessResult {
  return Object.freeze({ exitCode: 0, stdout: "", stderr: "" });
}

function writeGeneratedImplementations(root: string, value: AdapterPlan): void {
  const generatedRoot = path.resolve(root, "src-gen");
  for (const intent of value.intents) {
    const outputPath =
      intent.kind === "proxy"
        ? "src/proxy.ts"
        : path.posix.join("src/app", intent.targetPath);
    const implementation = path.resolve(
      root,
      path.dirname(outputPath.split("/").join(path.sep)),
      intent.implementation.modulePath,
    );
    assert(
      implementation.startsWith(`${generatedRoot}${path.sep}`),
      `fake implementation remains under src-gen: ${implementation}`,
    );
    const file = `${implementation}.ts`;
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(
      file,
      `export class ${intent.implementation.symbol} { static ${intent.source.fieldName} = () => null; }\n`,
      "utf8",
    );
  }
}

function runtimeFor(state: FakeToolchain): CommandRuntime {
  return {
    haxeCommand: { command: "fake-haxe", argsPrefix: [] },
    nextCommand: { command: "fake-next", argsPrefix: [] },
    typescriptCommand: { command: "fake-tsc", argsPrefix: [] },
    uuid: () => FIXED_UUID,
    processRunner: (request): ProcessResult => {
      state.requests.push(request);
      if (request.source === "git") {
        return Object.freeze({
          exitCode: 0,
          stdout: `${state.gitCommit}\n`,
          stderr: "",
        });
      }
      if (request.source === "haxe") {
        if (request.args.includes("--version")) {
          return Object.freeze({ exitCode: 0, stdout: "4.3.7\n", stderr: "" });
        }
        if (state.haxeExit !== 0) {
          return Object.freeze({
            exitCode: state.haxeExit,
            stdout: "",
            stderr: "fixture Haxe failure",
          });
        }
        const define = request.args.find((argument) =>
          argument.startsWith(PLAN_DEFINE),
        );
        assert(
          define !== undefined,
          "Haxe invocation carries the unique plan define",
        );
        const relative = define.slice(PLAN_DEFINE.length);
        writeJson(path.join(request.cwd, ...relative.split("/")), state.plan);
        const boundaryDefine = request.args.find((argument) =>
          argument.startsWith(BOUNDARY_PLAN_DEFINE),
        );
        assert(
          boundaryDefine !== undefined,
          "Haxe invocation carries the boundary-plan define",
        );
        const boundaryRelative = boundaryDefine.slice(
          BOUNDARY_PLAN_DEFINE.length,
        );
        writeJson(
          path.join(request.cwd, ...boundaryRelative.split("/")),
          state.boundaryPlan,
        );
        if (!request.args.includes("--no-output") && state.emitGeneratedRoot) {
          mkdirSync(path.join(request.cwd, "src-gen"), { recursive: true });
          writeFileSync(
            path.join(request.cwd, "src-gen/main.ts"),
            "export const generatedByHaxe = true;\n",
            "utf8",
          );
          writeGeneratedImplementations(request.cwd, state.plan);
        }
        return success();
      }
      if (request.source === "next" && state.nextExit !== 0) {
        return Object.freeze({
          exitCode: state.nextExit,
          stdout: "",
          stderr: "fixture Next typegen failure",
        });
      }
      if (request.source === "next-build") {
        if (state.nextBuildExit !== 0) {
          return Object.freeze({
            exitCode: state.nextBuildExit,
            stdout: state.nextBuildOutput,
            stderr: "fixture Next production-build failure",
          });
        }
        if (state.afterBuildPlan !== undefined) {
          state.plan = state.afterBuildPlan;
        }
        return Object.freeze({
          exitCode: 0,
          stdout: state.nextBuildOutput,
          stderr: "",
        });
      }
      if (request.source === "tsc") {
        const projectIndex = request.args.indexOf("--project");
        const project =
          projectIndex === -1 ? undefined : request.args[projectIndex + 1];
        const routeParity = project?.endsWith(".routes.json") === true;
        if (routeParity) {
          const config = JSON.parse(
            readFileSync(path.join(request.cwd, project), "utf8"),
          ) as {
            readonly exclude?: unknown;
            readonly files: readonly string[];
            readonly include?: unknown;
          };
          assert.deepEqual(config.files, [
            `${FIXED_UUID}.routes.ts`,
            "../../next-env.d.ts",
          ]);
          assert.equal(config.include, undefined);
          assert.equal(config.exclude, undefined);
          state.routeParityFiles = config.files;
          state.routeParitySource = readFileSync(
            path.join(
              request.cwd,
              path.dirname(project),
              config.files[0] as string,
            ),
            "utf8",
          );
        }
        const exitCode = routeParity
          ? state.routeParityExit
          : state.typescriptExit;
        if (exitCode !== 0) {
          return Object.freeze({
            exitCode,
            stdout: "",
            stderr: routeParity
              ? "fixture route parity failure"
              : "fixture TypeScript failure",
          });
        }
      }
      return success();
    },
  };
}

function stateFor(value: AdapterPlan): FakeToolchain {
  return {
    plan: value,
    boundaryPlan: emptyBoundaryPlan(),
    gitCommit: "491f78099c3ea23be14e66c6d848b50204590e90",
    emitGeneratedRoot: true,
    haxeExit: 0,
    nextExit: 0,
    nextBuildExit: 0,
    nextBuildOutput: "▲ Next.js 16.2.12\n  Running TypeScript ...\n",
    routeParityExit: 0,
    typescriptExit: 0,
    requests: [],
  };
}

function read(root: string, relative: string): string {
  return readFileSync(path.join(root, ...relative.split("/")), "utf8");
}

test("generate reports create/update/unchanged/remove after full validation", async () => {
  const root = fixtureRoot();
  try {
    const previous = plan(
      intentValue({
        targetPath: "a/page.tsx",
        segmentPath: "a",
        typeName: "fixture.A",
      }),
      intentValue({
        targetPath: "b/page.tsx",
        segmentPath: "b",
        typeName: "fixture.B",
      }),
      intentValue({
        targetPath: "d/page.tsx",
        segmentPath: "d",
        typeName: "fixture.D",
      }),
    );
    const state = stateFor(previous);
    const runtime = runtimeFor(state);
    await runGenerateCommand({ start: root, runtime, validate: false });

    state.plan = plan(
      intentValue({
        targetPath: "a/page.tsx",
        segmentPath: "a",
        typeName: "fixture.A",
      }),
      Object.assign(
        intentValue({
          targetPath: "b/page.tsx",
          segmentPath: "b",
          typeName: "fixture.B",
        }),
        {
          config: [
            { name: "runtime", value: { kind: "string", value: "edge" } },
          ],
        },
      ),
      intentValue({
        targetPath: "c/page.tsx",
        segmentPath: "c",
        typeName: "fixture.C",
      }),
    );
    state.requests.length = 0;
    const result = await runGenerateCommand({ start: root, runtime });
    assert.equal(result.publication.action, "published");
    assert.deepEqual(result.publication.created, ["src/app/c/page.tsx"]);
    assert.deepEqual(result.publication.updated, ["src/app/b/page.tsx"]);
    assert.deepEqual(result.publication.unchanged, ["src/app/a/page.tsx"]);
    assert.deepEqual(result.publication.removed, ["src/app/d/page.tsx"]);
    assert.equal(result.validation, "passed");
    assert.deepEqual(
      state.requests.map((request) => request.source),
      ["haxe", "next", "tsc"],
    );
    assert.equal(existsSync(path.join(root, "src/app/d/page.tsx")), false);
    assert.equal(
      existsSync(path.join(root, ".nextjshx/transaction.json")),
      false,
    );
    assert.equal(existsSync(path.join(root, ".nextjshx/publish.lock")), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("generate owns only src/proxy.ts and refuses an existing native proxy", async () => {
  const root = fixtureRoot();
  try {
    const state = stateFor(plan(proxyIntentValue()));
    const result = await runGenerateCommand({
      start: root,
      runtime: runtimeFor(state),
      validate: false,
    });
    assert.deepEqual(result.publication.created, ["src/proxy.ts"]);
    assert.match(
      read(root, "src/proxy.ts"),
      /export const proxy: NextJsHxProxy/,
    );
    assert.match(
      read(root, "src/proxy.ts"),
      /export const config: NextJsHxProxyConfig/,
    );
    assert.equal(existsSync(path.join(root, "src/unrelated.ts")), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }

  const collisionRoot = fixtureRoot();
  try {
    const native = "// native proxy must remain untouched\n";
    writeFileSync(path.join(collisionRoot, "src/proxy.ts"), native, "utf8");
    const state = stateFor(plan(proxyIntentValue()));
    await assert.rejects(
      runGenerateCommand({
        start: collisionRoot,
        runtime: runtimeFor(state),
        validate: false,
      }),
      (error) => {
        assert(error instanceof OwnershipDiagnosticError);
        assert.equal(error.diagnostic.code, "NXHX-OWNERSHIP-UNOWNED-0008");
        assert.equal(error.diagnostic.target, "src/proxy.ts");
        return true;
      },
    );
    assert.equal(read(collisionRoot, "src/proxy.ts"), native);
    assert.equal(
      existsSync(path.join(collisionRoot, ".nextjshx/manifest.json")),
      false,
    );
  } finally {
    rmSync(collisionRoot, { recursive: true, force: true });
  }
});

test("generate leaves live adapters and manifest untouched when Haxe fails", async () => {
  const root = fixtureRoot();
  try {
    const state = stateFor(simplePlan("Before"));
    const runtime = runtimeFor(state);
    await runGenerateCommand({ start: root, runtime, validate: false });
    const beforeAdapter = read(root, "src/app/before/page.tsx");
    const beforeManifest = read(root, ".nextjshx/manifest.json");
    state.plan = simplePlan("After");
    state.haxeExit = 2;
    await assert.rejects(
      runGenerateCommand({ start: root, runtime, validate: false }),
      (error) => {
        assert(error instanceof CliDiagnosticError);
        assert.equal(error.diagnostic.code, "NXHX-CLI-HAXE-0003");
        return true;
      },
    );
    assert.equal(read(root, "src/app/before/page.tsx"), beforeAdapter);
    assert.equal(read(root, ".nextjshx/manifest.json"), beforeManifest);
    assert.equal(existsSync(path.join(root, "src/app/after/page.tsx")), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("generate restores exact previous bytes when post-publication validation fails", async () => {
  const root = fixtureRoot();
  try {
    const state = stateFor(simplePlan("Page", "render"));
    const runtime = runtimeFor(state);
    await runGenerateCommand({ start: root, runtime, validate: false });
    const beforeAdapter = read(root, "src/app/page/page.tsx");
    const beforeManifest = read(root, ".nextjshx/manifest.json");
    state.plan = simplePlan("Page", "renderV2");
    state.nextExit = 1;
    await assert.rejects(
      runGenerateCommand({ start: root, runtime }),
      (error) => {
        assert(error instanceof PublicationDiagnosticError);
        assert.equal(error.diagnostic.code, "NXHX-TRANSACTION-VALIDATION-0008");
        return true;
      },
    );
    assert.equal(read(root, "src/app/page/page.tsx"), beforeAdapter);
    assert.equal(read(root, ".nextjshx/manifest.json"), beforeManifest);
    assert.equal(
      existsSync(path.join(root, ".nextjshx/transaction.json")),
      false,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("clean treats a missing manifest as owning nothing", async () => {
  const root = fixtureRoot();
  try {
    const native = path.join(root, "src/app/native/page.tsx");
    mkdirSync(path.dirname(native), { recursive: true });
    writeFileSync(
      native,
      "export default function Native() { return null; }\n",
      "utf8",
    );

    const result = await runCleanCommand({
      start: root,
      runtime: runtimeFor(stateFor(simplePlan("Ignored"))),
    });

    assert.equal(result.action, "no-manifest");
    assert.deepEqual(result.removed, []);
    assert.equal(result.retainedManifest, false);
    assert.equal(existsSync(native), true);
    assert.equal(existsSync(path.join(root, ".nextjshx/manifest.json")), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("release, adopt, and repair transfer exactly one planned adapter", async () => {
  const root = fixtureRoot();
  try {
    const ownedPlan = simplePlan("Transfer");
    const state = stateFor(ownedPlan);
    const runtime = runtimeFor(state);
    await runGenerateCommand({ start: root, runtime, validate: false });
    const targetPath = "src/app/transfer/page.tsx";
    const target = path.join(root, targetPath);
    const generated = read(root, targetPath);
    const inode = statSync(target).ino;

    state.plan = plan();
    state.requests.length = 0;
    const released = await runOwnershipTransferCommand({
      start: root,
      runtime,
      operation: "release",
      path: targetPath,
    });
    assert.equal(released.validation, "passed");
    assert.equal(read(root, targetPath), generated);
    assert.equal(statSync(target).ino, inode);
    assert.deepEqual(
      state.requests.map((request) => request.source),
      ["haxe", "next", "tsc"],
    );

    state.plan = ownedPlan;
    state.requests.length = 0;
    const adopted = await runOwnershipTransferCommand({
      start: root,
      runtime,
      operation: "adopt",
      path: targetPath,
    });
    assert.equal(adopted.validation, "passed");
    assert.equal(read(root, targetPath), generated);
    assert.equal(statSync(target).ino, inode);

    writeFileSync(
      target,
      "export default function ReviewedEdit() { return null; }\n",
      "utf8",
    );
    const repaired = await runOwnershipTransferCommand({
      start: root,
      runtime,
      operation: "repair",
      path: targetPath,
    });
    assert.equal(repaired.validation, "passed");
    assert.equal(read(root, targetPath), generated);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("clean transactionally removes verified outputs and retains native siblings", async () => {
  const root = fixtureRoot();
  try {
    const state = stateFor(simplePlan("Owned"));
    const runtime = runtimeFor(state);
    await runGenerateCommand({ start: root, runtime, validate: false });
    const native = path.join(root, "src/app/owned/native.ts");
    writeFileSync(native, "export const native = true;\n", "utf8");

    const result = await runCleanCommand({ start: root, runtime });

    assert.equal(result.action, "cleaned");
    assert.deepEqual(result.removed, ["src/app/owned/page.tsx"]);
    assert.equal(result.retainedManifest, true);
    assert.equal(existsSync(path.join(root, "src/app/owned/page.tsx")), false);
    assert.equal(readFileSync(native, "utf8"), "export const native = true;\n");
    const manifest = JSON.parse(
      readFileSync(path.join(root, ".nextjshx/manifest.json"), "utf8"),
    ) as { readonly outputs: readonly unknown[] };
    assert.deepEqual(manifest.outputs, []);

    const repeated = await runCleanCommand({ start: root, runtime });
    assert.equal(repeated.action, "already-empty");
    assert.deepEqual(repeated.removed, []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("clean preflights the complete ownership set before deleting any output", async () => {
  const root = fixtureRoot();
  try {
    const state = stateFor(
      plan(
        intentValue({
          targetPath: "first/page.tsx",
          segmentPath: "first",
          typeName: "fixture.First",
        }),
        intentValue({
          targetPath: "second/page.tsx",
          segmentPath: "second",
          typeName: "fixture.Second",
        }),
      ),
    );
    const runtime = runtimeFor(state);
    await runGenerateCommand({ start: root, runtime, validate: false });
    const first = read(root, "src/app/first/page.tsx");
    const manifest = read(root, ".nextjshx/manifest.json");
    writeFileSync(
      path.join(root, "src/app/second/page.tsx"),
      "export default function ReviewedEdit() { return null; }\n",
      "utf8",
    );

    await assert.rejects(runCleanCommand({ start: root, runtime }), (error) => {
      assert(error instanceof OwnershipDiagnosticError);
      assert.equal(error.diagnostic.code, "NXHX-OWNERSHIP-MODIFIED-0009");
      assert.equal(error.diagnostic.target, "src/app/second/page.tsx");
      return true;
    });

    assert.equal(read(root, "src/app/first/page.tsx"), first);
    assert.match(read(root, "src/app/second/page.tsx"), /ReviewedEdit/);
    assert.equal(read(root, ".nextjshx/manifest.json"), manifest);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test(
  "clean rejects a symlinked owned target without deleting another verified output",
  { skip: process.platform === "win32" },
  async () => {
    const root = fixtureRoot();
    try {
      const state = stateFor(
        plan(
          intentValue({
            targetPath: "first/page.tsx",
            segmentPath: "first",
            typeName: "fixture.First",
          }),
          intentValue({
            targetPath: "second/page.tsx",
            segmentPath: "second",
            typeName: "fixture.Second",
          }),
        ),
      );
      const runtime = runtimeFor(state);
      await runGenerateCommand({ start: root, runtime, validate: false });
      const first = read(root, "src/app/first/page.tsx");
      const second = path.join(root, "src/app/second/page.tsx");
      const outside = path.join(root, "outside.tsx");
      writeFileSync(outside, "export const outside = true;\n", "utf8");
      rmSync(second, { force: true });
      symlinkSync(outside, second);

      await assert.rejects(
        runCleanCommand({ start: root, runtime }),
        (error) => {
          assert(error instanceof OwnershipDiagnosticError);
          assert.equal(error.diagnostic.code, "NXHX-OWNERSHIP-SYMLINK-0006");
          return true;
        },
      );

      assert.equal(read(root, "src/app/first/page.tsx"), first);
      assert.equal(
        readFileSync(outside, "utf8"),
        "export const outside = true;\n",
      );
      assert.equal(lstatSync(second).isSymbolicLink(), true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  },
);

for (const cleanCrash of ["output", "manifest"] as const) {
  test(`clean recovers a simulated crash after ${cleanCrash} publication`, async () => {
    const root = fixtureRoot();
    try {
      const state = stateFor(simplePlan("CrashClean"));
      const runtime = runtimeFor(state);
      await runGenerateCommand({ start: root, runtime, validate: false });
      const adapter = read(root, "src/app/crashclean/page.tsx");
      const manifest = read(root, ".nextjshx/manifest.json");

      await assert.rejects(
        runCleanCommand({
          start: root,
          runtime,
          faultInjector(point): void {
            if (
              (cleanCrash === "output" && point.kind === "output-published") ||
              (cleanCrash === "manifest" && point.kind === "manifest-published")
            ) {
              throw new PublicationCrashSimulationError(point);
            }
          },
        }),
        PublicationCrashSimulationError,
      );
      assert.equal(
        existsSync(path.join(root, ".nextjshx/transaction.json")),
        true,
      );

      const completed = await runCleanCommand({ start: root, runtime });
      assert.equal(completed.recovery.action, "rolled-back");
      assert.equal(completed.action, "cleaned");
      assert.equal(
        existsSync(path.join(root, "src/app/crashclean/page.tsx")),
        false,
      );
      assert.equal(
        existsSync(path.join(root, ".nextjshx/transaction.json")),
        false,
      );
      assert.notEqual(adapter.length, 0);
      assert.notEqual(manifest.length, 0);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
}

test("typecheck compiles Haxe, verifies current adapters, then runs Next and tsc without publication", async () => {
  const root = fixtureRoot();
  try {
    const state = stateFor(simplePlan("Fresh"));
    const runtime = runtimeFor(state);
    await runGenerateCommand({ start: root, runtime, validate: false });
    const beforeAdapter = read(root, "src/app/fresh/page.tsx");
    const beforeManifest = read(root, ".nextjshx/manifest.json");
    state.requests.length = 0;
    const result = await runTypecheckCommand({ start: root, runtime });
    assert.deepEqual(result.planned.unchanged, ["src/app/fresh/page.tsx"]);
    assert.deepEqual(
      state.requests.map((request) => request.source),
      ["haxe", "next", "tsc"],
    );
    const haxeRequest = state.requests[0];
    assert(haxeRequest !== undefined);
    assert.equal(haxeRequest.args.includes("--no-output"), false);
    assert(
      haxeRequest.args.includes(APP_ROOT_DEFINE),
      "Haxe receives the discovered App Router root",
    );
    assert(
      haxeRequest.args.includes(GENERATED_ROOT_DEFINE),
      "Haxe receives the configured generated root",
    );
    assert.equal(read(root, "src/app/fresh/page.tsx"), beforeAdapter);
    assert.equal(read(root, ".nextjshx/manifest.json"), beforeManifest);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("build runs doctor, clean generation, publication, framework validation, Next build, and stale verification in order", async () => {
  const root = fixtureRoot();
  try {
    mkdirSync(path.join(root, "src-gen/nested"), { recursive: true });
    writeFileSync(path.join(root, "src-gen/stale.ts"), "export {};\n", "utf8");
    writeFileSync(
      path.join(root, "src-gen/nested/stale.tsx"),
      "export {};\n",
      "utf8",
    );
    const state = stateFor(simplePlan("Production"));
    const runtime = runtimeFor(state);
    const result = await runBuildCommand({
      start: root,
      runtime,
      nextArgs: ["--profile"],
    });

    assert.equal(result.doctor, "passed");
    assert.equal(result.cleanedGeneratedEntries, 3);
    assert.equal(result.generatedEntries, 2);
    assert.equal(result.generation.publication.action, "published");
    assert.equal(result.nextBuild, "passed");
    assert.equal(result.verifiedOutputs, 1);
    assert.match(result.manifestGeneration, /^[0-9a-f]{64}$/);
    assert.deepEqual(result.nextArguments, ["--profile"]);
    assert.equal(
      read(root, "src-gen/main.ts"),
      "export const generatedByHaxe = true;\n",
    );
    assert.deepEqual(
      state.requests.map((request) => request.source),
      ["haxe", "haxe", "haxe", "next", "tsc", "next-build", "haxe"],
    );
    const nextBuild = state.requests.find(
      (request) => request.source === "next-build",
    );
    assert.deepEqual(nextBuild?.args, ["build", ".", "--profile"]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("build fails closed across Haxe, ownership, strict TypeScript, and Next production errors", async (t) => {
  await t.test("Haxe doctor failure", async () => {
    const root = fixtureRoot();
    try {
      const state = stateFor(simplePlan("HaxeFailure"));
      state.haxeExit = 2;
      await assert.rejects(
        runBuildCommand({ start: root, runtime: runtimeFor(state) }),
        (error) => {
          assert(error instanceof CliDiagnosticError);
          assert.equal(error.diagnostic.code, "NXHX-CLI-BUILD-0009");
          assert.match(error.diagnostic.actual, /NXHX-DOCTOR-PLAN-0010/);
          return true;
        },
      );
      assert.equal(
        state.requests.some((request) => request.source === "next-build"),
        false,
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  await t.test("native ownership collision", async () => {
    const root = fixtureRoot();
    try {
      mkdirSync(path.join(root, "src/app/owned"), { recursive: true });
      writeFileSync(
        path.join(root, "src/app/owned/page.tsx"),
        "export default function Native() { return null; }\n",
        "utf8",
      );
      const state = stateFor(simplePlan("Owned"));
      await assert.rejects(
        runBuildCommand({ start: root, runtime: runtimeFor(state) }),
        (error) => {
          assert(error instanceof OwnershipDiagnosticError);
          assert.equal(error.diagnostic.code, "NXHX-OWNERSHIP-UNOWNED-0008");
          return true;
        },
      );
      assert.equal(
        state.requests.some((request) => request.source === "next-build"),
        false,
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  await t.test("strict TypeScript failure", async () => {
    const root = fixtureRoot();
    try {
      const state = stateFor(simplePlan("TypeFailure"));
      state.typescriptExit = 2;
      await assert.rejects(
        runBuildCommand({ start: root, runtime: runtimeFor(state) }),
        (error) => {
          assert(error instanceof PublicationDiagnosticError);
          assert.equal(
            error.diagnostic.code,
            "NXHX-TRANSACTION-VALIDATION-0008",
          );
          return true;
        },
      );
      assert.equal(
        state.requests.some((request) => request.source === "next-build"),
        false,
      );
      assert.equal(
        existsSync(path.join(root, "src/app/typefailure/page.tsx")),
        false,
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  await t.test("Next production failure", async () => {
    const root = fixtureRoot();
    try {
      const state = stateFor(simplePlan("NextFailure"));
      state.nextBuildExit = 1;
      await assert.rejects(
        runBuildCommand({ start: root, runtime: runtimeFor(state) }),
        (error) => {
          assert(error instanceof CliDiagnosticError);
          assert.equal(error.diagnostic.code, "NXHX-CLI-BUILD-0009");
          assert.match(
            error.diagnostic.actual,
            /fixture Next production-build failure/,
          );
          return true;
        },
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  await t.test("missing configured Haxe output", async () => {
    const root = fixtureRoot();
    try {
      const state = stateFor(simplePlan("MissingOutput"));
      state.emitGeneratedRoot = false;
      await assert.rejects(
        runBuildCommand({ start: root, runtime: runtimeFor(state) }),
        (error) => {
          assert(error instanceof CliDiagnosticError);
          assert.equal(error.diagnostic.code, "NXHX-CLI-PLAN-0004");
          assert.match(
            error.diagnostic.actual,
            /adapter implementation module is absent/,
          );
          return true;
        },
      );
      assert.equal(
        state.requests.some((request) => request.source === "next-build"),
        false,
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

test("build requires Next's own TypeScript phase and a fresh post-build adapter tree", async (t) => {
  await t.test("type checking cannot be skipped", async () => {
    const root = fixtureRoot();
    try {
      const state = stateFor(simplePlan("SkippedTypes"));
      state.nextBuildOutput = "Skipping validation of types\n";
      await assert.rejects(
        runBuildCommand({ start: root, runtime: runtimeFor(state) }),
        (error) => {
          assert(error instanceof CliDiagnosticError);
          assert.equal(error.diagnostic.code, "NXHX-CLI-BUILD-0009");
          assert.match(error.diagnostic.message, /skipped/);
          return true;
        },
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  await t.test("plan drift after Next build is rejected", async () => {
    const root = fixtureRoot();
    try {
      const state = stateFor(simplePlan("BeforeBuild"));
      state.afterBuildPlan = simplePlan("BeforeBuild", "renderV2");
      await assert.rejects(
        runBuildCommand({ start: root, runtime: runtimeFor(state) }),
        (error) => {
          assert(error instanceof CliDiagnosticError);
          assert.equal(error.diagnostic.code, "NXHX-CLI-BUILD-0009");
          assert.match(
            error.diagnostic.actual,
            /update:src\/app\/beforebuild\/page\.tsx/,
          );
          return true;
        },
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

test("build cleanup rejects a generated tree containing a symlink without deleting sibling bytes", async () => {
  const root = fixtureRoot();
  try {
    mkdirSync(path.join(root, "src-gen"), { recursive: true });
    writeFileSync(path.join(root, "outside.txt"), "preserve me\n", "utf8");
    writeFileSync(
      path.join(root, "src-gen/preserve.ts"),
      "export {};\n",
      "utf8",
    );
    symlinkSync(
      path.join(root, "outside.txt"),
      path.join(root, "src-gen/escape.ts"),
    );
    const state = stateFor(simplePlan("UnsafeClean"));
    await assert.rejects(
      runBuildCommand({ start: root, runtime: runtimeFor(state) }),
      (error) => {
        assert(error instanceof CliDiagnosticError);
        assert.equal(error.diagnostic.code, "NXHX-CLI-BUILD-0009");
        assert.match(error.diagnostic.actual, /NXHX-DOCTOR-APP-ROOT-0005/);
        return true;
      },
    );
    assert.equal(read(root, "outside.txt"), "preserve me\n");
    assert.equal(read(root, "src-gen/preserve.ts"), "export {};\n");
    assert.equal(existsSync(path.join(root, "src-gen/escape.ts")), true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("build refuses a generated root that overlaps authored application source", async () => {
  const root = fixtureRoot();
  try {
    const configPath = path.join(root, "nextjshx.config.json");
    const config = JSON.parse(readFileSync(configPath, "utf8")) as {
      haxe: { generatedRoot: string };
    };
    config.haxe.generatedRoot = "src";
    writeJson(configPath, config);
    const sourceBefore = read(root, "src/index.ts");
    const state = stateFor(simplePlan("Overlap"));
    await assert.rejects(
      runBuildCommand({ start: root, runtime: runtimeFor(state) }),
      (error) => {
        assert(error instanceof CliDiagnosticError);
        assert.equal(error.diagnostic.code, "NXHX-CLI-BUILD-0009");
        assert.match(error.diagnostic.actual, /NXHX-DOCTOR-APP-ROOT-0005/);
        return true;
      },
    );
    assert.equal(read(root, "src/index.ts"), sourceBefore);
    assert.equal(
      state.requests.some((request) => request.source === "next-build"),
      false,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("typecheck and checked routes refuse to validate an unpublished adapter tree", async () => {
  const root = fixtureRoot();
  try {
    const state = stateFor(simplePlan("Stale"));
    const runtime = runtimeFor(state);
    await assert.rejects(
      runTypecheckCommand({ start: root, runtime }),
      (error) => {
        assert(error instanceof CliDiagnosticError);
        assert.equal(error.diagnostic.code, "NXHX-CLI-TYPECHECK-0006");
        assert.match(
          error.diagnostic.actual,
          /create:src\/app\/stale\/page\.tsx/,
        );
        return true;
      },
    );
    assert.deepEqual(
      state.requests.map((request) => request.source),
      ["haxe"],
    );
    state.requests.length = 0;
    await assert.rejects(
      runRoutesCommand({ start: root, runtime, check: true }),
      (error) => {
        assert(error instanceof CliDiagnosticError);
        assert.equal(error.diagnostic.code, "NXHX-CLI-ROUTE-0007");
        return true;
      },
    );
    assert.deepEqual(
      state.requests.map((request) => request.source),
      ["haxe"],
    );
    assert.equal(existsSync(path.join(root, ".nextjshx/manifest.json")), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("typecheck refuses a profile change until its manifest is published", async () => {
  const root = fixtureRoot();
  try {
    const state = stateFor(simplePlan("Profiled"));
    const runtime = runtimeFor(state);
    await runGenerateCommand({
      start: root,
      runtime,
      validate: false,
    });
    const configPath = path.join(root, "nextjshx.config.json");
    const config = JSON.parse(readFileSync(configPath, "utf8")) as Record<
      string,
      unknown
    >;
    config.$schema = "https://nextjshx.dev/schemas/config-v2.json";
    config.schemaVersion = 2;
    config.haxe = {
      ...(config.haxe as Record<string, unknown>),
      defines: [],
    };
    config.output = {
      ...(config.output as Record<string, unknown>),
      language: "typescript",
      intent: "optimized",
      profileVersion: 1,
      sourceMaps: "external",
      sourcesContent: true,
      declarations: "public",
      jsxRuntime: "automatic",
    };
    writeJson(configPath, config);
    state.requests.length = 0;

    await assert.rejects(
      runTypecheckCommand({ start: root, runtime }),
      (error) => {
        assert(error instanceof CliDiagnosticError);
        assert.equal(error.diagnostic.code, "NXHX-CLI-TYPECHECK-0006");
        assert.match(error.diagnostic.actual, /profile:[0-9a-f]{12}->[0-9a-f]{12}/);
        return true;
      },
    );
    assert.deepEqual(
      state.requests.map((request) => request.source),
      ["haxe"],
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("plan collection rejects locally writable control directories", async () => {
  const root = fixtureRoot();
  try {
    const control = path.join(root, ".nextjshx");
    mkdirSync(control, { mode: 0o700 });
    chmodSync(control, 0o777);
    const state = stateFor(simplePlan("UnsafeControl"));
    await assert.rejects(
      runRoutesCommand({ start: root, runtime: runtimeFor(state) }),
      (error) => {
        assert(error instanceof CliDiagnosticError);
        assert.equal(error.diagnostic.code, "NXHX-CLI-PLAN-0004");
        assert.equal(error.diagnostic.actual, "mode 777");
        return true;
      },
    );
    assert.equal(state.requests.length, 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("routes reports public patterns, parameter cardinality, ownership, and parity", async () => {
  const root = fixtureRoot();
  try {
    mkdirSync(path.join(root, "src/app/(native)/catalog/[sku]"), {
      recursive: true,
    });
    writeFileSync(
      path.join(root, "src/app/(native)/catalog/[sku]/page.tsx"),
      "export default function NativeCatalogPage() { return null; }\n",
      "utf8",
    );
    mkdirSync(path.join(root, "src/app/api/health"), { recursive: true });
    writeFileSync(
      path.join(root, "src/app/api/health/route.ts"),
      "export function GET() { return new Response('ok'); }\n",
      "utf8",
    );
    mkdirSync(path.join(root, "src/app/_private"), { recursive: true });
    writeFileSync(
      path.join(root, "src/app/_private/page.tsx"),
      "export default function PrivateHelper() { return null; }\n",
      "utf8",
    );
    mkdirSync(path.join(root, "src/app/components"), { recursive: true });
    writeFileSync(
      path.join(root, "src/app/components/page.test.tsx"),
      "export const fixture = 'not a route';\n",
      "utf8",
    );
    const state = stateFor(
      plan(
        intentValue({
          targetPath: "archive/[[...slug]]/page.tsx",
          segmentPath: "archive/[[...slug]]",
          typeName: "fixture.Archive",
        }),
        intentValue({
          targetPath: "docs/[...parts]/page.tsx",
          segmentPath: "docs/[...parts]",
          typeName: "fixture.Docs",
        }),
        intentValue({
          targetPath: "page.tsx",
          segmentPath: "",
          typeName: "fixture.Home",
        }),
        intentValue({
          targetPath: "teams/[teamId]/page.tsx",
          segmentPath: "teams/[teamId]",
          typeName: "fixture.Team",
        }),
        intentValue({
          targetPath: "teams/TeamButton.tsx",
          segmentPath: "teams",
          typeName: "fixture.TeamButton",
          kind: "client-component",
        }),
      ),
    );
    const runtime = runtimeFor(state);
    await runGenerateCommand({ start: root, runtime, validate: false });
    state.requests.length = 0;
    const result = await runRoutesCommand({
      start: root,
      runtime,
      check: true,
    });
    const haxeRoutes = result.routes.filter((route) => route.origin === "haxe");
    const nativeRoutes = result.routes.filter(
      (route) => route.origin === "native",
    );
    assert.deepEqual(
      haxeRoutes.map((route) => route.publicPattern),
      ["/archive/[[...slug]]", "/docs/[...parts]", "/", "/teams/[teamId]"],
    );
    assert.deepEqual(
      haxeRoutes.map((route) => route.parameters),
      [
        [{ name: "slug", kind: "optional-catch-all", segmentIndex: 2 }],
        [{ name: "parts", kind: "catch-all", segmentIndex: 2 }],
        [],
        [{ name: "teamId", kind: "single", segmentIndex: 2 }],
      ],
    );
    assert(haxeRoutes.every((route) => route.ownership === "owned-current"));
    assert.deepEqual(
      nativeRoutes.map((route) => ({
        source: route.source,
        kind: route.kind,
        publicPattern: route.publicPattern,
        parameters: route.parameters,
        ownership: route.ownership,
      })),
      [
        {
          source: "src/app/(native)/catalog/[sku]/page.tsx",
          kind: "page",
          publicPattern: "/catalog/[sku]",
          parameters: [{ name: "sku", kind: "single", segmentIndex: 2 }],
          ownership: "native",
        },
        {
          source: "src/app/api/health/route.ts",
          kind: "route-handler",
          publicPattern: "/api/health",
          parameters: [],
          ownership: "native",
        },
      ],
    );
    assert(result.routes.every((route) => route.parity === "accepted"));
    assert.match(
      state.routeParitySource ?? "",
      /Route<"\/catalog\/nextjshx-probe"> = "\/catalog\/nextjshx-probe"/,
    );
    assert.match(
      state.routeParitySource ?? "",
      /Route<"\/api\/health"> = "\/api\/health"/,
    );
    assert.equal(state.routeParitySource?.includes("[sku]"), false);
    assert.deepEqual(state.routeParityFiles, [
      `${FIXED_UUID}.routes.ts`,
      "../../next-env.d.ts",
    ]);
    assert.deepEqual(
      state.requests.map((request) => request.source),
      ["haxe", "next", "tsc", "tsc"],
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("boundaries joins sanitized Haxe evidence to compatible final Next chunks", async () => {
  const root = fixtureRoot();
  try {
    const targetPath = "_nextjshx/client/abc/Leaf.tsx";
    const owner = "fixture.Leaf";
    const state = stateFor(
      plan(
        intentValue({
          targetPath,
          segmentPath: "",
          typeName: owner,
          kind: "client-component",
        }),
      ),
    );
    state.boundaryPlan = clientBoundaryPlan(owner, targetPath);
    const configPath = path.join(root, "nextjshx.config.json");
    const config = JSON.parse(readFileSync(configPath, "utf8")) as Record<
      string,
      unknown
    >;
    config.boundaries = {
      maxDirectDependencies: 0,
      maxObservedClientBytes: 0,
    };
    writeJson(configPath, config);

    mkdirSync(path.join(root, ".next"), { recursive: true });
    writeFileSync(path.join(root, ".next/BUILD_ID"), "fixture-build\n", "utf8");
    writeJson(path.join(root, ".next/diagnostics/framework.json"), {
      name: "Next.js",
      version: "16.2.12",
    });
    const chunk = ".next/static/chunks/leaf.js";
    mkdirSync(path.dirname(path.join(root, chunk)), { recursive: true });
    writeFileSync(path.join(root, chunk), "leaf-client", "utf8");
    const moduleKey = `[project]/tmp/${path.basename(root)}/src/app/${targetPath}`;
    const manifest = {
      moduleLoading: { prefix: "", crossOrigin: null },
      clientModules: {
        [moduleKey]: {
          id: 1,
          name: "*",
          chunks: ["/_next/static/chunks/leaf.js"],
          async: false,
        },
      },
    };
    const manifestPath = path.join(
      root,
      ".next/server/app/page_client-reference-manifest.js",
    );
    mkdirSync(path.dirname(manifestPath), { recursive: true });
    writeFileSync(
      manifestPath,
      "globalThis.__RSC_MANIFEST = globalThis.__RSC_MANIFEST || {};\n" +
        `globalThis.__RSC_MANIFEST["/page"] = ${JSON.stringify(manifest)};\n`,
      "utf8",
    );

    const result = await runBoundariesCommand({
      start: root,
      runtime: runtimeFor(state),
    });
    assert.equal(result.projectRoot, ".");
    assert.deepEqual(result.evidence, {
      haxe: "complete",
      next: "all-client-adapters-observed",
    });
    assert.equal(result.boundaries.length, 1);
    const boundary = result.boundaries[0];
    assert(boundary !== undefined);
    assert.equal(boundary.owner, owner);
    assert.equal(boundary.evidence, "haxe-known");
    assert.equal(boundary.generatedTarget, `src/app/${targetPath}`);
    assert.equal(
      boundary.propsContract,
      "ComponentType<Parameters<typeof Leaf.render>[0]>",
    );
    assert.deepEqual(boundary.nextArtifacts.chunks, [chunk]);
    assert.equal(
      boundary.nextArtifacts.bytes,
      Buffer.byteLength("leaf-client"),
    );
    assert.deepEqual(
      boundary.warnings.map((warning) => [warning.evidence, warning.unit]),
      [
        ["haxe-known", "direct-dependencies"],
        ["next-observed", "bytes"],
      ],
    );
    assert.equal(JSON.stringify(result).includes(root), false);

    let stdout = "";
    const exit = await runCli(
      ["boundaries"],
      {
        cwd: root,
        stdout: (value) => {
          stdout += value;
        },
      },
      runtimeFor(state),
    );
    assert.equal(exit, 0);
    assert.match(
      stdout,
      /Next artifacts: next-observed \| 11 bytes \| 1 chunks/,
    );
    assert.match(
      stdout,
      /Move the client boundary to the smallest interactive leaf/,
    );
    assert.equal(stdout.includes(root), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("checked routes rejects a per-pattern Next parity failure and removes probes", async () => {
  const root = fixtureRoot();
  try {
    const state = stateFor(simplePlan("Parity"));
    const runtime = runtimeFor(state);
    await runGenerateCommand({ start: root, runtime, validate: false });
    state.requests.length = 0;
    state.routeParityExit = 2;
    await assert.rejects(
      runRoutesCommand({ start: root, runtime, check: true }),
      (error) => {
        assert(error instanceof CliDiagnosticError);
        assert.equal(error.diagnostic.code, "NXHX-CLI-TYPECHECK-0006");
        assert.match(error.diagnostic.message, /typed route parity probe/);
        assert.match(error.diagnostic.actual, /fixture route parity failure/);
        return true;
      },
    );
    assert.deepEqual(
      state.requests.map((request) => request.source),
      ["haxe", "next", "tsc", "tsc"],
    );
    assert.deepEqual(
      readdirSync(path.join(root, ".nextjshx/plans")),
      [],
      "failed parity validation left private probe artifacts behind",
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("routes models native parallel and intercepted views without stealing canonical ownership", async () => {
  const root = fixtureRoot();
  try {
    mkdirSync(path.join(root, "src/app/@modal/(.)photo/[id]"), {
      recursive: true,
    });
    writeFileSync(
      path.join(root, "src/app/@modal/(.)photo/[id]/page.tsx"),
      "export default function InterceptedPhoto() { return null; }\n",
      "utf8",
    );
    writeFileSync(
      path.join(root, "src/app/@modal/default.tsx"),
      "export default function ModalDefault() { return null; }\n",
      "utf8",
    );
    mkdirSync(path.join(root, "src/app/photo/[id]"), { recursive: true });
    writeFileSync(
      path.join(root, "src/app/photo/[id]/page.tsx"),
      "export default function CanonicalPhoto() { return null; }\n",
      "utf8",
    );
    mkdirSync(path.join(root, "src/app/@analytics"), { recursive: true });
    writeFileSync(
      path.join(root, "src/app/@analytics/page.tsx"),
      "export default function AnalyticsSlot() { return null; }\n",
      "utf8",
    );
    writeFileSync(
      path.join(root, "src/app/@analytics/default.tsx"),
      "export default function AnalyticsDefault() { return null; }\n",
      "utf8",
    );
    const state = stateFor(simplePlan("Safe"));
    const runtime = runtimeFor(state);
    await runGenerateCommand({ start: root, runtime, validate: false });
    state.requests.length = 0;
    const result = await runRoutesCommand({
      start: root,
      runtime,
      check: true,
    });
    const intercepted = result.routes.find(
      (route) =>
        route.filesystemPath === "src/app/@modal/(.)photo/[id]/page.tsx",
    );
    assert.deepEqual(intercepted, {
      origin: "native",
      source: "src/app/@modal/(.)photo/[id]/page.tsx",
      kind: "page",
      segmentPath: "@modal/(.)photo/[id]",
      targetPath: "@modal/(.)photo/[id]/page.tsx",
      filesystemPath: "src/app/@modal/(.)photo/[id]/page.tsx",
      publicPattern: "/photo/[id]",
      topology: "intercepted-view",
      parallelSlots: ["modal"],
      interception: {
        marker: "(.)",
        segmentIndex: 2,
        interceptingPath: "/",
        interceptedPath: "/photo/[id]",
      },
      parameters: [{ name: "id", kind: "single", segmentIndex: 2 }],
      ownership: "native",
      parity: "accepted",
    });
    const parallel = result.routes.find(
      (route) => route.filesystemPath === "src/app/@analytics/page.tsx",
    );
    assert.equal(parallel?.publicPattern, "/");
    assert.equal(parallel?.topology, "parallel-view");
    assert.deepEqual(parallel?.parallelSlots, ["analytics"]);
    assert.deepEqual(
      state.requests.map((request) => request.source),
      ["haxe", "next", "tsc", "tsc"],
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("routes rejects an intercepted view without its canonical hard-navigation page", async () => {
  const root = fixtureRoot();
  try {
    mkdirSync(path.join(root, "src/app/@modal/(.)photo"), { recursive: true });
    writeFileSync(
      path.join(root, "src/app/@modal/(.)photo/page.tsx"),
      "export default function InterceptedPhoto() { return null; }\n",
      "utf8",
    );
    writeFileSync(
      path.join(root, "src/app/@modal/default.tsx"),
      "export default function ModalDefault() { return null; }\n",
      "utf8",
    );
    const state = stateFor(simplePlan("Safe"));
    await assert.rejects(
      runRoutesCommand({
        start: root,
        runtime: runtimeFor(state),
        check: true,
      }),
      (error) => {
        assert(error instanceof CliDiagnosticError);
        assert.equal(error.diagnostic.code, "NXHX-CLI-ROUTE-0007");
        assert.equal(
          error.diagnostic.subject,
          "src/app/@modal/(.)photo/page.tsx",
        );
        assert.equal(error.diagnostic.expected, "a canonical page for /photo");
        assert.equal(error.diagnostic.actual, "missing");
        assert.match(error.diagnostic.resolution, /hard-navigation route/);
        return true;
      },
    );
    assert.deepEqual(
      state.requests.map((request) => request.source),
      ["haxe"],
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("generation rejects a Next 16 parallel slot without an explicit default", async () => {
  const root = fixtureRoot();
  try {
    mkdirSync(path.join(root, "src/app/@reports"), { recursive: true });
    writeFileSync(
      path.join(root, "src/app/@reports/page.tsx"),
      "export default function Reports() { return null; }\n",
      "utf8",
    );
    const state = stateFor(simplePlan("Safe"));
    await assert.rejects(
      runGenerateCommand({
        start: root,
        runtime: runtimeFor(state),
        validate: false,
      }),
      (error) => {
        assert(error instanceof CliDiagnosticError);
        assert.equal(error.diagnostic.code, "NXHX-CLI-ROUTE-0007");
        assert.equal(error.diagnostic.subject, "src/app/@reports");
        assert.match(error.diagnostic.message, /required by Next 16/);
        assert.match(
          error.diagnostic.resolution,
          /@:next\.default\("@reports"\)/,
        );
        return true;
      },
    );
    assert.deepEqual(
      state.requests.map((request) => request.source),
      ["haxe"],
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("routes rejects route-group aliases that claim one canonical public URL", async () => {
  const root = fixtureRoot();
  try {
    for (const group of ["(first)", "(second)"]) {
      mkdirSync(path.join(root, "src/app", group, "same"), { recursive: true });
      writeFileSync(
        path.join(root, "src/app", group, "same/page.tsx"),
        "export default function SamePage() { return null; }\n",
        "utf8",
      );
    }
    const state = stateFor(simplePlan("Safe"));
    await assert.rejects(
      runRoutesCommand({ start: root, runtime: runtimeFor(state) }),
      (error) => {
        assert(error instanceof CliDiagnosticError);
        assert.equal(error.diagnostic.code, "NXHX-CLI-ROUTE-0007");
        assert.equal(error.diagnostic.subject, "/same");
        assert.match(error.diagnostic.message, /same canonical public route/);
        return true;
      },
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("doctor checks the pinned environment and reports interrupted transaction state", async () => {
  const root = fixtureRoot();
  try {
    const state = stateFor(simplePlan());
    const runtime = runtimeFor(state);
    await runGenerateCommand({ start: root, runtime, validate: false });
    const ownedAdapterPath = path.join(root, "src/app/page/page.tsx");
    const ownedAdapter = readFileSync(ownedAdapterPath, "utf8");
    state.requests.length = 0;
    const healthy = await runDoctorCommand({ start: root, runtime });
    assert.equal(healthy.ok, true);
    assert(
      healthy.checks.some(
        (check) =>
          check.code === "NXHX-DOCTOR-PLAN-0010" && check.status === "pass",
      ),
    );
    assert(
      healthy.checks.some(
        (check) =>
          check.code === "NXHX-DOCTOR-UPSTREAM-0011" && check.status === "info",
      ),
    );

    writeFileSync(ownedAdapterPath, `${ownedAdapter}// local drift\n`, "utf8");
    const drifted = await runDoctorCommand({ start: root, runtime });
    assert.equal(drifted.ok, false);
    assert(
      drifted.checks.some(
        (check) =>
          check.code === "NXHX-DOCTOR-MANIFEST-0006" && check.status === "fail",
      ),
    );
    writeFileSync(ownedAdapterPath, ownedAdapter, "utf8");

    writeFileSync(
      path.join(root, ".nextjshx/transaction.json"),
      "interrupted\n",
      "utf8",
    );
    const interrupted = await runDoctorCommand({ start: root, runtime });
    assert.equal(interrupted.ok, false);
    assert(
      interrupted.checks.some(
        (check) =>
          check.code === "NXHX-DOCTOR-TRANSACTION-0007" &&
          check.status === "fail",
      ),
    );

    rmSync(path.join(root, ".nextjshx/transaction.json"), { force: true });
    const configPath = path.join(root, "nextjshx.config.json");
    const config = JSON.parse(readFileSync(configPath, "utf8")) as {
      haxe: { defines: string[] };
    };
    config.haxe.defines = ["genes.ts"];
    writeJson(configPath, config);
    const migratedDefines = await runDoctorCommand({ start: root, runtime });
    assert.equal(migratedDefines.ok, true);
    assert(
      migratedDefines.checks.some(
        (check) =>
          check.code === "NXHX-DOCTOR-PLAN-0010" &&
          check.status === "pass" &&
          check.actual.includes("define(s) derived"),
      ),
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("doctor verifies an explicitly configured Next source oracle by version and commit", async () => {
  const root = fixtureRoot();
  try {
    const configPath = path.join(root, "nextjshx.config.json");
    const config = JSON.parse(readFileSync(configPath, "utf8")) as {
      next: Record<string, unknown>;
    };
    config.next.upstreamDir = "upstream-next";
    writeJson(configPath, config);
    writeJson(path.join(root, "upstream-next/packages/next/package.json"), {
      name: "next",
      version: "16.3.0-canary.87",
    });
    const state = stateFor(simplePlan());
    const runtime = runtimeFor(state);
    const accepted = await runDoctorCommand({ start: root, runtime });
    assert.equal(accepted.ok, true);
    assert(
      accepted.checks.some(
        (check) =>
          check.code === "NXHX-DOCTOR-UPSTREAM-0011" && check.status === "pass",
      ),
    );
    assert(state.requests.some((request) => request.source === "git"));

    state.gitCommit = "0000000000000000000000000000000000000000";
    const rejected = await runDoctorCommand({ start: root, runtime });
    assert.equal(rejected.ok, false);
    assert(
      rejected.checks.some(
        (check) =>
          check.code === "NXHX-DOCTOR-UPSTREAM-0011" && check.status === "fail",
      ),
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("build CLI passes reviewed Next flags, bounds JSON output, and rejects unsafe or conflicting flags", async () => {
  const root = fixtureRoot();
  try {
    const state = stateFor(simplePlan("CliBuild"));
    const runtime = runtimeFor(state);
    let stdout = "";
    let stderr = "";
    const exit = await runCli(
      ["build", "--json", "--", "--profile", "--webpack"],
      {
        cwd: root,
        stdout: (value) => {
          stdout += value;
        },
        stderr: (value) => {
          stderr += value;
        },
      },
      runtime,
    );
    assert.equal(exit, 0);
    assert.equal(stderr, "");
    const decoded = JSON.parse(stdout) as {
      readonly result: {
        readonly command: string;
        readonly nextArguments: readonly string[];
        readonly nextOutput?: string;
      };
    };
    assert.equal(decoded.result.command, "build");
    assert.deepEqual(decoded.result.nextArguments, ["--profile", "--webpack"]);
    assert.equal(Object.hasOwn(decoded.result, "nextOutput"), false);
    const buildRequest = state.requests.find(
      (request) => request.source === "next-build",
    );
    assert.deepEqual(buildRequest?.args, [
      "build",
      ".",
      "--profile",
      "--webpack",
    ]);

    for (const invocation of [
      [
        "build",
        "--json",
        "--experimental-upload-trace",
        "https://example.invalid/trace",
      ],
      ["build", "--json", "--experimental-build-mode", "compile"],
      ["build", "--json", "--debug-build-paths", "app/**"],
      ["build", "--json", "--debug-prerender"],
      ["build", "--json", "--experimental-app-only"],
      ["build", "--json", "--turbo", "--webpack"],
      ["build", "--json", "--future-unknown-flag"],
    ]) {
      stdout = "";
      stderr = "";
      state.requests.length = 0;
      const failureExit = await runCli(
        invocation,
        {
          cwd: root,
          stdout: (value) => {
            stdout += value;
          },
          stderr: (value) => {
            stderr += value;
          },
        },
        runtime,
      );
      assert.equal(failureExit, 1);
      assert.equal(stdout, "");
      const failure = JSON.parse(stderr) as {
        readonly error: { readonly code: string };
      };
      assert.equal(failure.error.code, "NXHX-CLI-USAGE-0001");
      assert.equal(state.requests.length, 0);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("CLI emits stable machine JSON for both success and usage failure", async () => {
  const root = fixtureRoot();
  try {
    const state = stateFor(simplePlan("Json"));
    const runtime = runtimeFor(state);
    let stdout = "";
    let stderr = "";
    const successExit = await runCli(
      ["routes", "--json"],
      {
        cwd: root,
        stdout: (value) => {
          stdout += value;
        },
        stderr: (value) => {
          stderr += value;
        },
      },
      runtime,
    );
    assert.equal(successExit, 0);
    assert.equal(stderr, "");
    const decoded = JSON.parse(stdout) as {
      readonly ok: boolean;
      readonly result: { readonly command: string };
    };
    assert.equal(decoded.ok, true);
    assert.equal(decoded.result.command, "routes");

    stdout = "";
    stderr = "";
    const failureExit = await runCli(
      ["generate", "--check", "--json"],
      {
        cwd: root,
        stdout: (value) => {
          stdout += value;
        },
        stderr: (value) => {
          stderr += value;
        },
      },
      runtime,
    );
    assert.equal(failureExit, 1);
    assert.equal(stdout, "");
    const failure = JSON.parse(stderr) as {
      readonly ok: boolean;
      readonly error: { readonly code: string };
    };
    assert.equal(failure.ok, false);
    assert.equal(failure.error.code, "NXHX-CLI-USAGE-0001");

    stdout = "";
    stderr = "";
    const missingPathExit = await runCli(
      ["repair", "--json"],
      {
        cwd: root,
        stdout: (value) => {
          stdout += value;
        },
        stderr: (value) => {
          stderr += value;
        },
      },
      runtime,
    );
    assert.equal(missingPathExit, 1);
    assert.equal(stdout, "");
    const missingPath = JSON.parse(stderr) as {
      readonly error: { readonly code: string };
    };
    assert.equal(missingPath.error.code, "NXHX-CLI-USAGE-0001");
    assert.equal(state.requests.length, 1);

    mkdirSync(path.join(root, "src/app/json"), { recursive: true });
    writeFileSync(
      path.join(root, "src/app/json/page.tsx"),
      "export default function NativePage() { return null; }\n",
      "utf8",
    );
    stderr = "";
    const blockedExit = await runCli(
      ["generate", "--no-check", "--json"],
      {
        cwd: root,
        stdout: (value) => {
          stdout += value;
        },
        stderr: (value) => {
          stderr += value;
        },
      },
      runtime,
    );
    assert.equal(blockedExit, 1);
    const blocked = JSON.parse(stderr) as {
      readonly error: { readonly code: string; readonly source: string };
      readonly blocked: readonly string[];
    };
    assert.equal(blocked.error.code, "NXHX-OWNERSHIP-UNOWNED-0008");
    assert.equal(blocked.error.source, "fixture.Json.render");
    assert.deepEqual(blocked.blocked, ["src/app/json/page.tsx"]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("CLI human route output makes filesystem topology explicit", async () => {
  const root = fixtureRoot();
  try {
    const state = stateFor(simplePlan("Human"));
    let stdout = "";
    let stderr = "";
    const exitCode = await runCli(
      ["routes"],
      {
        cwd: root,
        stdout: (value) => {
          stdout += value;
        },
        stderr: (value) => {
          stderr += value;
        },
      },
      runtimeFor(state),
    );
    assert.equal(exitCode, 0);
    assert.equal(stderr, "");
    assert.match(
      stdout,
      /\/human \| haxe \| page \| src\/app\/human\/page\.tsx \| topology=canonical \| slots=none \| interception=none \| params=none \| ownership=planned \| parity=not-checked/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
