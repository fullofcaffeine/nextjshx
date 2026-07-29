#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import net from "node:net";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

import typescriptParser from "@typescript-eslint/parser";
import { ESLint } from "eslint";
import reactHooks from "eslint-plugin-react-hooks";
import { chromium } from "playwright-core";
import ts from "typescript";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const EXAMPLE = path.join(ROOT, "examples/todoapp-next");
const GENERATED = path.join(EXAMPLE, "src-gen");
const CONTROL = path.join(EXAMPLE, ".nextjshx");
const STATE = path.join(CONTROL, "todoapp-state.tsv");
const SEED = path.join(EXAMPLE, "data/seed.tsv");
const NEXT_CONFIG = path.join(EXAMPLE, "next.config.mjs");
const NEXTJSHX_CONFIG = path.join(EXAMPLE, "nextjshx.config.json");
const TSCONFIG = path.join(EXAMPLE, "tsconfig.json");
const E2E = path.join(ROOT, "tests/e2e/todoapp-next.spec.mjs");
const CLI_BIN = path.join(ROOT, "tools/cli/.tmp/src/cli.js");
const NEXT_BIN = path.join(ROOT, "node_modules/next/dist/bin/next");
const TAILWIND_BIN = path.join(ROOT, "node_modules/@tailwindcss/cli/dist/index.mjs");
const GENERATED_ADAPTERS = [
  "app/_nextjshx/cache/todos/list.ts",
  "app/_nextjshx/client/45c189dd56d6/TodoRowActions.tsx",
  "app/_nextjshx/client/59f0e8dccc14/SortableTodoList.tsx",
  "app/_nextjshx/client/7bfeb2f12e2a/SortableTodoRow.tsx",
  "app/_nextjshx/client/af0bcfc585a9/FailureRecoveryProbe.tsx",
  "app/_nextjshx/client/ec33c886dc20/CreateTodoForm.tsx",
  "app/actions/todos.ts",
  "app/api/todos/route.ts",
  "app/layout.tsx",
  "app/page.tsx",
  "app/todos/[id]/page.tsx",
  "app/todos/error.tsx",
  "app/todos/loading.tsx",
  "app/todos/not-found.tsx",
];
const LEGACY_GENERATED_ADAPTERS = [
  "app/components/CreateTodoForm.tsx",
  "app/components/FailureRecoveryProbe.tsx",
  "app/components/SortableTodoList.tsx",
  "app/components/SortableTodoRow.tsx",
  "app/components/TodoRowActions.tsx",
];
const LINKED_PACKAGES = [
  "@dnd-kit/helpers",
  "@dnd-kit/react",
  "@nextjshx/showcase-ui",
  "@tailwindcss/cli",
  "next",
  "nuqs",
  "react",
  "react-dom",
  "react-is",
  "recharts",
  "tailwindcss",
  "typescript",
];
const EXPECTED_IDS = [
  "shape-first-release",
  "prove-production-build",
  "write-adoption-guide",
];
const EXPECTED_VERSIONS = new Map([
  ["@dnd-kit/helpers", "0.5.0"],
  ["@dnd-kit/react", "0.5.0"],
  ["@nextjshx/showcase-ui", "0.0.0"],
  ["@tailwindcss/cli", "4.3.3"],
  ["next", "16.2.12"],
  ["nuqs", "2.9.1"],
  ["react", "19.2.7"],
  ["react-dom", "19.2.7"],
  ["react-is", "19.2.7"],
  ["recharts", "3.8.1"],
  ["typescript", "6.0.2"],
  ["tailwindcss", "4.3.3"],
]);
const SUPPORTED_NODE_VERSIONS = new Set(["20.19.3", "24.18.0"]);
const COMMAND_ENV = {
  ...process.env,
  CI: "1",
  NEXT_TELEMETRY_DISABLED: "1",
};
const SMOKE_STATE = `id\tcompleted\tpriority\ttitle\tnote
shape-first-release\tfalse\tP0\tRuntime state won the read\tThe production server reopened the isolated state file instead of freezing seed bytes.
prove-production-build\ttrue\tP1\tProve the production build\tKeep Next typegen and the framework build as independent verifiers.
write-adoption-guide\tfalse\tP2\tWrite the adoption guide\tShow where Haxe improves authoring while native Next behavior stays visible.
`;

const REACT_LINTER = new ESLint({
  overrideConfigFile: true,
  overrideConfig: [
    {
      files: ["**/*.{ts,tsx}"],
      languageOptions: {
        parser: typescriptParser,
        parserOptions: {
          ecmaFeatures: { jsx: true },
          ecmaVersion: "latest",
          sourceType: "module",
        },
      },
      plugins: { "react-hooks": reactHooks },
      rules: {
        "react-hooks/exhaustive-deps": "error",
        "react-hooks/purity": "error",
        "react-hooks/rules-of-hooks": "error",
      },
    },
  ],
});

class TodoAppFailure extends Error {}

function assertNoHaxeEscape(name, source) {
  assert(
    !/\b(?:Dynamic|Any|untyped|Reflect)\b|\bcast\b/.test(source),
    `${name} contains a broad or unchecked Haxe escape`,
  );
}

function commandLine(command, args) {
  return [command, ...args]
    .map((value) => (/^[A-Za-z0-9_./:@=-]+$/.test(value) ? value : JSON.stringify(value)))
    .join(" ");
}

function run(command, args, options = {}) {
  console.log(`[todoapp-next] $ ${commandLine(command, args)}`);
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? ROOT,
    encoding: "utf8",
    env: COMMAND_ENV,
    maxBuffer: 32 * 1024 * 1024,
  });
  if (result.error !== undefined) {
    throw result.error;
  }
  if (result.stdout.length > 0) {
    process.stdout.write(result.stdout);
  }
  if (result.stderr.length > 0) {
    process.stderr.write(result.stderr);
  }
  assert.equal(result.status, 0, `${commandLine(command, args)} failed`);
  return result.stdout;
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

function parseState(source) {
  const normalized = source.replaceAll("\r\n", "\n");
  assert(!normalized.includes("\r"), "todo state contains a bare CR");
  const lines = normalized.endsWith("\n")
    ? normalized.slice(0, -1).split("\n")
    : normalized.split("\n");
  assert.equal(lines[0], "id\tcompleted\tpriority\ttitle\tnote", "todo state header drifted");
  assert(lines.length > 1, "todo state contains no records");
  const records = lines.slice(1).map((line, index) => {
    const fields = line.split("\t");
    assert.equal(fields.length, 5, `todo state line ${index + 2} has the wrong field count`);
    const [id, completed, priority, title, note] = fields;
    assert(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id), `todo state line ${index + 2} has an unsafe id`);
    assert(new Set(["true", "false"]).has(completed), `todo state line ${index + 2} has an invalid status`);
    assert(new Set(["P0", "P1", "P2"]).has(priority), `todo state line ${index + 2} has an invalid priority`);
    assert.equal(title.trim(), title, `todo state line ${index + 2} has an untrimmed title`);
    assert.equal(note.trim(), note, `todo state line ${index + 2} has an untrimmed note`);
    assert(title.length > 0 && title.length <= 120, `todo state line ${index + 2} has an invalid title length`);
    assert(note.length > 0 && note.length <= 240, `todo state line ${index + 2} has an invalid note length`);
    return Object.freeze({ id, completed: completed === "true", priority, title, note });
  });
  assert.equal(new Set(records.map((record) => record.id)).size, records.length, "todo state ids are not unique");
  return records;
}

function assertNodeVersion(exactNode) {
  if (exactNode) {
    assert(
      SUPPORTED_NODE_VERSIONS.has(process.versions.node),
      `expected an exact evidence Node lane, received ${process.versions.node}`,
    );
    return;
  }

  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(process.versions.node);
  assert(match !== null, `could not parse Node ${process.versions.node}`);
  const major = Number(match[1]);
  const minor = Number(match[2]);
  assert(
    major > 20 || (major === 20 && minor >= 9),
    `todo app source validation requires Node >=20.9.0, received ${process.versions.node}`,
  );
}

