#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import net from "node:net";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright-core";
import ts from "typescript";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const CLI_BIN = path.join(ROOT, "tools/cli/.tmp/src/cli.js");
const NEXT_BIN = path.join(ROOT, "node_modules/next/dist/bin/next");
const TSC_BIN = path.join(ROOT, "node_modules/typescript/bin/tsc6");
const GENES_COMMIT = "603ed8349775f86438a8b5be99cafa1a36544644";
const SUPPORTED_NODE_VERSIONS = new Set(["20.19.3", "24.18.0"]);
const VIEWPORTS = Object.freeze([
  Object.freeze({ name: "desktop", width: 1440, height: 1000 }),
  Object.freeze({ name: "mobile", width: 390, height: 844 }),
]);
const COMMAND_ENV = Object.freeze({
  ...process.env,
  CI: "1",
  NO_COLOR: "1",
  NEXT_TELEMETRY_DISABLED: "1",
});
const BASE_SHOWCASE_DEPENDENCIES = Object.freeze({
  "@nextjshx/showcase-ui": "0.0.0",
  next: "16.2.12",
  react: "19.2.7",
  "react-dom": "19.2.7",
});

const SHOWCASES = Object.freeze([
  Object.freeze({
    name: "landing",
    workspace: "@nextjshx/showcase-landing",
    directory: path.join(ROOT, "examples/showcase-landing"),
    namespace: "landing",
    dependencies: BASE_SHOWCASE_DEPENDENCIES,
    adapters: Object.freeze([
      "app/_nextjshx/client/6846cd673a8e/TideDial.tsx",
      "app/layout.tsx",
      "app/page.tsx",
    ]),
    prerendered: Object.freeze(["/"]),
  }),
  Object.freeze({
    name: "blog",
    workspace: "@nextjshx/showcase-blog",
    directory: path.join(ROOT, "examples/showcase-blog"),
    namespace: "blog",
    dependencies: BASE_SHOWCASE_DEPENDENCIES,
    adapters: Object.freeze([
      "app/journal/[slug]/page.tsx",
      "app/journal/not-found.tsx",
      "app/layout.tsx",
      "app/page.tsx",
    ]),
    prerendered: Object.freeze([
      "/",
      "/journal/a-trail-is-a-promise",
      "/journal/after-the-burn",
      "/journal/reading-the-snowline",
    ]),
  }),
  Object.freeze({
    name: "commerce",
    workspace: "@nextjshx/showcase-commerce",
    directory: path.join(ROOT, "examples/showcase-commerce"),
    namespace: "commerce",
    dependencies: BASE_SHOWCASE_DEPENDENCIES,
    adapters: Object.freeze([
      "app/_nextjshx/client/d8b33991cc56/ShopClient.tsx",
      "app/_nextjshx/hook/c6198b90b72b/useShopCart.ts",
      "app/layout.tsx",
      "app/page.tsx",
      "app/products/[slug]/page.tsx",
      "app/products/not-found.tsx",
    ]),
    prerendered: Object.freeze([
      "/",
      "/products/frame-window-farm",
      "/products/mist-column",
      "/products/soil-block-press",
    ]),
  }),
  Object.freeze({
    name: "field-atlas",
    workspace: "@nextjshx/showcase-field-atlas",
    directory: path.join(ROOT, "examples/showcase-field-atlas"),
    namespace: "field_atlas",
    dependencies: Object.freeze({
      "@mdx-js/loader": "3.1.1",
      "@mdx-js/react": "3.1.1",
      "@next/mdx": "16.2.12",
      ...BASE_SHOWCASE_DEPENDENCIES,
      "react-is": "19.2.7",
      recharts: "3.8.1",
      "rehype-pretty-code": "0.14.5",
      "rehype-slug": "6.0.0",
      "remark-gfm": "4.0.1",
    }),
    adapters: Object.freeze([
      "app/_nextjshx/client/df20b53d0458/SignalPlot.tsx",
      "app/briefing/page.tsx",
      "app/layout.tsx",
      "app/page.tsx",
      "mdx-components.tsx",
    ]),
    rootAdapters: Object.freeze(["mdx-components.tsx"]),
    prerendered: Object.freeze(["/", "/briefing", "/dispatches/soil-signals"]),
  }),
]);

class ShowcaseFailure extends Error {}

function commandLine(command, args) {
  return [command, ...args]
    .map((value) => (/^[A-Za-z0-9_./:=@-]+$/.test(value) ? value : JSON.stringify(value)))
    .join(" ");
}

