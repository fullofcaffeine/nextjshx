#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import Ajv2020 from "ajv/dist/2020.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const FIXTURE_ROOT = path.join(ROOT, "tests/page-layouts");
const OUTPUT_ROOT = path.join(FIXTURE_ROOT, ".tmp");
const PLAN_PATH = path.join(OUTPUT_ROOT, "plan.json");
const REJECTED_PATH = path.join(OUTPUT_ROOT, "rejected.json");
const APPLICATION_PATH = path.join(OUTPUT_ROOT, "application.js");
const SNAPSHOT_PATH = path.join(ROOT, "tests/snapshots/page-layout-plan-v2.json");
const SCHEMA_PATH = path.join(ROOT, "schemas/adapter-plan.schema.json");
const TYPESCRIPT_ROOT = path.join(OUTPUT_ROOT, "typescript");
const TSC_BIN = path.join(ROOT, "node_modules/typescript/bin/tsc6");
const ANSI_ESCAPE = /\x1b\[[0-?]*[ -/]*[@-~]/g;
const CHARACTER_DIAGNOSTIC =
  /^(.*):(\d+): characters (\d+)-(\d+) : \[([A-Z0-9-]+)\] (.+)$/;
const LINE_DIAGNOSTIC = /^(.*):(\d+): lines (\d+)-(\d+) : \[([A-Z0-9-]+)\] (.+)$/;
const MODE = process.argv[2] ?? "verify";

const NEGATIVE_CASES = [
  {
    id: "css-page",
    file: "tests/page-layouts/src/page_layouts/negative/CssOnPage.hx",
    line: 10,
    range: { kind: "characters", start: 1, end: 11 },
    code: "NXHX-PAGE-LAYOUT-CSS-0012",
    message:
      "@:next.css is layout-only so global styles have one predictable Next.js owner; attach the import to the nearest @:next.layout.",
  },
  {
    id: "css-nonliteral",
    file: "tests/page-layouts/src/page_layouts/negative/NonliteralCss.hx",
    line: 9,
    range: { kind: "characters", start: 12, end: 30 },
    code: "NXHX-PAGE-LAYOUT-CSS-0013",
    message:
      "@:next.css requires a compile-time string literal; expressions are not evaluated.",
  },
  {
    id: "css-missing",
    file: "tests/page-layouts/src/page_layouts/negative/MissingCss.hx",
    line: 9,
    range: { kind: "characters", start: 12, end: 27 },
    code: "NXHX-PAGE-LAYOUT-CSS-0014",
    message:
      'CSS request "./missing.css" must name an existing file beside the generated layout adapter.',
  },
  {
    id: "css-escape",
    file: "tests/page-layouts/src/page_layouts/negative/EscapingCss.hx",
    line: 9,
    range: { kind: "characters", start: 12, end: 28 },
    code: "NXHX-PAGE-LAYOUT-CSS-0013",
    message:
      'CSS request "../globals.css" must not escape the generated layout directory; use a co-located ./ file or a package CSS specifier.',
  },
  {
    id: "css-duplicate",
    file: "tests/page-layouts/src/page_layouts/negative/DuplicateCss.hx",
    line: 10,
    range: { kind: "characters", start: 1, end: 11 },
    code: "NXHX-PAGE-LAYOUT-CSS-0015",
    message:
      'CSS request "design-system/theme.css" is duplicated; keep one import at its intended cascade position.',
  },
  {
    id: "missing-render",
    file: "tests/page-layouts/src/page_layouts/negative/MissingRender.hx",
    line: 4,
    range: { kind: "characters", start: 1, end: 23 },
    code: "NXHX-PAGE-LAYOUT-RENDER-0004",
    message:
      "Page declaration page_layouts.negative.MissingRender must expose exactly one public static render function; found 0.",
  },
  {
    id: "page-props",
    file: "tests/page-layouts/src/page_layouts/negative/StructuralPageProps.hx",
    line: 15,
    range: { kind: "lines", start: 15, end: 17 },
    code: "NXHX-PAGE-LAYOUT-PROPS-0005",
    message:
      "Page render props must be nextjs.app.PageProps<Params, SearchParams> so params and searchParams remain Promise-shaped; found page_layouts.negative.PageLookalike.",
  },
  {
    id: "layout-props",
    file: "tests/page-layouts/src/page_layouts/negative/StructuralLayoutProps.hx",
    line: 15,
    range: { kind: "lines", start: 15, end: 17 },
    code: "NXHX-PAGE-LAYOUT-PROPS-0005",
    message:
      "Layout render props must be nextjs.app.LayoutProps<Params> so children are ReactNode and params remain Promise-shaped; found page_layouts.negative.LayoutLookalike.",
  },
  {
    id: "query",
    file: "tests/page-layouts/src/page_layouts/negative/WrongQuery.hx",
    line: 13,
    range: { kind: "lines", start: 13, end: 15 },
    code: "NXHX-PAGE-LAYOUT-QUERY-0006",
    message:
      "Page render query type must remain nextjs.route.SearchParams because @:next.query types outbound href construction but does not decode URL input; found page_layouts.negative.TrustedQuery.",
  },
  {
    id: "params",
    file: "tests/page-layouts/src/page_layouts/negative/WrongParams.hx",
    line: 10,
    range: { kind: "lines", start: 10, end: 12 },
    code: "NXHX-ROUTE-PARAM-MISSING-0001",
    message:
      'Params for route "negative/[id]" are missing required field "id" for segment 2.',
  },
  {
    id: "return",
    file: "tests/page-layouts/src/page_layouts/negative/WrongReturn.hx",
    line: 8,
    range: { kind: "lines", start: 8, end: 10 },
    code: "NXHX-PAGE-LAYOUT-RETURN-0007",
    message:
      "Layout render must return genes.react.Element or Promise<genes.react.Element>; found String.",
  },
  {
    id: "public-field",
    file: "tests/page-layouts/src/page_layouts/negative/UnreviewedField.hx",
    line: 10,
    range: { kind: "characters", start: 2, end: 55 },
    code: "NXHX-PAGE-LAYOUT-FIELD-0003",
    message:
      "Public Page field page_layouts.negative.UnreviewedField.unreviewed has no reviewed App Router export mapping; supported named fields are metadata, generateMetadata, generateStaticParams, segment; make helpers private.",
  },
  {
    id: "missing-slot-marker",
    file: "tests/page-layouts/src/page_layouts/negative/MissingSlotMarker.hx",
    line: 15,
    range: { kind: "lines", start: 15, end: 17 },
    code: "NXHX-PAGE-LAYOUT-SLOTS-0010",
    message:
      "Layout props page_layouts.negative.UnreviewedSlottedProps declares named slot fields but is not reviewed. Add parameterless @:next.layoutSlots to the named typedef, extend nextjs.app.LayoutProps<Params>, and keep every slot a required final ReactNode.",
  },
  {
    id: "wrong-slot-type",
    file: "tests/page-layouts/src/page_layouts/negative/WrongSlotType.hx",
    line: 10,
    range: { kind: "characters", start: 2, end: 21 },
    code: "NXHX-PAGE-LAYOUT-SLOTS-0010",
    message:
      'Parallel slot "modal" must be nextjs.raw.react.ReactNode; found String.',
  },
  {
    id: "optional-slot",
    file: "tests/page-layouts/src/page_layouts/negative/OptionalSlot.hx",
    line: 11,
    range: { kind: "characters", start: 2, end: 25 },
    code: "NXHX-PAGE-LAYOUT-SLOTS-0010",
    message:
      'Layout props field "modal" must be required and immutable because Next supplies one closed render snapshot.',
  },
  {
    id: "mutable-slot",
    file: "tests/page-layouts/src/page_layouts/negative/MutableSlot.hx",
    line: 11,
    range: { kind: "characters", start: 2, end: 22 },
    code: "NXHX-PAGE-LAYOUT-SLOTS-0010",
    message:
      'Layout props field "modal" must be required and immutable because Next supplies one closed render snapshot.',
  },
  {
    id: "module-user-value-marker",
    file: "tests/page-layouts/src/page_layouts/negative/ModuleUserValueMarker.hx",
    line: 19,
    range: { kind: "lines", start: 19, end: 21 },
    code: "NXHX-PAGE-LAYOUT-MODULE-0011",
    message:
      "metadata must not declare @:genes.moduleValue directly; NextJsHx derives the exact native binding from the reviewed App Router export.",
  },
];

function portable(value) {
  return value.split(path.sep).join("/");
}

function repositoryRelative(file) {
  const absolute = path.isAbsolute(file) ? path.normalize(file) : path.resolve(ROOT, file);
  const relative = path.relative(ROOT, absolute);
  assert(
    relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative),
    `diagnostic path escapes the repository: ${file}`,
  );
  return portable(relative);
}