async function sourceProof({ exactNode = false } = {}) {
  assertNodeVersion(exactNode);
  const haxe = run("haxe", ["--version"]).trim();
  assert.equal(haxe, "4.3.7", "todo app requires the pinned Haxe compiler");

  for (const [name, version] of EXPECTED_VERSIONS) {
    const installed = await readJson(path.join(ROOT, "node_modules", name, "package.json"));
    assert.equal(installed.version, version, `${name} installation drifted`);
  }

  const packageValue = await readJson(path.join(EXAMPLE, "package.json"));
  assert.equal(packageValue.private, true, "the evidence app must remain non-publishable");
  assert.deepEqual(packageValue.dependencies, {
    "@dnd-kit/helpers": "0.5.0",
    "@dnd-kit/react": "0.5.0",
    "@nextjshx/showcase-ui": "0.0.0",
    next: "16.2.12",
    nuqs: "2.9.1",
    react: "19.2.7",
    "react-dom": "19.2.7",
    "react-is": "19.2.7",
    recharts: "3.8.1",
  });
  assert.deepEqual(packageValue.devDependencies, {
    "@tailwindcss/cli": "4.3.3",
    tailwindcss: "4.3.3",
    typescript: "6.0.2",
  });
  assert.deepEqual(packageValue.overrides, {
    "@reduxjs/toolkit": "2.10.1",
  });
  const rechartsToolkit = await readJson(
    path.join(ROOT, "node_modules/recharts/node_modules/@reduxjs/toolkit/package.json"),
  );
  assert.equal(
    rechartsToolkit.version,
    "2.10.1",
    "Recharts must retain the strict-TypeScript-compatible Redux Toolkit resolution",
  );
  const rechartsImmer = await readJson(path.join(ROOT, "node_modules/immer/package.json"));
  assert.equal(rechartsImmer.version, "10.2.0", "Recharts compatibility pin lost Immer 10.2.0");
  assert.equal("exports" in packageValue, false, "Haxe-first Todo package retained native implementation exports");
  assert.deepEqual(packageValue.scripts, {
    styles: "tailwindcss -i styles/app.css -o public/styles.css --minify",
    build: "npm run styles && nextjshx build",
    dev: "node ../../scripts/examples/dev-with-styles.mjs",
    start: "next start",
  });

  const config = await readJson(NEXTJSHX_CONFIG);
  assert.equal(config.schemaVersion, 1, "todo app config schema drifted");
  assert.equal(config.appRoot, "app", "todo app App Router root drifted");
  assert.equal(config.haxe.hxml, "nextjshx.hxml", "todo app hxml drifted");
  assert.equal(config.haxe.generatedRoot, "src-gen", "todo app generated root drifted");
  assert.deepEqual(config.next, {
    package: "next",
    typedRoutes: true,
    cacheComponents: true,
  });
  assert.equal(
    await fs.readFile(NEXT_CONFIG, "utf8"),
    `/** @type {import('next').NextConfig} */
const nextConfig = {
  cacheComponents: true,
  typedRoutes: true,
};

export default nextConfig;
`,
    "todo app native Next config drifted",
  );

  const seed = await fs.readFile(SEED, "utf8");
  const records = parseState(seed);
  assert.deepEqual(records.map((record) => record.id), EXPECTED_IDS, "deterministic seed order drifted");
  assert.deepEqual(records.map((record) => record.completed), [false, true, false]);

  const haxeFiles = (await walk(path.join(EXAMPLE, "haxe"))).filter((file) => file.endsWith(".hx"));
  for (const file of haxeFiles) {
    const source = await fs.readFile(file, "utf8");
    assertNoHaxeEscape(path.relative(ROOT, file), source);
  }
  const commandCenter = await fs.readFile(
    path.join(EXAMPLE, "haxe/todoapp/client/TodoCommandCenter.hx"),
    "utf8",
  );
  for (const fragment of [
    "private enum abstract TodoCommand(String)",
    "final select = function(_value:String):Void",
    "execute(command, props);",
    "openTodo(todo, props);",
    "onSelect={select}",
    "props.discovery.selectStatus(TodoStatusFilter.Open)",
    "props.discovery.selectPriority(TodoPriorityFilter.Critical)",
    "props.discovery.selectView(TodoView.Board)",
    "props.router.push(TodoDetailPage.href({id: todo.id}))",
  ]) {
    assert(commandCenter.includes(fragment), `typed Todo command source lost ${fragment}`);
  }
  assert(
    !/onSelect=\{(?:value|commandValue)\s*->/.test(commandCenter),
    "Todo command dispatch must capture a closed Haxe identity instead of switching on cmdk text",
  );
  const planning = await fs.readFile(
    path.join(EXAMPLE, "haxe/todoapp/client/TodoPlanning.hx"),
    "utf8",
  );
  for (const fragment of [
    "case TodoPriority.Critical:",
    "case TodoPriority.Important:",
    "case TodoPriority.Routine:",
    'StackedBars.row("P0", p0Open, p0Completed)',
    'StackedBars.row("P1", p1Open, p1Completed)',
    'StackedBars.row("P2", p2Open, p2Completed)',
  ]) {
    assert(planning.includes(fragment), `typed Todo planning source lost ${fragment}`);
  }
  const sortableListSource = await fs.readFile(
    path.join(EXAMPLE, "haxe/todoapp/client/SortableTodoList.hx"),
    "utf8",
  );
  for (const fragment of [
    "import todoapp.client.TodoPlanning.project;",
    "final planning = project(projection.visible);",
    "<BarChart",
    "<CartesianGrid",
    "<XAxis",
    "<YAxis",
    "<Bar dataKey={chart.primary.key}",
    "<Bar dataKey={chart.secondary.key}",
    '<table className="planning-table">',
  ]) {
    assert(sortableListSource.includes(fragment), `Todo planning surface lost ${fragment}`);
  }
  assert(!sortableListSource.includes("Tooltip"), "Todo planning surface crossed the broad Tooltip payload");
  const mutationHook = await fs.readFile(
    path.join(EXAMPLE, "haxe/todoapp/client/MutationHook.hx"),
    "utf8",
  );
  assertNoHaxeEscape("haxe/todoapp/client/MutationHook.hx", mutationHook);
  assert(mutationHook.includes("RawReact.useActionState"), "todo mutation hook lost its React 19 action state");
  assert(mutationHook.includes("RawReact.useSyncExternalStore"), "todo mutation hook lost browser online/offline subscription");
  assert(mutationHook.includes("startTransition("), "imperative todo mutations lost their React Action transition");
  assert(mutationHook.includes("active.current"), "todo mutation hook lost its synchronous duplicate-submit guard");
  assert(mutationHook.includes('submission.set("mutationId"'), "todo mutation hook lost its replay identity");
  assert(mutationHook.includes("lastSubmission.current"), "todo mutation hook lost its retryable closed FormData snapshot");
  assert(
    mutationHook.includes("Promise.resolve(true).then(_ready -> action(previous, formData))") &&
      mutationHook.includes("_error -> {"),
    "todo transport failures must share a redacted Promise rejection path",
  );
  assert(!mutationHook.includes("NEXTJSHX_TODO_MUTATION_"), "test fault controls leaked into the production mutation hook");
  assert(mutationHook.includes("router.refresh()"), "successful todo mutations lost their server-view refresh");
  assert(
    mutationHook.includes("previous:TodoMutationState") && mutationHook.includes("formData:WebFormData"),
    "todo mutation hook widened its action signature",
  );
  const failureHook = await fs.readFile(
    path.join(EXAMPLE, "haxe/todoapp/client/FailureRecoveryHook.hx"),
    "utf8",
  );
  assertNoHaxeEscape("haxe/todoapp/client/FailureRecoveryHook.hx", failureHook);
  assert(failureHook.includes("useState(false)"), "todo failure drill lost its Haxe semantic state");
  assert(
    failureHook.includes("FIELD_LEDGER_RECOVERABLE_RENDER"),
    "todo failure drill lost its stable expected-error marker",
  );
  const environment = await fs.readFile(path.join(EXAMPLE, "app/environment.d.ts"), "utf8");
  assert(environment.includes('import type { JSX as ReactJSX } from "react"'));
  assert(environment.includes("type Element = ReactJSX.Element"));
  assert(environment.includes("interface IntrinsicElements extends ReactJSX.IntrinsicElements"));
  const e2e = await fs.readFile(E2E, "utf8");
  assert.equal(
    e2e.match(/^test\("/gm)?.length ?? 0,
    14,
    "todo app must retain fourteen isolated production browser journeys",
  );
  for (const fragment of [
    "renders useful List and Board states when the persisted ledger is empty",
    '"id\\tcompleted\\tpriority\\ttitle\\tnote\\n"',
    'name: "The field desk is clear."',
    '"No open notes in this lens."',
    '"Nothing is filed in this lens."',
  ]) {
    assert(e2e.includes(fragment), `todo empty-ledger evidence lost ${fragment}`);
  }
  console.log(
    `[todoapp-next] source: OK: ${records.length} deterministic records, closed TSV schema, exact pins, and ${haxeFiles.length} escape-free Haxe modules`,
  );
}

async function walk(directory) {
  const files = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(absolute)));
    } else if (entry.isFile()) {
      files.push(absolute);
    } else {
      throw new TodoAppFailure(`unexpected link or special file under ${path.relative(ROOT, directory)}`);
    }
  }
  return files.sort();
}