function run(command, args, options = {}) {
  const cwd = options.cwd ?? ROOT;
  console.log(`[showcases] $ ${commandLine(command, args)}`);
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    env: COMMAND_ENV,
    maxBuffer: 64 * 1024 * 1024,
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

async function exists(file) {
  try {
    await fs.access(file);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

async function pathExists(file) {
  try {
    await fs.access(file);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

async function walk(directory, options = {}) {
  if (!(await pathExists(directory))) {
    return [];
  }
  const files = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    if (options.ignore?.has(entry.name) === true) {
      continue;
    }
    const absolute = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) {
      throw new ShowcaseFailure(`${path.relative(ROOT, absolute)} must not be a symbolic link`);
    }
    if (entry.isDirectory()) {
      files.push(...(await walk(absolute, options)));
    } else if (entry.isFile()) {
      files.push(absolute);
    } else {
      throw new ShowcaseFailure(`${path.relative(ROOT, absolute)} is a special filesystem entry`);
    }
  }
  return files.sort();
}

function stripHaxeComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

function assertHaxeSource(file, source) {
  const code = stripHaxeComments(source);
  for (const forbidden of [
    /\bDynamic\b/,
    /\bAny\b/,
    /\buntyped\b/,
    /genes\.ts\.Unknown/,
    /\bcast\s*(?:\(|[A-Za-z_{[])/,
  ]) {
    assert(!forbidden.test(code), `${path.relative(ROOT, file)} contains ${forbidden}`);
  }
  assert(
    !/[A-Za-z_:][A-Za-z0-9_:-]*=\{"[^"{}]*"\}/.test(code),
    `${path.relative(ROOT, file)} wraps a static HXX string in a redundant expression container`,
  );
}

function declaredInitializer(statements, name) {
  for (const statement of statements) {
    if (!ts.isVariableStatement(statement)) {
      continue;
    }
    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && declaration.name.text === name) {
        return declaration.initializer ?? null;
      }
    }
  }
  return null;
}

function isGenesBoundedArrayRead(node) {
  const access = node.expression;
  if (
    !ts.isElementAccessExpression(access) ||
    !ts.isIdentifier(access.expression) ||
    !ts.isIdentifier(access.argumentExpression)
  ) {
    return false;
  }

  let loop = node.parent;
  while (loop !== undefined && !ts.isWhileStatement(loop)) {
    loop = loop.parent;
  }
  if (
    loop === undefined ||
    !ts.isBinaryExpression(loop.expression) ||
    loop.expression.operatorToken.kind !== ts.SyntaxKind.LessThanToken ||
    !ts.isIdentifier(loop.expression.left) ||
    !ts.isBlock(loop.parent) ||
    !ts.isBlock(loop.statement)
  ) {
    return false;
  }

  const counterName = loop.expression.left.text;
  const loopIndex = loop.parent.statements.indexOf(loop);
  let boundedArrayName = null;
  if (ts.isIdentifier(loop.expression.right)) {
    const boundInitializer = declaredInitializer(
      loop.parent.statements.slice(0, loopIndex),
      loop.expression.right.text,
    );
    if (
      boundInitializer !== null &&
      ts.isPropertyAccessExpression(boundInitializer) &&
      boundInitializer.name.text === "length" &&
      ts.isIdentifier(boundInitializer.expression)
    ) {
      boundedArrayName = boundInitializer.expression.text;
    }
  } else if (
    ts.isPropertyAccessExpression(loop.expression.right) &&
    loop.expression.right.name.text === "length" &&
    ts.isIdentifier(loop.expression.right.expression)
  ) {
    boundedArrayName = loop.expression.right.expression.text;
  }
  if (boundedArrayName !== access.expression.text) {
    return false;
  }

  if (access.argumentExpression.text === counterName) {
    let accessStatement = node.parent;
    while (accessStatement.parent !== loop.statement) {
      accessStatement = accessStatement.parent;
    }
    const accessStatementIndex = loop.statement.statements.indexOf(accessStatement);
    return loop.statement.statements.slice(accessStatementIndex + 1).some((statement) => {
      if (!ts.isExpressionStatement(statement)) {
        return false;
      }
      const expression = statement.expression;
      return (
        ((ts.isPrefixUnaryExpression(expression) || ts.isPostfixUnaryExpression(expression)) &&
          expression.operator === ts.SyntaxKind.PlusPlusToken &&
          ts.isIdentifier(expression.operand) &&
          expression.operand.text === counterName)
      );
    });
  }

  const indexInitializer = declaredInitializer(
    loop.statement.statements,
    access.argumentExpression.text,
  );
  return (
    indexInitializer !== null &&
    ts.isPostfixUnaryExpression(indexInitializer) &&
    indexInitializer.operator === ts.SyntaxKind.PlusPlusToken &&
    ts.isIdentifier(indexInitializer.operand) &&
    indexInitializer.operand.text === counterName
  );
}

function assertTypeScriptSource(file, source, options = {}) {
  assert(!/@ts-(?:ignore|nocheck)/.test(source), `${path.relative(ROOT, file)} suppresses TypeScript`);
  assert(!/from ["']next\/dist\//.test(source), `${path.relative(ROOT, file)} imports private Next runtime code`);
  const kind = file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const parsed = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, kind);
  let violation = null;
  const inspect = (node) => {
    if (violation !== null) {
      return;
    }
    if (node.kind === ts.SyntaxKind.AnyKeyword) {
      violation = "TypeScript any";
      return;
    }
    if (node.kind === ts.SyntaxKind.UnknownKeyword) {
      violation = "TypeScript unknown";
      return;
    }
    if (ts.isAsExpression(node) || ts.isTypeAssertionExpression(node)) {
      violation = "a TypeScript assertion";
      return;
    }
    if (
      ts.isNonNullExpression(node) &&
      !(options.allowGenesBoundedArrayReads === true && isGenesBoundedArrayRead(node))
    ) {
      violation = "a TypeScript non-null assertion";
      return;
    }
    ts.forEachChild(node, inspect);
  };
  inspect(parsed);
  assert.equal(violation, null, `${path.relative(ROOT, file)} contains ${violation}`);
}

function verifyTypeScriptAssertionGuard() {
  const internalFile = path.join(ROOT, ".tmp/genes-bounded-array-read.ts");
  const mapLoop = `function map(items: string[]) {
    const result = new Array(items.length);
    let cursor = 0;
    const bound = items.length;
    while (cursor < bound) {
      const index = cursor++;
      result[index] = render(items[index]!);
    }
  }`;
  const iteratorLoop = `function iterate(items: string[]) {
    let cursor = 0;
    while (cursor < items.length) {
      const item = items[cursor]!;
      ++cursor;
      consume(item);
    }
  }`;
  const options = { allowGenesBoundedArrayReads: true };
  assertTypeScriptSource(internalFile, mapLoop, options);
  assertTypeScriptSource(internalFile, iteratorLoop, options);
  assert.throws(
    () => assertTypeScriptSource(internalFile, "const first = items[0]!;", options),
    /TypeScript non-null assertion/,
  );
  assert.throws(
    () => assertTypeScriptSource(internalFile, mapLoop),
    /TypeScript non-null assertion/,
  );
}

function assertNoLocalPath(file, source) {
  const relative = path.relative(ROOT, file);
  assert(!source.includes(ROOT), `${relative} contains the repository's machine-local path`);
  assert(
    !/(?:^|["'`\s])\/(?:Users|home|private|tmp|var\/folders)\//m.test(source),
    `${relative} contains a machine-local absolute path`,
  );
  assert(!/(?:^|["'`\s])[A-Za-z]:\\/m.test(source), `${relative} contains a Windows absolute path`);
}

async function verifySourceContracts() {
  verifyTypeScriptAssertionGuard();
  assert(
    SUPPORTED_NODE_VERSIONS.has(process.versions.node),
    `expected Node ${[...SUPPORTED_NODE_VERSIONS].join(" or ")}, found ${process.versions.node}`,
  );
  assert.equal(run("haxe", ["--version"]).trim(), "4.3.7", "showcases require Haxe 4.3.7");
  const genesLock = await fs.readFile(path.join(ROOT, "haxe_libraries/genes-ts.hxml"), "utf8");
  assert(genesLock.includes(GENES_COMMIT), "showcases lost the reviewed genes-ts commit");
  assertNoLocalPath(path.join(ROOT, "haxe_libraries/genes-ts.hxml"), genesLock);

  const uiPackage = await readJson(path.join(ROOT, "examples/showcase-ui/package.json"));
  assert.equal(uiPackage.private, true, "shared showcase UI must remain private");
  assert.deepEqual(Object.keys(uiPackage.exports).sort(), [
    "./badge",
    "./button",
    "./card",
    "./command",
    "./icons",
    "./input",
    "./separator",
    "./sheet",
    "./textarea",
    "./theme.css",
  ]);
  assert.deepEqual(uiPackage.peerDependencies, { react: "19.2.7", "react-dom": "19.2.7" });

  for (const showcase of SHOWCASES) {
    const packageValue = await readJson(path.join(showcase.directory, "package.json"));
    assert.equal(packageValue.name, showcase.workspace, `${showcase.name} workspace name drifted`);
    assert.equal(packageValue.private, true, `${showcase.name} must remain non-publishable`);
    assert.deepEqual(packageValue.dependencies, showcase.dependencies);
    assert.deepEqual(packageValue.devDependencies, {
      "@tailwindcss/cli": "4.3.3",
      tailwindcss: "4.3.3",
      typescript: "6.0.2",
    });

    const config = await readJson(path.join(showcase.directory, "nextjshx.config.json"));
    assert.equal(config.schemaVersion, 2, `${showcase.name} config schema drifted`);
    assert.equal(config.appRoot, "app", `${showcase.name} App Router root drifted`);
    assert.deepEqual(
      config.haxe.sourceRoots,
      ["haxe", "../showcase-ui/haxe"],
      `${showcase.name} Haxe source roots drifted`,
    );
    assert.equal(config.haxe.generatedRoot, "src-gen", `${showcase.name} generated root drifted`);
    assert.equal(
      "hxml" in config.haxe,
      false,
      `${showcase.name} config exposes compiler-owned HXML`,
    );
    assert.equal(
      "defines" in config.haxe,
      false,
      `${showcase.name} config exposes compiler-owned defines`,
    );
    assert.deepEqual(config.next, { package: "next", typedRoutes: true });
    const legacyMain = {
      landing: "LandingMain.hx",
      blog: "BlogMain.hx",
      commerce: "CommerceMain.hx",
      "field-atlas": "FieldAtlasMain.hx",
    }[showcase.name];
    for (const relative of [
      "nextjshx.hxml",
      `haxe/${legacyMain}`,
      `haxe/${showcase.namespace}/AdapterPlan.hx`,
    ]) {
      assert.equal(
        await exists(path.join(showcase.directory, relative)),
        false,
        `${showcase.name} retains compiler plumbing: ${relative}`,
      );
    }
  }

  const roots = [path.join(ROOT, "examples/showcase-ui"), ...SHOWCASES.map((item) => item.directory)];
  const generatedAdapters = new Set(
    SHOWCASES.flatMap((showcase) =>
      showcase.adapters.map((relative) => path.join(showcase.directory, relative)),
    ),
  );
  let haxeCount = 0;
  let typeScriptCount = 0;
  const ignored = new Set([".next", ".nextjshx", "node_modules", "src-gen"]);
  for (const sourceRoot of roots) {
    for (const file of await walk(sourceRoot, { ignore: ignored })) {
      if (
        generatedAdapters.has(file) ||
        file.endsWith("/public/styles.css") ||
        file.endsWith("/next-env.d.ts") ||
        file.endsWith(".tsbuildinfo")
      ) {
        continue;
      }
      const source = await fs.readFile(file, "utf8");
      assertNoLocalPath(file, source);
      if (file.endsWith(".hx")) {
        haxeCount += 1;
        assertHaxeSource(file, source);
      } else if (file.endsWith(".ts") || file.endsWith(".tsx")) {
        typeScriptCount += 1;
        assertTypeScriptSource(file, source);
      }
    }
  }

  run(process.execPath, [TSC_BIN, "--project", "examples/showcase-ui/tsconfig.json", "--pretty", "false"]);
  console.log(
    `[showcases] source: OK: ${haxeCount} Haxe modules, ${typeScriptCount} native TS modules, exact pins, and no broad or local-path escapes`,
  );
}

function validateOwnedPath(showcase, relative) {
  assert.equal(path.posix.normalize(relative), relative, `${showcase.name} manifest path is not normalized`);
  assert(!path.isAbsolute(relative), `${showcase.name} manifest contains an absolute output`);
  if (showcase.rootAdapters?.includes(relative) === true) {
    return path.join(showcase.directory, relative);
  }
  assert(relative.startsWith("app/"), `${showcase.name} manifest escaped its App Router root`);
  const absolute = path.resolve(showcase.directory, relative);
  const appRoot = path.join(showcase.directory, "app");
  assert(
    absolute.startsWith(`${appRoot}${path.sep}`),
    `${showcase.name} manifest output escaped the App Router root`,
  );
  return absolute;
}

async function readOwnedOutputs(showcase, options = {}) {
  const manifestPath = path.join(showcase.directory, ".nextjshx/manifest.json");
  if (!(await pathExists(manifestPath))) {
    return [];
  }
  const manifest = await readJson(manifestPath);
  assert.equal(manifest.protocol, "nextjshx.generated-output");
  assert.equal(manifest.version, 2);
  assert.equal(manifest.nextVersion, "16.2.12");
  if (options.allowStaleCompilerIdentity !== true) {
    assert.equal(
      manifest.genesVersion,
      `1.50.0+${GENES_COMMIT}`,
      `${showcase.name} manifest genes identity drifted`,
    );
  }
  const paths = manifest.outputs.map((output) => output.path);
  assert.deepEqual(paths, showcase.adapters, `${showcase.name} owned adapter list drifted`);
  for (const output of manifest.outputs) {
    const absolute = validateOwnedPath(showcase, output.path);
    const bytes = await fs.readFile(absolute);
    assert.equal(
      createHash("sha256").update(bytes).digest("hex"),
      output.sha256,
      `${showcase.name} manifest digest drifted for ${output.path}`,
    );
  }
  return paths;
}

async function removeEmptyParents(showcase, adapter) {
  const appRoot = path.join(showcase.directory, "app");
  let current = path.dirname(adapter);
  while (current !== appRoot && current.startsWith(`${appRoot}${path.sep}`)) {
    try {
      await fs.rmdir(current);
    } catch (error) {
      if (error.code === "ENOENT") {
        current = path.dirname(current);
        continue;
      }
      if (error.code === "ENOTEMPTY") {
        return;
      }
      throw error;
    }
    current = path.dirname(current);
  }
}

async function cleanShowcase(showcase) {
  // A compiler-pin update must still be able to remove outputs that are
  // cryptographically owned by the preceding manifest. Fresh generation and
  // every later read enforce the current compiler identity again.
  const owned = await readOwnedOutputs(showcase, { allowStaleCompilerIdentity: true });
  for (const relative of owned) {
    const adapter = validateOwnedPath(showcase, relative);
    await fs.rm(adapter, { force: true });
    await removeEmptyParents(showcase, adapter);
  }
  await Promise.all([
    fs.rm(path.join(showcase.directory, "src-gen"), { recursive: true, force: true }),
    fs.rm(path.join(showcase.directory, ".next"), { recursive: true, force: true }),
    fs.rm(path.join(showcase.directory, ".nextjshx"), { recursive: true, force: true }),
    fs.rm(path.join(showcase.directory, "next-env.d.ts"), { force: true }),
    fs.rm(path.join(showcase.directory, "tsconfig.tsbuildinfo"), { force: true }),
    fs.rm(path.join(showcase.directory, "public/styles.css"), { force: true }),
  ]);
}

async function collectDigest(showcase) {
  const entries = [];
  const generated = path.join(showcase.directory, "src-gen");
  for (const file of await walk(generated)) {
    const bytes = await fs.readFile(file);
    entries.push([
      path.posix.join("src-gen", path.relative(generated, file).split(path.sep).join("/")),
      createHash("sha256").update(bytes).digest("hex"),
    ]);
  }
  for (const relative of await readOwnedOutputs(showcase)) {
    const bytes = await fs.readFile(validateOwnedPath(showcase, relative));
    entries.push([relative, createHash("sha256").update(bytes).digest("hex")]);
  }
  const manifest = ".nextjshx/manifest.json";
  const manifestBytes = await fs.readFile(path.join(showcase.directory, manifest));
  entries.push([manifest, createHash("sha256").update(manifestBytes).digest("hex")]);
  return entries.sort(([left], [right]) => left.localeCompare(right));
}

async function verifyGeneratedSource(showcase) {
  const roots = [
    path.join(showcase.directory, "src-gen", showcase.namespace),
    path.join(showcase.directory, "src-gen/showcase"),
  ];
  for (const root of roots) {
    for (const file of await walk(root)) {
      if (file.endsWith(".ts") || file.endsWith(".tsx")) {
        // genes-ts adds `!` only when Haxe's non-null Array<T> model is read in
        // its own length-bounded Array.map loop. Validate that exact proof
        // shape here; public Next adapters remain assertion-free below.
        assertTypeScriptSource(file, await fs.readFile(file, "utf8"), {
          allowGenesBoundedArrayReads: true,
        });
      }
    }
  }
  for (const relative of showcase.adapters) {
    const file = validateOwnedPath(showcase, relative);
    assertTypeScriptSource(file, await fs.readFile(file, "utf8"));
  }

  if (showcase.name === "commerce") {
    const implementation = await fs.readFile(
      path.join(showcase.directory, "src-gen/commerce/client/CartHook.tsx"),
      "utf8",
    );
    assert(
      implementation.includes(
        'const filter = useState<"all" | "systems" | "tools">("all");',
      ),
      "commerce enum state lost its closed Haxe union",
    );
    assert(
      !/TypeArguments|ReactStateSeed|State_Impl_/.test(implementation),
      "commerce state output leaked a compile-time carrier or Haxe wrapper",
    );
    assert(
      implementation.includes(
        "const currentQuantities: CartQuantity[] = quantities[0];",
      ),
      "commerce memo lost its single-evaluation scalar state snapshot",
    );
    assert(
      implementation.includes(
        [
          "const lines: CartLine[] = useMemo(function () {",
          "\t\treturn CartHook.buildLines(products, currentQuantities);",
          "\t}, [products, currentQuantities]);",
        ].join("\n"),
      ),
      "commerce memo must expose the same named scalars to its calculation and dependency list",
    );
    assert(
      !/\[[^\]]*quantities\[0\][^\]]*\]/.test(implementation),
      "commerce memo regressed to a computed dependency that official React lint cannot analyze",
    );

    const hookAdapter = await fs.readFile(
      path.join(showcase.directory, "app/_nextjshx/hook/c6198b90b72b/useShopCart.ts"),
      "utf8",
    );
    assert.match(
      hookAdapter,
      /^\/\/ Generated by NextJsHx from commerce\.client\.CartHook\.useShopCart\. Implementation graph: sha256:[0-9a-f]{64}\.$/m,
      "commerce Hook adapter lost its exact implementation-graph fingerprint",
    );
    const normalizedHookAdapter = hookAdapter.replace(
      /Implementation graph: sha256:[0-9a-f]{64}\./,
      "Implementation graph: sha256:<digest>.",
    );
    assert.equal(
      normalizedHookAdapter,
      [
        '"use client";',
        "// Generated by NextJsHx from commerce.client.CartHook.useShopCart. Implementation graph: sha256:<digest>.",
        'import { CartHook } from "../../../../src-gen/commerce/client/CartHook";',
        "export const useShopCart: typeof CartHook.useShopCart = CartHook.useShopCart;",
        "",
      ].join("\n"),
      "commerce Hook adapter must remain a canonical directive-first typed const alias",
    );
  }

  if (showcase.name === "field-atlas") {
    const registry = await fs.readFile(
      path.join(showcase.directory, "mdx-components.tsx"),
      "utf8",
    );
    const normalizedRegistry = registry.replace(
      /Implementation graph: sha256:[0-9a-f]{64}\./,
      "Implementation graph: sha256:<digest>.",
    );
    assert.equal(
      normalizedRegistry,
      [
        "// Generated by NextJsHx from field_atlas.content.AtlasMdxComponents.components. Implementation graph: sha256:<digest>.",
        'import { AtlasMdxComponents as NextJsHxMdxRegistry } from "./src-gen/field_atlas/content/AtlasMdxComponents";',
        "export const useMDXComponents: typeof NextJsHxMdxRegistry.components = NextJsHxMdxRegistry.components;",
        "",
      ].join("\n"),
      "Field Atlas MDX registry must remain a zero-wrapper exact typed alias",
    );
    const signalPlot = await fs.readFile(
      path.join(showcase.directory, "src-gen/field_atlas/client/SignalPlot.tsx"),
      "utf8",
    );
    assert(
      signalPlot.includes(
        '<BarChart data={model.rows} responsive accessibilityLayer layout="vertical" className="signal-chart-graph"',
      ),
      "Field Atlas lost the direct responsive Recharts component",
    );
    assert(
      signalPlot.includes('<tr key={row.category}>'),
      "Field Atlas chart table rows lost stable React identities",
    );
    assert(
      !/MDXProvider|Record<string|as MDXComponents|next\/dist\//.test(registry),
      "Field Atlas MDX adapter widened or imported a private framework path",
    );
  }
}

async function verifyDeterminism(showcase) {
  await cleanShowcase(showcase);
  run(process.execPath, [CLI_BIN, "generate", "--no-check"], { cwd: showcase.directory });
  await verifyGeneratedSource(showcase);
  const first = await collectDigest(showcase);
  await cleanShowcase(showcase);
  run(process.execPath, [CLI_BIN, "generate", "--no-check"], { cwd: showcase.directory });
  await verifyGeneratedSource(showcase);
  const second = await collectDigest(showcase);
  assert.deepEqual(second, first, `${showcase.name} Haxe/adapters are not byte-deterministic`);
  console.log(`[showcases] ${showcase.name}: deterministic across ${first.length} generated files`);
}

async function verifyBuild(showcase) {
  run("npm", ["run", "build", "--workspace", showcase.workspace]);
  await fs.access(path.join(showcase.directory, ".next/BUILD_ID"));
  const prerender = await readJson(path.join(showcase.directory, ".next/prerender-manifest.json"));
  const routes = new Set(Object.keys(prerender.routes));
  for (const route of showcase.prerendered) {
    assert(routes.has(route), `${showcase.name} did not prerender ${route}`);
  }
  await verifyGeneratedSource(showcase);
  console.log(
    `[showcases] ${showcase.name}: strict TypeScript and Next production build prerendered ${showcase.prerendered.length} routes`,
  );
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

async function waitForPage(port) {
  const deadline = Date.now() + 30_000;
  let lastError = new Error("production server did not answer");
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/`, {
        headers: { accept: "text/html" },
        signal: AbortSignal.timeout(2_000),
      });
      if (response.ok) {
        return;
      }
      lastError = new Error(`production server returned HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw lastError;
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

async function browserExecutable() {
  const configured = process.env.NEXTJSHX_CHROME;
  if (configured !== undefined && !path.isAbsolute(configured)) {
    throw new ShowcaseFailure("NEXTJSHX_CHROME must be an absolute executable path");
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
  throw new ShowcaseFailure("no Chrome/Chromium executable found; configure NEXTJSHX_CHROME");
}

function observePage(page) {
  const pageErrors = [];
  const consoleErrors = [];
  const failedRequests = [];
  const badResponses = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });
  page.on("requestfailed", (request) => {
    failedRequests.push(`${request.method()} ${request.url()}: ${request.failure()?.errorText ?? "failed"}`);
  });
  page.on("response", (response) => {
    if (response.status() >= 400) {
      badResponses.push({ status: response.status(), pathname: new URL(response.url()).pathname });
    }
  });
  return { pageErrors, consoleErrors, failedRequests, badResponses };
}

async function assertNoOverflow(page, label) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  assert(overflow <= 1, `${label} has ${overflow}px horizontal overflow`);
}

async function assertReducedMotion(page, label) {
  const preference = await page.evaluate(() => ({
    matches: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    scrollBehavior: getComputedStyle(document.documentElement).scrollBehavior,
  }));
  assert.equal(preference.matches, true, `${label} did not receive reduced-motion media`);
  assert.equal(
    preference.scrollBehavior,
    "auto",
    `${label} did not disable smooth document scrolling for reduced motion`,
  );
}

function assertBrowserHealth(observed, label, allowedNotFound = null) {
  assert.deepEqual(observed.pageErrors, [], `${label} page errors: ${observed.pageErrors.join(" | ")}`);
  assert.deepEqual(
    observed.failedRequests,
    [],
    `${label} failed requests: ${observed.failedRequests.join(" | ")}`,
  );
  const consoleErrors = observed.consoleErrors.filter(
    (message) =>
      allowedNotFound === null || !/Failed to load resource:.*404 \(Not Found\)/.test(message),
  );
  assert.deepEqual(consoleErrors, [], `${label} console errors: ${consoleErrors.join(" | ")}`);
  const unexpectedResponses = observed.badResponses.filter(
    (response) => response.pathname !== "/favicon.ico" && response.pathname !== allowedNotFound,
  );
  assert.deepEqual(
    unexpectedResponses,
    [],
    `${label} HTTP failures: ${unexpectedResponses.map((item) => `${item.status} ${item.pathname}`).join(" | ")}`,
  );
}

async function open(page, port, route) {
  return page.goto(`http://127.0.0.1:${port}${route}`, {
    waitUntil: "networkidle",
    timeout: 20_000,
  });
}

async function smokeLanding(page, port, viewport) {
  const observed = observePage(page);
  const response = await open(page, port, "/");
  assert.equal(response?.status(), 200);
  await assertReducedMotion(page, `landing ${viewport.name}`);
  await page.locator("#live-tide-dial").waitFor({ state: "visible" });
  assert.equal(await page.locator("#tide-level").textContent(), "62");
  await page.getByRole("button", { name: "Raise simulated tide reading" }).click();
  await page.locator("#tide-level").filter({ hasText: "66" }).waitFor();
  await page.getByRole("button", { name: "Lower simulated tide reading" }).click();
  await page.locator("#tide-level").filter({ hasText: "62" }).waitFor();
  assert.equal(await page.locator("h1").textContent(), "Read the coastbefore it changes.");
  await assertNoOverflow(page, `landing ${viewport.name}`);
  assertBrowserHealth(observed, `landing ${viewport.name}`);
}

async function smokeBlog(page, port, viewport) {
  const observed = observePage(page);
  const response = await open(page, port, "/");
  assert.equal(response?.status(), 200);
  await assertReducedMotion(page, `blog ${viewport.name}`);
  assert.equal(await page.locator(".dispatch-card").count(), 2);
  await page.getByRole("link", { name: /Read the field note/ }).click();
  await page.locator(".article-shell article").waitFor({ state: "visible" });
  assert.equal(new URL(page.url()).pathname, "/journal/after-the-burn");
  assert.equal(await page.locator("article h1").textContent(), "What returns after the burn");
  assert((await page.title()).includes("What returns after the burn"));
  await assertNoOverflow(page, `blog article ${viewport.name}`);

  const missingPath = "/journal/not-in-this-journal";
  const missing = await open(page, port, missingPath);
  assert.equal(missing?.status(), 404);
  await page.locator(".missing-dispatch").waitFor({ state: "visible" });
  assert.equal(await page.locator(".missing-dispatch h1").textContent(), "The cairn ends here.");
  await assertNoOverflow(page, `blog not-found ${viewport.name}`);
  assertBrowserHealth(observed, `blog ${viewport.name}`, missingPath);
}

async function waitForProductCount(page, count) {
  await page.waitForFunction(
    (expected) => document.querySelectorAll(".product-card").length === expected,
    count,
  );
}

async function waitForFocusInside(page, selector, label) {
  await page.waitForFunction(
    (target) => {
      const container = document.querySelector(target);
      return container !== null && container.contains(document.activeElement);
    },
    selector,
  );
  assert(
    await page.locator(selector).evaluate((container) => container.contains(document.activeElement)),
    `${label} did not keep focus inside ${selector}`,
  );
}

async function waitForFocusOn(page, selector, label) {
  await page.waitForFunction(
    (target) => document.activeElement === document.querySelector(target),
    selector,
  );
  assert(
    await page.locator(selector).evaluate((element) => element === document.activeElement),
    `${label} did not restore focus to ${selector}`,
  );
}

async function smokeCommerce(page, port, viewport) {
  const observed = observePage(page);
  const response = await open(page, port, "/");
  assert.equal(response?.status(), 200);
  await assertReducedMotion(page, `commerce ${viewport.name}`);
  await waitForProductCount(page, 3);
  const images = page.locator(".product-visual img");
  assert.equal(await images.count(), 3);
  for (let index = 0; index < 3; index += 1) {
    const image = images.nth(index);
    await image.scrollIntoViewIfNeeded();
    await image.evaluate((element) => element.decode());
    assert(await image.evaluate((element) => element.complete && element.naturalWidth > 0));
  }

  await page.getByRole("button", { name: "Tools", exact: true }).click();
  await waitForProductCount(page, 1);
  await page.getByRole("button", { name: "All", exact: true }).click();
  await waitForProductCount(page, 3);
  await page.getByRole("button", { name: /Add to bag/ }).first().click();
  await page.locator("#cart-count").filter({ hasText: "1" }).waitFor();
  const sheetTriggerSelector = "[data-slot=sheet-trigger]";
  const sheetContentSelector = "[data-slot=sheet-content]";
  const sheetTrigger = page.locator(sheetTriggerSelector);
  assert.equal(await sheetTrigger.count(), 1);
  await page.getByRole("button", { name: /Bag 1/ }).click();
  await page.locator(sheetContentSelector).waitFor({ state: "visible" });
  await waitForFocusInside(page, sheetContentSelector, `commerce Sheet open ${viewport.name}`);
  await page.keyboard.press("Shift+Tab");
  await waitForFocusInside(page, sheetContentSelector, `commerce Sheet reverse tab ${viewport.name}`);
  await page.keyboard.press("Tab");
  await waitForFocusInside(page, sheetContentSelector, `commerce Sheet forward tab ${viewport.name}`);
  await page.keyboard.press("Escape");
  await page.locator(sheetContentSelector).waitFor({ state: "hidden" });
  await waitForFocusOn(page, sheetTriggerSelector, `commerce Sheet Escape ${viewport.name}`);

  await sheetTrigger.click();
  await page.locator(sheetContentSelector).waitFor({ state: "visible" });
  await waitForFocusInside(page, sheetContentSelector, `commerce Sheet reopen ${viewport.name}`);
  await page.getByRole("button", { name: "Add one Frame 01" }).click();
  await page.locator("#cart-count").filter({ hasText: "2" }).waitFor();
  assert.equal(await page.locator("#cart-total").textContent(), "$378.00");
  await page.getByRole("button", { name: "Keep shopping" }).click();
  await page.locator(sheetContentSelector).waitFor({ state: "hidden" });
  await waitForFocusOn(page, sheetTriggerSelector, `commerce Sheet close control ${viewport.name}`);
  await page.locator(".product-card h2").first().click();
  await page.locator(".product-detail").waitFor({ state: "visible" });
  assert.equal(new URL(page.url()).pathname, "/products/frame-window-farm");
  assert.equal(await page.locator(".product-detail h1").textContent(), "Frame 01");
  assert((await page.title()).includes("Frame 01"));
  await assertNoOverflow(page, `commerce detail ${viewport.name}`);

  const missingPath = "/products/not-in-this-season";
  const missing = await open(page, port, missingPath);
  assert.equal(missing?.status(), 404);
  await page.locator(".missing-product").waitFor({ state: "visible" });
  assert.equal(await page.locator(".missing-product h1").textContent(), "This bed is empty.");
  await assertNoOverflow(page, `commerce not-found ${viewport.name}`);
  assertBrowserHealth(observed, `commerce ${viewport.name}`, missingPath);
}

async function smokeFieldAtlas(page, port, viewport) {
  const observed = observePage(page);
  const response = await open(page, port, "/");
  assert.equal(response?.status(), 200);
  await assertReducedMotion(page, `field atlas home ${viewport.name}`);
  assert.equal(await page.locator("h1").textContent(), "Read the ground.Keep the signal.");
  const primary = page.locator(".hero-actions a").first();
  assert.equal((await primary.evaluate((element) => getComputedStyle(element).color)), "rgb(243, 239, 228)");
  await assertNoOverflow(page, `field atlas home ${viewport.name}`);

  const briefing = await open(page, port, "/briefing");
  assert.equal(briefing?.status(), 200);
  assert.equal(await page.locator(".portable-content > *").count(), 8);
  assert.equal(await page.locator(".content-data-series li").count(), 3);
  assert.equal(await page.evaluate(() => Object.hasOwn(window, "compromised")), false);
  await assertNoOverflow(page, `field atlas briefing ${viewport.name}`);

  const dispatch = await open(page, port, "/dispatches/soil-signals");
  assert.equal(dispatch?.status(), 200);
  assert.equal(await page.locator("h1").textContent(), "The soil keeps a second weather.");
  assert.equal(await page.locator("h2[id]").count(), 2);
  assert.equal(await page.locator("[data-rehype-pretty-code-figure]").count(), 1);
  assert.equal(await page.locator(".dispatch-kicker ~ table tbody tr").count(), 3);
  await page.locator(".signal-chart svg").waitFor({ state: "visible" });
  assert.equal(await page.locator(".signal-plot tbody tr").count(), 3);
  assert.equal(
    await page.locator(".signal-chart svg desc").textContent(),
    "Moisture signal by observation plot",
  );
  await assertNoOverflow(page, `field atlas dispatch ${viewport.name}`);
  assertBrowserHealth(observed, `field atlas ${viewport.name}`);
}

async function browserSmoke(showcase) {
  const port = await reservePort();
  const child = spawn(
    process.execPath,
    [NEXT_BIN, "start", ".", "-H", "127.0.0.1", "-p", String(port)],
    {
      cwd: showcase.directory,
      env: COMMAND_ENV,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
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
  let browser = null;
  try {
    await waitForPage(port);
    browser = await chromium.launch({
      executablePath: await browserExecutable(),
      headless: true,
      args: ["--disable-dev-shm-usage", "--no-sandbox"],
    });
    for (const viewport of VIEWPORTS) {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        reducedMotion: "reduce",
      });
      try {
        const page = await context.newPage();
        if (showcase.name === "landing") {
          await smokeLanding(page, port, viewport);
        } else if (showcase.name === "blog") {
          await smokeBlog(page, port, viewport);
        } else if (showcase.name === "commerce") {
          await smokeCommerce(page, port, viewport);
        } else {
          await smokeFieldAtlas(page, port, viewport);
        }
      } finally {
        await context.close();
      }
    }
    console.log(`[showcases] ${showcase.name}: desktop and mobile production-browser smoke passed`);
  } catch (error) {
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new ShowcaseFailure(`${showcase.name} server exited unexpectedly:\n${output}`);
    }
    throw error;
  } finally {
    if (browser !== null) {
      await browser.close();
    }
    await stopServer(child, exitPromise);
  }
}

async function verifyAll(showcases = SHOWCASES) {
  await verifySourceContracts();
  run(process.execPath, ["scripts/testing/showcase-ui.mjs"]);
  run(process.execPath, ["tools/cli/scripts/ensure-build.mjs", "runtime"]);
  for (const showcase of showcases) {
    try {
      await verifyDeterminism(showcase);
      await verifyBuild(showcase);
      await browserSmoke(showcase);
    } finally {
      await cleanShowcase(showcase);
    }
  }
  console.log(
    "[showcases] OK: shared UI, deterministic Haxe/adapter output, strict builds, static routes, and desktop/mobile behavior",
  );
}

try {
  const mode = process.argv[2] ?? "verify";
  if (mode === "source") {
    await verifySourceContracts();
  } else if (mode === "verify") {
    const requested = process.argv[3];
    const selected =
      requested === undefined
        ? SHOWCASES
        : SHOWCASES.filter((showcase) => showcase.name === requested);
    if (selected.length === 0) {
      throw new ShowcaseFailure(
        `unknown showcase ${requested}; expected ${SHOWCASES.map((item) => item.name).join(", ")}`,
      );
    }
    await verifyAll(selected);
  } else if (mode === "clean") {
    for (const showcase of SHOWCASES) {
      await cleanShowcase(showcase);
    }
    console.log("[showcases] clean: OK");
  } else {
    throw new ShowcaseFailure(`unknown mode ${mode}; expected source, verify, or clean`);
  }
} catch (error) {
  console.error(`[showcases] ERROR: ${error.message}`);
  process.exitCode = 1;
}