function runHaxe(build, expectedStatus, extraArgs = []) {
  const result = spawnSync("haxe", [build, ...extraArgs], {
    cwd: ROOT,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1" },
  });
  if (result.error !== undefined) {
    throw result.error;
  }
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  assert.equal(result.status, expectedStatus, `${build} exited ${result.status}:\n${output}`);
  return output;
}

function run(command, args, expectedStatus = 0) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    encoding: "utf8",
    env: { ...process.env, CI: "1", NO_COLOR: "1" },
  });
  if (result.error !== undefined) {
    throw result.error;
  }
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  assert.equal(
    result.status,
    expectedStatus,
    `${path.basename(command)} exited ${result.status}; expected ${expectedStatus}:\n${output}`,
  );
  return output;
}

function parseDiagnostic(output, fixtureId) {
  const normalized = output.replace(ANSI_ESCAPE, "").replaceAll("\\", "/");
  const customLines = normalized
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.includes("[NXHX-"));
  assert.equal(
    customLines.length,
    1,
    `${fixtureId} must emit exactly one NextJsHx diagnostic:\n${normalized}`,
  );
  const characters = CHARACTER_DIAGNOSTIC.exec(customLines[0]);
  if (characters !== null) {
    return {
      file: repositoryRelative(characters[1]),
      line: Number(characters[2]),
      range: {
        kind: "characters",
        start: Number(characters[3]),
        end: Number(characters[4]),
      },
      code: characters[5],
      message: characters[6],
    };
  }
  const lines = LINE_DIAGNOSTIC.exec(customLines[0]);
  assert(lines !== null, `${fixtureId} emitted an unparseable diagnostic:\n${customLines[0]}`);
  return {
    file: repositoryRelative(lines[1]),
    line: Number(lines[2]),
    range: { kind: "lines", start: Number(lines[3]), end: Number(lines[4]) },
    code: lines[5],
    message: lines[6],
  };
}