async function removeGeneratedState({ keepBuild = false } = {}) {
  await Promise.all([
    fs.rm(GENERATED, { recursive: true, force: true }),
    fs.rm(CONTROL, { recursive: true, force: true }),
    ...[...GENERATED_ADAPTERS, ...LEGACY_GENERATED_ADAPTERS].map((relative) =>
      fs.rm(path.join(EXAMPLE, relative), { force: true }),
    ),
    fs.rm(path.join(EXAMPLE, "next-env.d.ts"), { force: true }),
    fs.rm(path.join(EXAMPLE, "tsconfig.tsbuildinfo"), { force: true }),
    fs.rm(path.join(EXAMPLE, "public/styles.css"), { force: true }),
    ...(keepBuild ? [] : [fs.rm(path.join(EXAMPLE, ".next"), { recursive: true, force: true })]),
  ]);
  await removeEmptyAdapterDirectories();
}

async function removePublishedSources() {
  await Promise.all([
    fs.rm(GENERATED, { recursive: true, force: true }),
    fs.rm(path.join(CONTROL, "default-plan.json"), { force: true }),
    fs.rm(path.join(CONTROL, "manifest.json"), { force: true }),
    ...[...GENERATED_ADAPTERS, ...LEGACY_GENERATED_ADAPTERS].map((relative) =>
      fs.rm(path.join(EXAMPLE, relative), { force: true }),
    ),
  ]);
  await removeEmptyAdapterDirectories();
}

async function removeEmptyAdapterDirectories() {
  const directories = [
    path.join(EXAMPLE, "app/_nextjshx/cache/todos"),
    path.join(EXAMPLE, "app/_nextjshx/cache"),
    path.join(EXAMPLE, "app/_nextjshx/client/45c189dd56d6"),
    path.join(EXAMPLE, "app/_nextjshx/client/59f0e8dccc14"),
    path.join(EXAMPLE, "app/_nextjshx/client/7bfeb2f12e2a"),
    path.join(EXAMPLE, "app/_nextjshx/client/af0bcfc585a9"),
    path.join(EXAMPLE, "app/_nextjshx/client/ec33c886dc20"),
    path.join(EXAMPLE, "app/_nextjshx/client"),
    path.join(EXAMPLE, "app/_nextjshx"),
    path.join(EXAMPLE, "app/actions"),
    path.join(EXAMPLE, "app/api/todos"),
    path.join(EXAMPLE, "app/api"),
    path.join(EXAMPLE, "app/components"),
    path.join(EXAMPLE, "app/todos/[id]"),
    path.join(EXAMPLE, "app/todos"),
  ];
  for (const directory of directories) {
    await fs.rmdir(directory).catch((error) => {
      if (error.code !== "ENOENT" && error.code !== "ENOTEMPTY") {
        throw error;
      }
    });
  }
}

async function linkWorkspaceDependencies() {
  const created = [];
  for (const name of LINKED_PACKAGES) {
    const source = path.join(ROOT, "node_modules", name);
    const destination = path.join(EXAMPLE, "node_modules", name);
    await fs.access(path.join(source, "package.json"));
    try {
      await fs.lstat(destination);
    } catch (error) {
      if (error.code !== "ENOENT") {
        throw error;
      }
      await fs.mkdir(path.dirname(destination), { recursive: true });
      await fs.symlink(source, destination, "dir");
      created.push(destination);
    }
  }
  return created;
}

async function removeFixtureLinks(created) {
  for (const link of created.reverse()) {
    await fs.rm(link, { force: true });
  }
  for (const scope of ["@dnd-kit", "@nextjshx", "@tailwindcss"]) {
    await fs.rmdir(path.join(EXAMPLE, "node_modules", scope)).catch((error) => {
      if (error.code !== "ENOENT" && error.code !== "ENOTEMPTY") {
        throw error;
      }
    });
  }
  await fs.rmdir(path.join(EXAMPLE, "node_modules")).catch((error) => {
    if (error.code !== "ENOENT" && error.code !== "ENOTEMPTY") {
      throw error;
    }
  });
}