function validatePlan() {
  const encoded = fs.readFileSync(PLAN_PATH, "utf8");
  const plan = JSON.parse(encoded);
  const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, "utf8"));
  const validate = new Ajv2020({ allErrors: true, strict: true }).compile(schema);
  assert(validate(plan), `Page/layout plan violates schema v2:\n${JSON.stringify(validate.errors, null, 2)}`);
  if (MODE === "update") {
    fs.writeFileSync(SNAPSHOT_PATH, encoded, "utf8");
  } else {
    assert.equal(
      encoded,
      fs.readFileSync(SNAPSHOT_PATH, "utf8"),
      "Page/layout adapter-plan bytes drifted from the reviewed snapshot",
    );
  }
  assert.deepEqual(
    plan.intents.map((intent) => [intent.kind, intent.segmentPath, intent.targetPath]),
    [
      ["page", "(marketing)/offers/[id]", "(marketing)/offers/[id]/page.tsx"],
      ["page", "@analytics", "@analytics/page.tsx"],
      ["page", "feed/@modal/(..)photo/[id]", "feed/@modal/(..)photo/[id]/page.tsx"],
      ["layout", "", "layout.tsx"],
      ["page", "module-metadata", "module-metadata/page.tsx"],
      ["page", "module-products/[id]", "module-products/[id]/page.tsx"],
      ["layout", "module-shell", "module-shell/layout.tsx"],
      ["page", "", "page.tsx"],
      ["layout", "todos/[id]", "todos/[id]/layout.tsx"],
      ["page", "todos/[id]", "todos/[id]/page.tsx"],
    ],
  );
  assert(plan.intents.every((intent) => intent.source.fieldName === "render"));
  assert(plan.intents.every((intent) => intent.exports[0].kind === "default"));
  assert(plan.intents.every((intent) => intent.exports[0].sourceField === "render"));
  assert(
    plan.intents.every((intent) =>
      intent.imports.some(
        (imported) => imported.modulePath === "react" && imported.symbol === "JSX" && imported.typeOnly,
      ),
    ),
    "Page/layout plans must import React 19's module-owned JSX type namespace",
  );
  assert.equal(plan.intents[0].exports[0].signature, '(props: PageProps<"/offers/[id]">) => JSX.Element');
  assert.equal(plan.intents[1].exports[0].signature, '(props: PageProps<"/">) => JSX.Element');
  assert.equal(plan.intents[2].exports[0].signature, '(props: PageProps<"/photo/[id]">) => JSX.Element');
  assert.equal(plan.intents[3].exports[0].signature, '(props: LayoutProps<"/">) => JSX.Element');
  assert.equal(
    plan.intents[5].exports[0].signature,
    '(props: PageProps<"/module-products/[id]">) => Promise<JSX.Element>',
  );
  assert.equal(
    plan.intents[6].exports[0].signature,
    '(props: LayoutProps<"/module-shell">) => JSX.Element',
  );
  assert.deepEqual(
    plan.intents[6].sideEffectImports,
    ["./shell.css", "design-system/theme.css"],
    "module layout lost its ordered native CSS import request",
  );
  assert.equal(
    plan.intents[4].exports[0].signature,
    '(props: PageProps<"/module-metadata">) => JSX.Element',
  );
  assert.deepEqual(
    plan.intents[4].exports.map((exported) => [
      exported.kind,
      exported.name,
      exported.sourceField,
    ]),
    [
      ["default", "default", "render"],
      ["named", "metadata", "metadata"],
    ],
    "module page lost its direct typed metadata export",
  );
  assert.equal(plan.intents[7].exports[0].signature, '(props: PageProps<"/">) => JSX.Element');
  assert.equal(
    plan.intents[8].exports[0].signature,
    '(props: LayoutProps<"/todos/[id]">) => Promise<JSX.Element>',
  );
  assert.equal(
    plan.intents[9].exports[0].signature,
    '(props: PageProps<"/todos/[id]">) => Promise<JSX.Element>',
  );
  assert.deepEqual(
    plan.intents[5].exports.map((exported) => [exported.kind, exported.name, exported.sourceField]),
    [
      ["default", "default", "render"],
      ["named", "generateStaticParams", "generateStaticParams"],
    ],
    "module page lost its reviewed direct named exports",
  );
  assert(!/\b(?:any|unknown)\b/.test(encoded), "Page/layout plan contains a broad TypeScript type");
  assert(!encoded.includes("ROOT-PAGE-BUSINESS"), "Page business logic leaked into its adapter plan");
  assert(!encoded.includes("DYNAMIC-PAGE-BUSINESS"), "Dynamic page business logic leaked into its adapter plan");
  assert(!encoded.includes(portable(ROOT)), "Page/layout plan leaked the compiler host path");
  assert.equal(fs.existsSync(APPLICATION_PATH), false, "--no-output emitted application JavaScript");
}

function generated(relative) {
  const file = path.join(TYPESCRIPT_ROOT, relative);
  assert(fs.statSync(file).isFile(), `${relative} must be emitted by genes-ts`);
  return fs.readFileSync(file, "utf8");
}

function validateGeneratedTypescript() {
  const root = generated("page_layouts/positive/RootPage.tsx");
  const rootLayout = generated("page_layouts/positive/RootLayout.tsx");
  const dynamic = generated("page_layouts/positive/DynamicPage.tsx");
  const grouped = generated("page_layouts/positive/GroupedPage.tsx");
  const intercepted = generated("page_layouts/positive/InterceptedPage.tsx");
  const parallel = generated("page_layouts/positive/ParallelPage.tsx");
  const moduleProduct = generated("page_layouts/positive/ModuleProductPage.tsx");
  const moduleLayout = generated("page_layouts/positive/ModuleRootLayout.tsx");
  const moduleMetadata = generated("page_layouts/positive/ModuleStaticMetadata.tsx");
  const consumer = generated("page_layouts/NoRuntime.tsx");
  const pageProps = generated("nextjs/app/PageProps.tsx");
  const layoutProps = generated("nextjs/app/LayoutProps.tsx");
  const searchParamsModule = path.join(TYPESCRIPT_ROOT, "nextjs/route/SearchParams.tsx");

  assert(root.includes("static href(): import('next').Route<\"/\">"));
  assert(dynamic.includes("static href(params: TodoParams): import('next').Route<`/todos/${string}`>"));
  assert(grouped.includes("static href(params: TodoParams): import('next').Route<`/offers/${string}`>"));
  assert(intercepted.includes("static href(params: TodoParams): import('next').Route<`/photo/${string}`>"));
  assert(parallel.includes('static href(): import(\'next\').Route<"/">'));
  assert(moduleProduct.includes("export function render("));
  assert(moduleProduct.includes("export function generateStaticParams("));
  assert(moduleLayout.includes("export function render("));
  assert(moduleMetadata.includes("export function render("));
  assert(
    moduleMetadata.includes(
      "export const metadata: import('next').Metadata = {\"title\": \"Direct module metadata\"};",
    ),
    "module page lost its typed direct metadata value",
  );
  assert(!moduleProduct.includes("ModuleProductPage_Fields_"));
  assert(!moduleLayout.includes("ModuleRootLayout_Fields_"));
  assert(!moduleMetadata.includes("ModuleStaticMetadata_Fields_"));
  assert(!moduleProduct.includes("Register.setHxClass"));
  assert(!moduleLayout.includes("Register.setHxClass"));
  assert(!moduleMetadata.includes("Register.setHxClass"));
  assert(
    dynamic.includes(
      "static hrefWithQuery(params: TodoParams, query: TodoQuery): import('next').Route<`/todos/${string}` | `${Extract<`/todos/${string}`, string>}?${string}`>",
    ),
    "dynamic page lost its generated closed-query companion",
  );
  assert(dynamic.includes("return `/todos/${__nextRoute0Encoded0}`;"));
  assert(pageProps.includes("params: globalThis.Promise<Params>"));
  assert(pageProps.includes("searchParams: globalThis.Promise<Query>"));
  assert(layoutProps.includes("children: import('react').ReactNode"));
  assert(layoutProps.includes("params: globalThis.Promise<Params>"));
  assert(rootLayout.includes("export type RootLayoutProps = {"));
  assert(rootLayout.includes("analytics: import('react').ReactNode"));
  assert(rootLayout.includes("children: import('react').ReactNode"));
  assert(rootLayout.includes("params: globalThis.Promise<NoParams>"));
  assert(rootLayout.includes("props.children"));
  assert(rootLayout.includes("props.analytics"));
  assert(!rootLayout.includes("RootLayoutProps."), "slotted layout props emitted a runtime accessor helper");
  assert(
    dynamic.includes(
      "PageProps<TodoParams, Readonly<Record<string, string | string[] | undefined>>>",
    ),
  );
  assert.equal(
    fs.existsSync(searchParamsModule),
    false,
    "zero-runtime SearchParams projection emitted an unnecessary wrapper module",
  );
  assert(!consumer.includes("RootPage"), "static page href retained its server implementation");
  assert(!consumer.includes("DynamicPage"), "dynamic page href retained its server implementation");
  assert(consumer.includes("NoRuntime.retain(`/todos/${__nextRoute0Encoded0}`);"));
  assert(consumer.includes("/offers/"), "route-group href leaked its filesystem group or lost its public path");
  assert(consumer.includes("/photo/"), "intercepted href lost its canonical hard-navigation target");
  assert(consumer.includes("/module-products/"), "module page href lost its public route");
  assert(!consumer.includes("(marketing)"), "route-group href leaked filesystem-only syntax");
  assert(!consumer.includes("@modal"), "intercepted href leaked parallel-slot syntax");
  assert(!consumer.includes("(..)"), "intercepted href leaked its relative marker");
  assert(consumer.includes("new URLSearchParams()"), "query companion lost native URLSearchParams encoding");
  assert(
    consumer.includes('append("page", Std.string(__nextQuery0Value_page))') &&
      consumer.includes('append("tag", Std.string(__nextQuery0Item2))'),
    "generated query companion lost scalar or repeated fields",
  );
  assert(
    dynamic.includes("(((__nextQuery0Optional1)! as boolean))"),
    "optional query encoding lost Genes' erased, exact presence proof",
  );
  assert(!consumer.includes("TodoQuery"), "query schema created a consumer runtime dependency");
  for (const source of [
    root,
    rootLayout,
    dynamic,
    grouped,
    intercepted,
    parallel,
    moduleMetadata,
    pageProps,
    layoutProps,
  ]) {
    assert(!/\b(?:any|unknown)\b/.test(source), "generated page/layout public API contains a broad type");
    const withoutPresenceProof = source.replaceAll(
      "(((__nextQuery0Optional1)! as boolean))",
      "__nextQuery0Optional1",
    );
    assert(
      !/\sas\s/.test(withoutPresenceProof),
      "generated page/layout public API contains an assertion other than Genes' compiler-owned Undefinable presence proof",
    );
    assert(!source.includes(portable(ROOT)), "generated page/layout source leaked the compiler host path");
  }

  run(process.execPath, [
    TSC_BIN,
    "--project",
    "tests/page-layouts/tsconfig.json",
    "--pretty",
    "false",
    "--noEmit",
  ]);
}