function assertNoTypeScriptEscape(name, source, { allowDecodedUnknown = false } = {}) {
  assert(!/Register\.unsafeCast/.test(source), `${name} contains an unchecked compiler cast`);
  assert(!/@ts-(?:ignore|nocheck)/.test(source), `${name} suppresses TypeScript`);
  assert(!/from ["']next\/dist\//.test(source), `${name} imports a private Next runtime`);
  const parsed = ts.createSourceFile(name, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let assertion = null;
  let broadType = null;
  const inspect = (node) => {
    if (ts.isAsExpression(node) || ts.isTypeAssertionExpression(node)) {
      assertion = node;
      return;
    }
    if (
      node.kind === ts.SyntaxKind.AnyKeyword ||
      (!allowDecodedUnknown && node.kind === ts.SyntaxKind.UnknownKeyword)
    ) {
      broadType = node;
      return;
    }
    ts.forEachChild(node, inspect);
  };
  inspect(parsed);
  assert.equal(broadType, null, `${name} contains a broad TypeScript type`);
  assert.equal(assertion, null, `${name} contains a TypeScript assertion`);
}

async function verifyGeneratedOutput() {
  const sourceFiles = [
    "nextjs/integrations/dndkit/DndKit.tsx",
    "nextjs/integrations/recharts/StackedBars.tsx",
    "nextjs/raw/integrations/recharts/ChartTypes.tsx",
    "todoapp/actions/TodoActions.tsx",
    "todoapp/app/RootLayout.tsx",
    "todoapp/app/TodoListPage.tsx",
    "todoapp/app/TodoDetailPage.tsx",
    "todoapp/app/TodoError.tsx",
    "todoapp/app/TodoLoading.tsx",
    "todoapp/app/TodoNotFound.tsx",
    "todoapp/cache/CachedTodos.tsx",
    "todoapp/client/CreateTodoForm.tsx",
    "todoapp/client/FailureRecoveryProbe.tsx",
    "todoapp/client/MutationHook.tsx",
    "todoapp/client/SortableTodoList.tsx",
    "todoapp/client/SortableTodoRow.tsx",
    "todoapp/client/TodoCommandCenter.tsx",
    "todoapp/client/TodoDiscovery.tsx",
    "todoapp/client/TodoPlanning.tsx",
    "todoapp/client/TodoRowActions.tsx",
    "todoapp/mutations/TodoMutationState.tsx",
    "todoapp/persistence/TodoStore.tsx",
    "todoapp/persistence/TodoRuntime.tsx",
  ];
  for (const relative of sourceFiles) {
    const source = await fs.readFile(path.join(GENERATED, relative), "utf8");
    assertNoTypeScriptEscape(relative, source);
  }

  // A pure @:jsRequire extern is a direct host import, not an implementation
  // owner. Emitting an empty wrapper here would be unlike handwritten Node.js.
  for (const extension of ["ts", "tsx", "js", "jsx"]) {
    await assert.rejects(
      fs.access(path.join(GENERATED, `todoapp/persistence/NodeFiles.${extension}`)),
      (error) => error.code === "ENOENT",
      `NodeFiles.${extension} should remain a direct node:fs extern without a generated module`,
    );
  }

  const store = await fs.readFile(path.join(GENERATED, "todoapp/persistence/TodoStore.tsx"), "utf8");
  assert(store.includes('import * as NodeFiles from "node:fs"'), "todo store lost its public Node file seam");
  assert(store.includes('".nextjshx/runs"'), "todo store lost its per-run state root");
  assert(store.includes("NEXTJSHX_TODO_RUN_ID"), "todo store lost its explicit run isolation key");
  assert(store.includes('"/todoapp-state.tsv"'), "todo store lost its isolated runtime filename");
  assert(store.includes('"data/seed.tsv"'), "todo store lost its clean-build fallback");
  const runtime = await fs.readFile(path.join(GENERATED, "todoapp/persistence/TodoRuntime.tsx"), "utf8");
  assert(runtime.includes('from "node:timers/promises"'), "todo loading proof lost its public Node timer seam");
  assert(runtime.includes("NEXTJSHX_TODO_DETAIL_DELAY_MS"), "todo loading proof lost its explicit delay input");
  assert(runtime.includes('case "2000"'), "todo loading proof lost its bounded delay ceiling");

  const list = await fs.readFile(path.join(GENERATED, "todoapp/app/TodoListPage.tsx"), "utf8");
  assert(
    list.includes("app/_nextjshx/client/ec33c886dc20/CreateTodoForm"),
    "todo list lost its generated create-form ref",
  );
  assert(
    list.includes("app/_nextjshx/client/59f0e8dccc14/SortableTodoList"),
    "todo list lost its generated sortable-list ref",
  );
  assert(list.includes('import {Suspense} from "react"'), "todo list lost its direct typed Suspense boundary");
  assert(list.includes("<Suspense {...suspense}>"), "todo list lost its Haxe-typed Suspense props spread");
  assert(
    list.includes("app/_nextjshx/cache/todos/list"),
    "todo list bypassed its generated cached-function ref",
  );
  assert(list.includes('from "next/server"'), "todo list lost its explicit request-time connection boundary");

  const dndKit = await fs.readFile(
    path.join(GENERATED, "nextjs/integrations/dndkit/DndKit.tsx"),
    "utf8",
  );
  assert(dndKit.includes('import {arrayMove} from "@dnd-kit/helpers"'));
  assert(dndKit.includes('typeof(id) != "string"'));
  assert(dndKit.includes("isValidIndex(projected, items.length)"));

  const sortableList = await fs.readFile(
    path.join(GENERATED, "todoapp/client/SortableTodoList.tsx"),
    "utf8",
  );
  assert(sortableList.includes('import {DragDropProvider} from "@dnd-kit/react"'));
  assert(
    sortableList.includes("<Row key={todo.id} todo={todo} index={index} />"),
    "sortable rows lost stable React identity",
  );
  for (const boardFragment of [
    "TodoDiscovery.boardLanes(projection.visible)",
    'className="board-grid" role="group" aria-label="Todo status board"',
    'data-board-lane="open" aria-labelledby="board-open-title"',
    'data-board-lane="completed" aria-labelledby="board-completed-title"',
    'data-sortable-list="open-field-notes"',
    'data-sortable-list="completed-field-notes"',
    "reorder(openIds, event)",
    "reorder(completedIds, event)",
  ]) {
    assert(
      sortableList.includes(boardFragment),
      `sortable board lost handwritten TSX fragment ${boardFragment}`,
    );
  }
  assert.equal(
    sortableList.split("<DragDropProvider onDragEnd=").length - 1,
    3,
    "sortable workbench must keep one list provider and one provider per status lane",
  );
  assert(
    sortableList.includes('import {BarChart, CartesianGrid, XAxis, YAxis, Bar} from "recharts"'),
    "Todo planning view lost its canonical Recharts named import",
  );
  for (const chartFragment of [
    '<BarChart data={chart.rows} responsive accessibilityLayer layout="vertical" className="planning-chart"',
    '<CartesianGrid horizontal={false} vertical stroke="var(--planning-grid)" strokeDasharray="2 4" />',
    '<XAxis type="number" allowDecimals={false} axisLine={false} tickLine={false} tickCount={2} />',
    '<YAxis type="category" dataKey="category" axisLine={false} tickLine={false} width={34} />',
    '<table className="planning-table">',
    'data-planning-priority={row.category}',
  ]) {
    assert(sortableList.includes(chartFragment), `Todo planning output lost ${chartFragment}`);
  }
  assert.equal(sortableList.split("<Bar dataKey=").length - 1, 2, "Todo planning view must keep two typed stacked series");
  assert(!sortableList.includes("Tooltip"), "Todo planning output crossed the broad Tooltip payload");

  const stackedBars = await fs.readFile(
    path.join(GENERATED, "nextjs/integrations/recharts/StackedBars.tsx"),
    "utf8",
  );
  assert(stackedBars.includes('key: "primary" | "secondary"'));
  assert(stackedBars.includes('{"category": category, "primary": primary, "secondary": secondary}'));
  const planningOutput = await fs.readFile(
    path.join(GENERATED, "todoapp/client/TodoPlanning.tsx"),
    "utf8",
  );
  assert(planningOutput.includes('StackedBars.row("P0", p0Open, p0Completed)'));
  assert(planningOutput.includes('StackedBars.row("P1", p1Open, p1Completed)'));
  assert(planningOutput.includes('StackedBars.row("P2", p2Open, p2Completed)'));

  const commandCenter = await fs.readFile(
    path.join(GENERATED, "todoapp/client/TodoCommandCenter.tsx"),
    "utf8",
  );
  assert(
    commandCenter.includes('from "@nextjshx/showcase-ui/command"'),
    "Todo command center lost its direct source-owned component import",
  );
  assert(
    commandCenter.includes('command: "focus-create" | "focus-search"') &&
      commandCenter.includes('"view-board" | "view-list"'),
    "Todo command center widened its closed command identity",
  );
  assert(
    commandCenter.includes("static todoCommandItem(todo: Todo"),
    "Todo command center widened its contextual Todo payload",
  );
  assert(
    commandCenter.includes(".execute(command, props)") &&
      !commandCenter.includes(".execute(_value, props)"),
    "Todo command center dispatches cmdk search text instead of its checked Haxe command",
  );
  assert(
    commandCenter.includes("encodeURIComponent") &&
      commandCenter.includes('props1.push(`/todos/${__nextRoute0Encoded0}`)'),
    "Todo command center lost its generated typed detail href",
  );
  assert(
    !commandCenter.includes("__genesJsxPropName"),
    "Todo command center leaked compiler-only HXX prop carriers into source TSX",
  );

  const sortableRow = await fs.readFile(
    path.join(GENERATED, "todoapp/client/SortableTodoRow.tsx"),
    "utf8",
  );
  assert(sortableRow.includes('import {useSortable} from "@dnd-kit/react/sortable"'));
  assert(sortableRow.includes('useSortable({"id": props.todo.id, "index": props.index})'));
  assert(sortableRow.includes("<li {...rowProps} data-sortable-item=\"true\">"));
  assert(sortableRow.includes("ref={sortable.handleRef}"));
  assert(!sortableRow.includes("__genesJsxPropName"));

  const discovery = await fs.readFile(
    path.join(GENERATED, "todoapp/client/TodoDiscovery.tsx"),
    "utf8",
  );
  assert(discovery.includes('status: "all" | "done" | "open"'));
  assert(discovery.includes('priority: "P0" | "P1" | "P2" | "all"'));
  assert(discovery.includes('view: "board" | "list"'));
  assert(
    discovery.includes("static boardLanes(visible: Todo[]): TodoBoardLanes"),
    "todo discovery lost its closed status-lane projection",
  );
  for (const exactCallback of [
    'selectStatus: (arg0: "all" | "done" | "open") => void',
    'selectPriority: (arg0: "P0" | "P1" | "P2" | "all") => void',
    'selectView: (arg0: "board" | "list") => void',
  ]) {
    assert(discovery.includes(exactCallback), `todo discovery widened ${exactCallback}`);
  }
  assert(
    discovery.includes(
      'useQueryState<"all" | "done" | "open">("status", parseAsStringLiteral<"all" | "done" | "open">(["all", "open", "done"]).withDefault("all"))',
    ),
  );
  assert(
    discovery.includes(
      'useQueryState<"P0" | "P1" | "P2" | "all">("priority", parseAsStringLiteral<"P0" | "P1" | "P2" | "all">(["all", "P0", "P1", "P2"]).withDefault("all"))',
    ),
  );
  assert(
    discovery.includes(
      'useQueryState<"board" | "list">("view", parseAsStringLiteral<"board" | "list">(["list", "board"]).withDefault("list"))',
    ),
  );
  assert(
    !/\b(?:statusParser|priorityParser|viewParser|TypeArguments|ExplicitTypeArgumentCallSite)\b/.test(
      discovery,
    ),
    "todo discovery leaked compiler witnesses or avoidable parser locals",
  );
  assert(
    !/select(?:Status|Priority|View): \(arg0: string\)/.test(discovery),
    "todo discovery widened a closed callback domain",
  );
  for (const directTupleOperation of [
    "status[1](next)",
    "priority[1](next)",
    "view[1](next)",
    "status[1](null)",
    "priority[1](null)",
    "view[1](null)",
    "search[1](null)",
  ]) {
    assert(
      discovery.includes(directTupleOperation),
      `todo discovery lost direct tuple operation ${directTupleOperation}`,
    );
  }

  const cachedTodos = await fs.readFile(path.join(GENERATED, "todoapp/cache/CachedTodos.tsx"), "utf8");
  assert(cachedTodos.includes('from "next/cache"'), "cached todo implementation lost native cache controls");
  assert(!cachedTodos.includes('from "next/headers"'), "shared cached todos captured request APIs");
  assert(
    cachedTodos.includes("list(scope: string)"),
    "cached todo implementation lost its per-run cache-key argument",
  );

  const todoApi = await fs.readFile(path.join(GENERATED, "todoapp/routes/TodoApi.tsx"), "utf8");
  assertNoTypeScriptEscape("todoapp/routes/TodoApi.tsx", todoApi, { allowDecodedUnknown: true });
  assert.equal(
    todoApi.match(/\bunknown\b/g)?.length ?? 0,
    2,
    "todo API widened beyond its two safe request JSON projections",
  );
  assert.equal(
    todoApi.split("json(): Promise<unknown>").length - 1,
    2,
    "todo API lost the exact untrusted request JSON boundary",
  );
  assert(todoApi.includes('from "next/headers"'), "todo API lost request-context header and cookie reads");
  assert(todoApi.includes('from "next/cache"'), "todo API lost native tag revalidation");
  assert(
    todoApi.includes("app/_nextjshx/cache/todos/list"),
    "todo API bypassed its generated cached-function ref",
  );
  assert(
    !todoApi.includes("todoapp/cache/CachedTodos"),
    "todo API imported the raw cached implementation",
  );

  const actions = await fs.readFile(path.join(GENERATED, "todoapp/actions/TodoActions.tsx"), "utf8");
  assert(actions.includes('from "next/cache"'), "todo actions lost immediate native cache invalidation");
  assert(actions.includes("updateTag"), "todo actions lost read-your-own-writes invalidation");
  for (const operation of ['"create"', '"toggle"', '"remove"', '"reorder"']) {
    assert(actions.includes(operation), `todo action state lost closed operation ${operation}`);
  }
  assert(actions.includes(".wasApplied"), "todo actions lost replay detection");
  assert(actions.includes(".rememberApplied"), "todo actions lost successful replay receipts");

  const inputCodecs = await fs.readFile(path.join(GENERATED, "todoapp/input/TodoInputCodecs.tsx"), "utf8");
  assertNoTypeScriptEscape("todoapp/input/TodoInputCodecs.tsx", inputCodecs, { allowDecodedUnknown: true });
  assert.equal(
    inputCodecs.match(/\bunknown\b/g)?.length ?? 0,
    3,
    "todo codecs widened beyond their three immediately decoded JSON inputs",
  );
  for (const fragment of [
    "draftJson(value: unknown",
    "function (value: unknown, path: string)",
    "jsonPriority(value: unknown",
  ]) {
    assert(inputCodecs.includes(fragment), `todo codecs lost reviewed boundary ${fragment}`);
  }

  const detail = await fs.readFile(path.join(GENERATED, "todoapp/app/TodoDetailPage.tsx"), "utf8");
  assert(detail.includes('from "next/navigation"'), "todo detail lost Next-owned notFound control flow");
  assert(
    detail.includes("globalThis.Promise<import('next').Metadata>"),
    "todo detail lost generated metadata typing",
  );
  assert(
    detail.includes("app/_nextjshx/client/af0bcfc585a9/FailureRecoveryProbe"),
    "todo detail lost its generated recovery-probe boundary",
  );

  for (const relative of GENERATED_ADAPTERS) {
    const source = await fs.readFile(path.join(EXAMPLE, relative), "utf8");
    assertNoTypeScriptEscape(relative, source);
  }
  const actionAdapter = await fs.readFile(path.join(EXAMPLE, "app/actions/todos.ts"), "utf8");
  assert(actionAdapter.startsWith('"use server";'), "todo mutations lost their directive-first action adapter");
  for (const action of ["create", "toggle", "remove", "reorder"]) {
    assert(
      actionAdapter.includes(`export async function ${action}`),
      `todo action adapter lost its named async ${action} export`,
    );
  }
  const cacheAdapter = await fs.readFile(
    path.join(EXAMPLE, "app/_nextjshx/cache/todos/list.ts"),
    "utf8",
  );
  assert(cacheAdapter.includes("export async function list"), "todo cache adapter lost its async list export");
  assert.equal(cacheAdapter.split('"use cache"').length - 1, 1, "todo cache adapter lost its single directive");
  assert(
    cacheAdapter.indexOf('"use cache"') > cacheAdapter.indexOf("export async function list"),
    "todo cache directive escaped the generated function boundary",
  );
  const routeAdapter = await fs.readFile(path.join(EXAMPLE, "app/api/todos/route.ts"), "utf8");
  for (const method of ["GET", "POST"]) {
    assert(routeAdapter.includes(`export const ${method}:`), `todo API adapter lost its ${method} export`);
  }
  for (const relative of [
    "app/_nextjshx/client/45c189dd56d6/TodoRowActions.tsx",
    "app/_nextjshx/client/59f0e8dccc14/SortableTodoList.tsx",
    "app/_nextjshx/client/7bfeb2f12e2a/SortableTodoRow.tsx",
    "app/_nextjshx/client/af0bcfc585a9/FailureRecoveryProbe.tsx",
    "app/_nextjshx/client/ec33c886dc20/CreateTodoForm.tsx",
  ]) {
    const adapter = await fs.readFile(path.join(EXAMPLE, relative), "utf8");
    assert(adapter.startsWith('"use client";'), `${relative} lost its directive-first client adapter`);
  }
  for (const relative of [
    "todoapp/client/CreateTodoForm.tsx",
    "todoapp/client/SortableTodoList.tsx",
    "todoapp/client/TodoRowActions.tsx",
  ]) {
    const client = await fs.readFile(path.join(GENERATED, relative), "utf8");
    assert(client.includes("app/actions/todos"), `${relative} lost its generated Server Function ref`);
    assert(
      !client.includes("todoapp/actions/TodoActions"),
      `${relative} imported the raw server implementation into the client graph`,
    );
  }
  for (const relative of [
    "todoapp/client/CreateTodoForm.tsx",
    "todoapp/client/SortableTodoList.tsx",
    "todoapp/client/TodoRowActions.tsx",
  ]) {
    const client = await fs.readFile(path.join(GENERATED, relative), "utf8");
    assert(client.includes('useOptimistic'), `${relative} lost direct React optimistic state`);
    assert(!client.includes("Optimistic_Impl_"), `${relative} emitted a semantic optimistic wrapper`);
    assert(!client.includes("__genesJsxPropName"), `${relative} leaked a compiler JSX prop carrier`);
  }
  const failureProbe = await fs.readFile(
    path.join(GENERATED, "todoapp/client/FailureRecoveryProbe.tsx"),
    "utf8",
  );
  assert(
    failureProbe.includes('from "./FailureRecoveryHook"'),
    "todo recovery probe lost its direct Haxe Hook identity",
  );
  assert(
    !failureProbe.includes("todoapp/actions/TodoActions"),
    "todo recovery probe captured an unrelated server implementation",
  );
  const mutationHookOutput = await fs.readFile(
    path.join(GENERATED, "todoapp/client/MutationHook.tsx"),
    "utf8",
  );
  assertNoTypeScriptEscape("todoapp/client/MutationHook.tsx", mutationHookOutput);
  for (const fragment of [
    "function useTodoMutation(",
    "useActionState(execute, initialState)",
    "useSyncExternalStore(",
    "useCallback(",
    "startTransition(",
    "active.current",
    'submission.set("mutationId"',
    "lastSubmission.current",
    "router.refresh()",
  ]) {
    assert(mutationHookOutput.includes(fragment), `generated Todo mutation Hook lost ${fragment}`);
  }
  assert(
    !mutationHookOutput.includes("nextjshx-todoapp-example/mutation-hook"),
    "generated Todo clients retained the removed native mutation module",
  );
  const detailAdapter = await fs.readFile(path.join(EXAMPLE, "app/todos/[id]/page.tsx"), "utf8");
  for (const fragment of [
    'PageProps<"/todos/[id]">',
    "export const generateMetadata:",
    "export const generateStaticParams:",
    "export const maxDuration = 5;",
  ]) {
    assert(detailAdapter.includes(fragment), `detail adapter lost ${fragment}`);
  }
  const errorAdapter = await fs.readFile(path.join(EXAMPLE, "app/todos/error.tsx"), "utf8");
  assert(errorAdapter.startsWith('"use client";'), "todo error adapter lost its directive-first boundary");
  assert(errorAdapter.includes("error: Error & {"), "todo error adapter widened Next's error shape");
  assert(errorAdapter.includes("digest?: string;"), "todo error adapter lost Next's optional error digest");
  assert(errorAdapter.includes("reset: () => void"), "todo error adapter widened Next's reset callback");

  const manifest = await readJson(path.join(CONTROL, "manifest.json"));
  assert.deepEqual(
    manifest.outputs.map((output) => output.path),
    GENERATED_ADAPTERS,
    "todo app ownership manifest drifted",
  );
  const clientChunkFiles = (await walk(path.join(EXAMPLE, ".next/static/chunks"))).filter((file) =>
    file.endsWith(".js"),
  );
  const commandChunks = [];
  const planningChunks = [];
  for (const file of clientChunkFiles) {
    const source = await fs.readFile(file, "utf8");
    if (source.includes("Field Ledger command desk")) {
      commandChunks.push({ file, source });
    }
    if (source.includes("Open and completed field notes grouped by P0, P1, and P2 priority.")) {
      planningChunks.push({ file, source });
    }
  }
  assert.equal(commandChunks.length, 1, "production output must contain one identifiable command client chunk");
  assert.equal(planningChunks.length, 1, "production output must contain one identifiable planning client chunk");
  const interactiveChunks = new Map(
    [...commandChunks, ...planningChunks].map((chunk) => [chunk.file, chunk.source]),
  );
  const interactiveChunkBytes = [...interactiveChunks.values()].reduce(
    (total, source) => total + Buffer.byteLength(source),
    0,
  );
  const interactiveChunkGzipBytes = [...interactiveChunks.values()].reduce(
    (total, source) => total + gzipSync(source).byteLength,
    0,
  );
  assert(
    interactiveChunkBytes <= 560 * 1024,
    `flagship interactive chunks exceeded their 560 KiB raw ceiling: ${interactiveChunkBytes}`,
  );
  assert(
    interactiveChunkGzipBytes <= 170 * 1024,
    `flagship interactive chunks exceeded their 170 KiB gzip ceiling: ${interactiveChunkGzipBytes}`,
  );
  console.log(
    `[todoapp-next] generated-output: OK: ${sourceFiles.length + 2} audited emitted modules and ${GENERATED_ADAPTERS.length} owned adapters`,
  );
  console.log(
    `[todoapp-next] interactive-bundle: OK: ${interactiveChunkBytes} raw bytes / ${interactiveChunkGzipBytes} gzip bytes across ${interactiveChunks.size} identified client chunk(s)`,
  );
}

async function verifyReactLint() {
  const files = [
    "todoapp/client/MutationHook.tsx",
    "todoapp/client/FailureRecoveryHook.tsx",
    "todoapp/client/CreateTodoForm.tsx",
    "todoapp/client/FailureRecoveryProbe.tsx",
    "todoapp/client/SortableTodoList.tsx",
    "todoapp/client/TodoRowActions.tsx",
  ];
  for (const relative of files) {
    const absolute = path.join(GENERATED, relative);
    const results = await REACT_LINTER.lintText(
      await fs.readFile(absolute, "utf8"),
      { filePath: absolute },
    );
    const messages = results.flatMap((result) => result.messages);
    assert.equal(
      messages.filter((message) => message.severity === 2).length,
      0,
      `${relative}: ${messages.map((message) => `${message.ruleId}: ${message.message}`).join(" | ")}`,
    );
  }
}

async function verifyBuild() {
  await sourceProof({ exactNode: true });
  const authoredConfig = new Map(
    await Promise.all(
      [NEXT_CONFIG, NEXTJSHX_CONFIG, TSCONFIG].map(async (file) => [file, await fs.readFile(file, "utf8")]),
    ),
  );
  await removeGeneratedState();
  await fs.mkdir(CONTROL, { recursive: true, mode: 0o700 });
  await fs.copyFile(SEED, STATE);
  await fs.chmod(STATE, 0o600);
  assert.equal((await fs.stat(STATE)).mode & 0o777, 0o600, "runtime todo state must be owner-only");

  run("npm", ["run", "build", "--workspace", "@nextjshx/cli-internal"]);
  const createdLinks = await linkWorkspaceDependencies();
  try {
    run(process.execPath, [TAILWIND_BIN, "-i", "styles/app.css", "-o", "public/styles.css", "--minify"], {
      cwd: EXAMPLE,
    });
    run(process.execPath, [CLI_BIN, "build", "--", "--turbopack"], { cwd: EXAMPLE });
    await verifyGeneratedOutput();
    await verifyReactLint();
    for (const [file, expected] of authoredConfig) {
      assert.equal(
        await fs.readFile(file, "utf8"),
        expected,
        `${path.relative(ROOT, file)} was rewritten by the build`,
      );
    }
    await fs.access(path.join(EXAMPLE, ".next/BUILD_ID"));
    console.log("[todoapp-next] production build: OK");
  } finally {
    await removePublishedSources();
    await removeFixtureLinks(createdLinks);
  }
}

async function reservePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  assert(typeof address === "object" && address !== null, "could not reserve a loopback port");
  const port = address.port;
  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  return port;
}

async function stopServer(child, exitPromise) {
  if (child.exitCode === null && child.signalCode === null) {
    child.kill("SIGTERM");
    await Promise.race([exitPromise, new Promise((resolve) => setTimeout(resolve, 5_000))]);
  }
  if (child.exitCode === null && child.signalCode === null) {
    child.kill("SIGKILL");
    await exitPromise;
  }
}

async function waitForPage(port, route) {
  const deadline = Date.now() + 30_000;
  let lastError = new Error("server did not answer");
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}${route}`, {
        headers: { accept: "text/html" },
        signal: AbortSignal.timeout(2_000),
      });
      if (response.ok) {
        return response;
      }
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw lastError;
}

async function requestJson(port, route, init = {}) {
  const response = await fetch(`http://127.0.0.1:${port}${route}`, {
    ...init,
    signal: AbortSignal.timeout(10_000),
  });
  assert.match(
    response.headers.get("content-type") ?? "",
    /^application\/json(?:;|$)/,
    `${route} did not return JSON`,
  );
  return { response, body: await response.json() };
}

async function browserExecutable() {
  const configured = process.env.NEXTJSHX_CHROME;
  if (configured !== undefined && !path.isAbsolute(configured)) {
    throw new TodoAppFailure("NEXTJSHX_CHROME must be an absolute browser executable path");
  }
  const candidates = [
    configured,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ].filter((candidate) => candidate !== undefined);
  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch (error) {
      if (error.code !== "ENOENT" && error.code !== "EACCES") {
        throw error;
      }
    }
  }
  throw new TodoAppFailure("no system Chrome/Chromium executable found; configure NEXTJSHX_CHROME");
}

async function browserProof(port, statePath) {
  const executablePath = await browserExecutable();
  const browser = await chromium.launch({
    executablePath,
    headless: true,
    args: ["--disable-dev-shm-usage", "--no-sandbox"],
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const pageErrors = [];
    const consoleErrors = [];
    const networkNotFound = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") {
        consoleErrors.push(message.text());
      }
    });
    page.on("response", (response) => {
      if (response.status() === 404) {
        networkNotFound.push(new URL(response.url()).pathname);
      }
    });
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "networkidle", timeout: 20_000 });
    await page.locator("#todo-list-page:visible").waitFor({ state: "visible" });
    assert.equal(await page.locator(".todo-row").count(), 3, "browser saw the wrong todo count");
    assert.equal(
      await page.locator(".todo-link").first().textContent(),
      "Runtime state won the read",
      "browser did not render the isolated runtime state",
    );

    const requestHeaders = {
      accept: "application/json",
      "x-field-ledger-client": "runtime-proof",
      cookie: "field-ledger-visitor=bead-r04",
    };
    const apiList = await requestJson(port, "/api/todos", { headers: requestHeaders });
    assert.equal(apiList.response.status, 200, "typed todo GET returned the wrong status");
    assert.equal(apiList.body.ok, true, "typed todo GET lost its success discriminator");
    assert.equal(apiList.body.todos.length, 3, "typed todo GET returned the wrong cached projection");
    assert.deepEqual(
      apiList.body.request,
      { source: "runtime-proof", visitor: "bead-r04" },
      "Route Handler request APIs lost their header or cookie value",
    );

    const beforeMalformedApi = await fs.readFile(statePath, "utf8");
    const malformedApi = await requestJson(port, "/api/todos", {
      method: "POST",
      headers: { ...requestHeaders, "content-type": "application/json" },
      body: "{not-json",
    });
    assert.equal(malformedApi.response.status, 400, "malformed JSON did not return a client error");
    assert.deepEqual(
      malformedApi.body,
      {
        ok: false,
        todo: null,
        issues: [
          {
            code: "invalid_json",
            path: "$",
            message: "request body must contain valid JSON",
          },
        ],
        request: { source: "runtime-proof", visitor: "bead-r04" },
      },
      "malformed JSON lost its exact typed error body",
    );
    assert.equal(
      await fs.readFile(statePath, "utf8"),
      beforeMalformedApi,
      "malformed API JSON mutated persistence",
    );
    assert.equal(await page.locator(".todo-row").count(), 3, "malformed API JSON changed the visible ledger");

    const apiCreatedTitle = "Invalidate the shared cache";
    const apiCreatedId = "invalidate-the-shared-cache";
    const createdApi = await requestJson(port, "/api/todos", {
      method: "POST",
      headers: { ...requestHeaders, "content-type": "application/json" },
      body: JSON.stringify({
        title: apiCreatedTitle,
        note: "Prove a typed Route Handler expires the Haxe-owned cached list before the next server render.",
        priority: "P1",
      }),
    });
    assert.equal(createdApi.response.status, 201, "valid API create returned the wrong status");
    assert.equal(createdApi.body.ok, true, "valid API create lost its success discriminator");
    assert.deepEqual(createdApi.body.issues, [], "valid API create returned decode issues");
    assert.equal(createdApi.body.todo.id, apiCreatedId, "valid API create returned the wrong typed todo");
    assert.deepEqual(
      createdApi.body.request,
      { source: "runtime-proof", visitor: "bead-r04" },
      "valid API create lost request context",
    );
    assert.equal(
      await page.locator(".todo-row").count(),
      3,
      "an external mutation unexpectedly rewrote an already rendered browser tree",
    );
    await page.reload({ waitUntil: "networkidle", timeout: 20_000 });
    await page.locator("#todo-list-page:visible").waitFor({ state: "visible" });
    const apiCreatedRow = page.locator(".todo-row").filter({ hasText: apiCreatedTitle });
    await apiCreatedRow.waitFor({ state: "visible", timeout: 10_000 });
    assert.equal(await page.locator(".todo-row").count(), 4, "tag invalidation did not update the visible cached list");
    await apiCreatedRow.getByRole("button", { name: `Delete ${apiCreatedTitle}` }).click();
    await apiCreatedRow.waitFor({ state: "detached", timeout: 10_000 });
    assert.equal(await page.locator(".todo-row").count(), 3, "action invalidation did not restore the visible list");
    assert.equal(
      await fs.readFile(statePath, "utf8"),
      SMOKE_STATE,
      "API proof cleanup did not restore deterministic persistence",
    );

    await page.locator("#todo-title").fill("   ");
    await page.locator("#todo-note").fill("This should remain outside the ledger.");
    await page.locator("#create-todo-form button[type=submit]").click();
    await page.locator('#create-todo-issues li[data-path="form.title"]').waitFor({
      state: "visible",
      timeout: 10_000,
    });
    assert.equal(await page.locator(".todo-row").count(), 3, "invalid create mutated the ledger");
    assert.equal(
      await fs.readFile(statePath, "utf8"),
      SMOKE_STATE,
      "invalid create changed the persisted bytes",
    );
    assert.match(
      (await page.locator("#create-todo-status").textContent()) ?? "",
      /Review the marked intake fields/,
      "invalid create lost its typed validation summary",
    );

    const createdTitle = "Exercise typed mutations";
    const createdId = "exercise-typed-mutations";
    await page.locator("#todo-title").fill(createdTitle);
    await page.locator("#todo-note").fill("Prove create, refresh, dynamic detail, and delete through one native action boundary.");
    await page.locator("#todo-priority").selectOption("P1");
    await page.locator("#create-todo-form button[type=submit]").click();
    const createdRow = page.locator(".todo-row").filter({ hasText: createdTitle });
    await createdRow.waitFor({ state: "visible", timeout: 10_000 });
    assert.equal(await page.locator(".todo-row").count(), 4, "valid create did not refresh the server list");
    let stateRecords = parseState(await fs.readFile(statePath, "utf8"));
    const createdRecord = stateRecords.find((record) => record.id === createdId);
    assert(createdRecord !== undefined, "valid create did not persist its deterministic slug");
    assert.equal(createdRecord.priority, "P1", "valid create persisted the wrong priority");

    await createdRow.locator(".todo-link").click();
    await page.locator("#todo-detail-page:visible").waitFor({ state: "visible", timeout: 10_000 });
    assert.equal(new URL(page.url()).pathname, `/todos/${createdId}`);
    assert.equal(
      await page.locator("#todo-detail-page:visible h2").textContent(),
      createdTitle,
      "new dynamic todo route did not render",
    );
    await page.locator(".back-link:visible").click();
    await page.locator("#todo-list-page:visible").waitFor({ state: "visible", timeout: 10_000 });

    const firstRow = page.locator(".todo-row").filter({ hasText: "Runtime state won the read" });
    await firstRow.getByRole("button", { name: "Complete Runtime state won the read" }).click();
    await page.waitForFunction(() =>
      Array.from(document.querySelectorAll(".todo-row")).some(
        (row) => row.textContent?.includes("Runtime state won the read") && row.classList.contains("is-done"),
      ),
    );
    stateRecords = parseState(await fs.readFile(statePath, "utf8"));
    assert.equal(
      stateRecords.find((record) => record.id === "shape-first-release")?.completed,
      true,
      "toggle did not persist the completed state",
    );

    const refreshedCreatedRow = page.locator(".todo-row").filter({ hasText: createdTitle });
    await refreshedCreatedRow.getByRole("button", { name: `Delete ${createdTitle}` }).click();
    await refreshedCreatedRow.waitFor({ state: "detached", timeout: 10_000 });
    assert.equal(await page.locator(".todo-row").count(), 3, "delete did not refresh the server list");
    stateRecords = parseState(await fs.readFile(statePath, "utf8"));
    assert(!stateRecords.some((record) => record.id === createdId), "delete left the record in persistence");

    if (process.env.NEXTJSHX_TODO_SCREENSHOT === "1") {
      await page.screenshot({ path: path.join(path.dirname(statePath), "todoapp-preview.png"), fullPage: true });
    }
    await page.locator("#todo-list-page:visible .todo-link").first().click();
    await page.locator("#todo-detail-page:visible").waitFor({ state: "visible", timeout: 10_000 });
    assert.equal(new URL(page.url()).pathname, "/todos/shape-first-release");
    assert.equal(await page.locator("#todo-detail-page:visible h2").textContent(), "Runtime state won the read");
    await page.locator(".back-link:visible").click();
    await page.locator("#todo-list-page:visible").waitFor({ state: "visible", timeout: 10_000 });
    assert.equal(new URL(page.url()).pathname, "/");
    assert.deepEqual(pageErrors, [], `browser page errors: ${pageErrors.join(" | ")}`);
    assert.deepEqual(
      consoleErrors.filter((message) => !/Failed to load resource:.*404 \(Not Found\)/.test(message)),
      [],
      `browser console errors: ${consoleErrors.join(" | ")}`,
    );
    assert.deepEqual(
      networkNotFound.filter((pathname) => pathname !== "/favicon.ico"),
      [],
      `unexpected browser 404 resources: ${networkNotFound.join(", ")}`,
    );
    pageErrors.splice(0);
    consoleErrors.splice(0);
    networkNotFound.splice(0);

    const missingResponse = await page.goto(`http://127.0.0.1:${port}/todos/not-seeded`, {
      waitUntil: "networkidle",
      timeout: 20_000,
    });
    assert.equal(
      missingResponse?.status(),
      200,
      "browser lost Next's documented streamed not-found status",
    );
    await page.locator("#todo-not-found").waitFor({ state: "visible", timeout: 10_000 });
    assert.equal(await page.locator("#todo-not-found h2").textContent(), "No note lives here.");
    assert.equal(
      await page.locator('meta[name="robots"]').first().getAttribute("content"),
      "noindex",
      "hydrated not-found view lost Next's SEO protection",
    );
    assert.deepEqual(pageErrors, [], `not-found page errors: ${pageErrors.join(" | ")}`);
    const unexpectedConsoleErrors = consoleErrors.filter(
      (message) => !/Failed to load resource:.*404 \(Not Found\)/.test(message),
    );
    assert.deepEqual(
      unexpectedConsoleErrors,
      [],
      `unexpected not-found console errors: ${unexpectedConsoleErrors.join(" | ")}`,
    );
    assert(
      networkNotFound.every((pathname) => pathname === "/todos/not-seeded"),
      `not-found navigation produced unexpected 404 resources: ${networkNotFound.join(", ")}`,
    );
    console.log(
      "[todoapp-next] browser: OK: typed API errors/context, visible cache invalidation, action hydration, navigation, and clean diagnostics",
    );
  } finally {
    await browser.close();
  }
}