try {
  assert(new Set(["verify", "update"]).has(MODE), `expected verify or update mode, found ${MODE}`);
  assert(
    MODE !== "update" || !/^(?:1|true)$/i.test(process.env.CI ?? ""),
    "page/layout snapshot updates are disabled in CI",
  );
  const version = runHaxe("--version", 0).trim();
  assert.equal(version, "4.3.7", `expected Haxe 4.3.7, found ${version}`);
  fs.rmSync(OUTPUT_ROOT, { recursive: true, force: true });
  fs.mkdirSync(OUTPUT_ROOT, { recursive: true });

  runHaxe("tests/page-layouts/build-positive.hxml", 0);
  validatePlan();
  runHaxe("tests/page-layouts/build-typescript.hxml", 0);
  validateGeneratedTypescript();

  for (const fixture of NEGATIVE_CASES) {
    fs.rmSync(REJECTED_PATH, { force: true });
    const output = runHaxe(
      "tests/page-layouts/build-negative.hxml",
      1,
      ["-D", `page_layout_case=${fixture.id}`],
    );
    assert.deepEqual(parseDiagnostic(output, fixture.id), {
      file: fixture.file,
      line: fixture.line,
      range: fixture.range,
      code: fixture.code,
      message: fixture.message,
    });
    assert.equal(fs.existsSync(REJECTED_PATH), false, `${fixture.id} emitted a rejected plan`);
  }

  fs.rmSync(REJECTED_PATH, { force: true });
  const mutation = runHaxe(
    "tests/page-layouts/build-negative.hxml",
    1,
    ["-D", "page_layout_case=query-mutation"],
  )
    .replace(ANSI_ESCAPE, "")
    .replaceAll("\\", "/")
    .trim();
  assert.equal(
    mutation,
    "tests/page-layouts/src/page_layouts/negative/MutableSearchParams.hx:7: characters 3-25 : " +
      "No @:arrayAccess function for nextjs.route.SearchParams accepts arguments of String and String",
  );
  assert.equal(fs.existsSync(REJECTED_PATH), false, "query mutation emitted a rejected plan");

  console.log(
    `page-layouts: OK: canonical/grouped/parallel/intercepted pages, typed parallel-slot layouts, strict href output, and ${NEGATIVE_CASES.length + 1} exact fail-closed diagnostics`,
  );
} catch (error) {
  console.error(`[page-layouts] ERROR: ${error.message}`);
  process.exitCode = 1;
}