async function smoke() {
  await sourceProof({ exactNode: true });
  await fs.access(path.join(EXAMPLE, ".next/BUILD_ID"));
  parseState(SMOKE_STATE);
  const runId = `smoke-${process.pid}-${randomUUID()}`;
  const runRoot = path.join(CONTROL, "runs", runId);
  const statePath = path.join(runRoot, "todoapp-state.tsv");
  await fs.mkdir(runRoot, { recursive: true, mode: 0o700 });
  await fs.writeFile(statePath, SMOKE_STATE, { encoding: "utf8", mode: 0o600 });
  await fs.chmod(statePath, 0o600);
  assert.equal((await fs.stat(runRoot)).mode & 0o777, 0o700, "smoke run root must be owner-only");
  assert.equal((await fs.stat(statePath)).mode & 0o777, 0o600, "smoke state must be owner-only");

  const createdLinks = await linkWorkspaceDependencies();
  const port = await reservePort();
  const child = spawn(process.execPath, [NEXT_BIN, "start", ".", "-H", "127.0.0.1", "-p", String(port)], {
    cwd: EXAMPLE,
    env: { ...COMMAND_ENV, NEXTJSHX_TODO_RUN_ID: runId },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  child.stdout.on("data", (chunk) => {
    output += chunk;
    process.stdout.write(chunk);
  });
  child.stderr.on("data", (chunk) => {
    output += chunk;
    process.stderr.write(chunk);
  });
  const exitPromise = new Promise((resolve) => child.once("exit", resolve));

  try {
    const root = await waitForPage(port, "/");
    const rootHtml = await root.text();
    assert(rootHtml.includes('id="todo-list-page"'), "root route lost its Haxe list page");
    assert(rootHtml.includes("Runtime state won the read"), "root route did not reopen runtime persistence");
    assert(!rootHtml.includes("Shape the first release"), "root route froze build-time seed bytes");
    assert(rootHtml.includes('href="/todos/shape-first-release"'), "root route lost its typed detail href");
    assert(rootHtml.includes("2 open / 3 total"), "root route computed the wrong deterministic count");

    const detail = await fetch(`http://127.0.0.1:${port}/todos/shape-first-release`, {
      headers: { accept: "text/html" },
      signal: AbortSignal.timeout(10_000),
    });
    assert.equal(detail.status, 200, "known todo detail did not render");
    const detailHtml = await detail.text();
    assert(detailHtml.includes('id="todo-detail-page"'), "known detail lost its Haxe page");
    assert(detailHtml.includes("Runtime state won the read — Field Ledger"), "known detail lost generated metadata");
    assert(detailHtml.includes("The production server reopened"), "known detail lost persisted bytes");

    const missing = await fetch(`http://127.0.0.1:${port}/todos/not-seeded`, {
      headers: { accept: "text/html" },
      signal: AbortSignal.timeout(10_000),
    });
    assert.equal(
      missing.status,
      200,
      "the todo loading boundary must preserve Next's documented streamed not-found status",
    );
    const missingHtml = await missing.text();
    if (process.env.NEXTJSHX_TODO_SCREENSHOT === "1") {
      await fs.writeFile(path.join(runRoot, "todoapp-not-found.html"), missingHtml, "utf8");
    }
    assert(missingHtml.includes("No note lives here"), "unknown todo lost not-found content");
    assert(
      missingHtml.includes('<meta name="robots" content="noindex"'),
      "streamed not-found response lost Next's required noindex protection",
    );
    assert(
      missingHtml.includes("NEXT_HTTP_ERROR_FALLBACK;404"),
      "streamed not-found response lost Next's internal 404 control-flow marker",
    );

    await browserProof(port, statePath);
    console.log(
      "[todoapp-next] smoke: OK: typed Route Handlers, cache invalidation, mutations, persistence, routes, metadata, and streamed not-found semantics",
    );
  } catch (error) {
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new TodoAppFailure(`Next production server exited unexpectedly:\n${output}`);
    }
    throw error;
  } finally {
    await stopServer(child, exitPromise);
    await fs.rm(runRoot, { recursive: true, force: true });
    await removeFixtureLinks(createdLinks);
  }
}

try {
  const mode = process.argv[2] ?? "verify";
  if (mode === "source") {
    await sourceProof();
  } else if (mode === "verify") {
    await verifyBuild();
  } else if (mode === "smoke") {
    await smoke();
  } else if (mode === "clean") {
    await removeGeneratedState();
    console.log("[todoapp-next] clean: OK");
  } else {
    throw new TodoAppFailure(`unknown mode ${mode}; expected source, verify, smoke, or clean`);
  }
} catch (error) {
  console.error(`[todoapp-next] ERROR: ${error.message}`);
  process.exitCode = 1;
}
