#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const FIXTURE = path.join(ROOT, "tests/route-hrefs");
const OUTPUT = path.join(FIXTURE, ".tmp");
const TYPESCRIPT_OUTPUT = path.join(OUTPUT, "typescript");
const CLASSIC_OUTPUT = path.join(OUTPUT, "classic");
const NEXT_APP = path.join(FIXTURE, "next-app");
const NEXT_OUTPUT = path.join(NEXT_APP, ".next");
const NEXT_BIN = path.join(ROOT, "node_modules/next/dist/bin/next");
const TSC_BIN = path.join(ROOT, "node_modules/typescript/bin/tsc6");
const HAXE_VERSION = "4.3.7";
const GENES_VERSION = "1.38.2";
const GENES_COMMIT = "f0ffa29e6d49fe81541977c6a3aae6b80000cec6";
const DIAGNOSTIC_SOURCE = "tests/route-hrefs/src/route_href_fixture/NegativeDeclarations.hx";
const ANSI_ESCAPE = /\x1b\[[0-?]*[ -/]*[@-~]/g;

const NEGATIVE_CASES = [
  {
    define: "href_missing",
    lines: [
      `${DIAGNOSTIC_SOURCE}:10: characters 18-33 : Object requires field id`,
      `${DIAGNOSTIC_SOURCE}:10: characters 18-33 : ... For function argument 'params'`,
    ],
  },
  {
    define: "href_extra",
    lines: [
      "{ id : route_href_fixture.routes.TodoId, extra : String } has extra field extra",
      "For function argument 'params'",
    ],
  },
  {
    define: "href_wrong_type",
    lines: [
      `${DIAGNOSTIC_SOURCE}:14: characters 23-25 : Int should be route_href_fixture.routes.TodoId`,
      `${DIAGNOSTIC_SOURCE}:14: characters 23-25 : ... For function argument 'params'`,
    ],
  },
  {
    define: "href_dynamic_without_params",
    lines: [
      `${DIAGNOSTIC_SOURCE}:16: characters 3-19 : Not enough arguments, expected params:route_href_fixture.routes.TodoParams`,
    ],
  },
  {
    define: "href_static_with_params",
    lines: [
      `${DIAGNOSTIC_SOURCE}:18: characters 19-32 : Too many arguments`,
    ],
  },
  {
    define: "href_unchecked_string",
    lines: [
      `${DIAGNOSTIC_SOURCE}:20: characters 3-109 : String should be nextjs.route.RouteHref<route_href_fixture.routes.TodoPattern>`,
    ],
  },
  {
    define: "query_missing",
    lines: [
      `${DIAGNOSTIC_SOURCE}:24: lines 24-29 : Object requires field tags`,
      `${DIAGNOSTIC_SOURCE}:24: lines 24-29 : ... For function argument 'query'`,
    ],
  },
  {
    define: "query_extra",
    lines: [
      "{ term : String, tags : Array<String>, scope : genes.ts.Undefinable<route_href_fixture.routes.SearchScope>, page : route_href_fixture.routes.PageNu... has extra field forged",
      "For function argument 'query'",
    ],
  },
  {
    define: "query_wrong_type",
    lines: [
      `${DIAGNOSTIC_SOURCE}:44: characters 10-15 : String should be route_href_fixture.routes.PageNumber`,
      `${DIAGNOSTIC_SOURCE}:44: characters 10-15 : ... For function argument 'query'`,
    ],
  },
  {
    define: "query_unsupported",
    lines: [
      `${DIAGNOSTIC_SOURCE}:65: characters 2-27 : [NXHX-ROUTE-QUERY-FIELD-0002] Query values support String, Int, Bool, transitively string-backed abstracts, or domain abstracts with @:next.queryCodec; found Float.`,
    ],
  },
  {
    define: "query_bad_codec",
    lines: [
      `${DIAGNOSTIC_SOURCE}:76: lines 76-78 : [NXHX-ROUTE-QUERY-CODEC-0003] Query codec "route_href_fixture.NegativeDeclarations.BadTokenCodec" encode must have exact signature encode(value:route_href_fixture.BadToken):String.`,
    ],
  },
  {
    define: "query_forged_string",
    lines: [
      `${DIAGNOSTIC_SOURCE}:54: characters 49-69 : [NXHX-ROUTE-QUERY-SCHEMA-0001] Query schema must be an anonymous typedef or non-generic @:structInit class; found String.`,
    ],
  },
  {
    define: "query_mutable",
    lines: [
      `${DIAGNOSTIC_SOURCE}:92: characters 2-26 : [NXHX-ROUTE-QUERY-FIELD-0002] Query field "value" must be public and read-only.`,
    ],
  },
  {
    define: "query_path_arity",
    lines: [
      `${DIAGNOSTIC_SOURCE}:58: characters 54-76 : [NXHX-ROUTE-QUERY-HREF-0004] Dynamic query route "todos/[id]" requires exact params followed by the query value.`,
    ],
  },
];

class RouteHrefFailure extends Error {}

function run(command, args, expectedStatus = 0) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    encoding: "utf8",
    env: {
      ...process.env,
      CI: "1",
      NEXT_TELEMETRY_DISABLED: "1",
      NO_COLOR: "1",
    },
  });
  if (result.error !== undefined) {
    throw result.error;
  }
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  if (result.status !== expectedStatus) {
    throw new RouteHrefFailure(
      `${path.basename(command)} exited ${result.status}; expected ${expectedStatus}:\n${output}`,
    );
  }
  return output;
}

function read(relative) {
  const file = path.join(TYPESCRIPT_OUTPUT, relative);
  assert(fs.statSync(file).isFile(), `${relative} must be emitted`);
  return fs.readFileSync(file, "utf8");
}

function readClassic(relative) {
  const file = path.join(CLASSIC_OUTPUT, relative);
  assert(fs.statSync(file).isFile(), `classic ${relative} must be emitted`);
  return fs.readFileSync(file, "utf8");
}

function walk(directory) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const child = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(child));
    } else if (entry.isFile()) {
      files.push(child);
    } else {
      throw new RouteHrefFailure(`generated output cannot contain a link: ${child}`);
    }
  }
  return files.sort();
}

function normalizeDiagnostic(output) {
  return output
    .replace(ANSI_ESCAPE, "")
    .replaceAll("\\", "/")
    .replaceAll(`${ROOT.replaceAll("\\", "/")}/`, "")
    .trim()
    .split(/\r?\n/)
    .map((line) => line.trimEnd());
}

function clean() {
  fs.rmSync(OUTPUT, { recursive: true, force: true });
  fs.rmSync(NEXT_OUTPUT, { recursive: true, force: true });
  fs.rmSync(path.join(NEXT_APP, "next-env.d.ts"), { force: true });
  fs.rmSync(path.join(NEXT_APP, "tsconfig.tsbuildinfo"), { force: true });
}

function verifyToolchain() {
  assert.equal(run("haxe", ["--version"]).trim(), HAXE_VERSION);
  const lock = fs.readFileSync(path.join(ROOT, "haxe_libraries/genes-ts.hxml"), "utf8");
  assert(lock.includes(`genes-ts/${GENES_VERSION}/github/${GENES_COMMIT}`));
  assert(lock.includes(`-D genes-ts=${GENES_VERSION}`));
  assert(!lock.includes(ROOT), "genes-ts lock contains a machine-local path");
}

function verifyGeneratedOutput() {
  const runtime = read("route_href_fixture/RuntimeConsumer.ts");
  const server = read("route_href_fixture/ServerConsumer.ts");
  const client = read("route_href_fixture/ClientConsumer.ts");
  const classic = readClassic("route_href_fixture/RuntimeConsumer.js");

  for (const literal of ['return "/";', 'return "/about";']) {
    assert(runtime.includes(literal), `static call-site expansion lost ${literal}`);
  }
  for (const template of [
    'return `/todos/${__nextRoute0Encoded0}`;',
    'return `/orders/${__nextRoute0Encoded0}`;',
    'return `/teams/${__nextRoute0Encoded0}/members/${__nextRoute0Encoded1}`;',
    'return `/docs/${__nextRoute0Encoded0}`;',
    'return `/archive/${__nextRoute0Encoded0}`;',
  ]) {
    assert(runtime.includes(template), `TypeScript output lost native template ${template}`);
  }
  assert(runtime.includes('return "/archive/";'), "optional catch-all lost its Next-compatible absent href");
  assert(runtime.includes("encodeURIComponent"), "dynamic hrefs lost URL encoding");
  assert(runtime.includes("NumericIdCodec.encode"), "domain codec no longer runs before encoding");
  assert(runtime.includes("new URLSearchParams()"), "query hrefs lost native URLSearchParams encoding");
  assert(runtime.includes("PageNumberCodec.encode"), "query domain codec no longer runs before native encoding");
  assert(
    runtime.includes('return `${__nextQuery0Href}?${__nextQuery0Encoded}`;'),
    "query hrefs lost their native template-literal Route<T> shape",
  );
  const queryStart = runtime.indexOf('append("exact"');
  const queryOrder = [
    'append("exact"',
    'append("page"',
    'append("q"',
    'append("scope"',
    'append("tag"',
  ].map((fragment) => runtime.indexOf(fragment, queryStart));
  assert(
    queryOrder.every((offset, index) => offset >= queryStart && (index === 0 || offset > queryOrder[index - 1])),
    "query fields lost canonical bytewise key order",
  );
  assert(
    runtime.includes("const __nextQuery0Absent3: boolean") && runtime.includes("if (!__nextQuery0Absent3)"),
    "optional query values lost their exact undefined guard",
  );
  assert(!runtime.includes('return "/todos/" +'), "ordinary concatenation widened the typed href");
  assert(!/TemplateLiteral(?:Marker)?|unsafeCast|\sas\s/.test(runtime), "compiler markers or assertions leaked into route output");

  for (const source of [server, client]) {
    assert(!source.includes("TodoRoute"), "a consumer retained the generated route helper class");
    assert(source.includes('return `/todos/${__nextRoute0Encoded0}`;'));
    assert(!source.includes("PageImplementation"), "a consumer imported the server page implementation");
  }
  const method = (source) => {
    const match = /static todo\(id: string\):[^\n]+\{([\s\S]*?)\n\t\}/.exec(source);
    assert(match !== null, "consumer todo method was not emitted");
    return match[1];
  };
  assert.equal(method(client), method(server), "server and client route expansion drifted");

  for (const route of ["Root", "About", "Todo", "Member", "Docs", "Archive"]) {
    assert(
      !fs.existsSync(path.join(TYPESCRIPT_OUTPUT, `route_href_fixture/routes/${route}Route.ts`)),
      `${route}Route created an unnecessary runtime module`,
    );
  }
  const codecModule = read("route_href_fixture/routes/OrderRoute.ts");
  assert(codecModule.includes("export class NumericIdCodec"));
  assert(!codecModule.includes("class OrderRoute"), "the inline route companion leaked beside its required codec");
  const queryCodecModule = read("route_href_fixture/routes/SearchRoute.ts");
  assert(queryCodecModule.includes("export class PageNumberCodec"));
  assert(!queryCodecModule.includes("class SearchRoute"), "the inline query companion leaked beside its required codec");
  const sparseMethod = /static sparse\(\):[^\n]+\{([\s\S]*?)\n\t\}/.exec(runtime);
  assert(sparseMethod !== null, "sparse query consumer method was not emitted");
  assert(
    sparseMethod[1].includes("const __nextQuery0Value_scope: string | undefined = scope;") &&
      sparseMethod[1].includes("const __nextQuery0Value_tags: string[] = [];"),
    "anonymous sparse query fields lost their exact closed emitted types",
  );
  assert(
    !fs.existsSync(path.join(TYPESCRIPT_OUTPUT, "route_href_fixture/routes/SparseRoute.ts")),
    "compile-time-only sparse route/query declarations emitted an unnecessary runtime module",
  );
  assert(!runtime.includes("routes/SparseRoute"), "the anonymous query typedef leaked into consumer runtime imports");

  assert(classic.includes('return ("/todos/" + (__nextRoute0Encoded0) + "");'));
  assert(classic.includes('return ("/teams/" + (__nextRoute0Encoded0) + "/members/" + (__nextRoute0Encoded1) + "");'));
  assert(classic.includes("new URLSearchParams()"));

  for (const outputRoot of [TYPESCRIPT_OUTPUT, CLASSIC_OUTPUT]) {
    for (const file of walk(outputRoot)) {
      const source = fs.readFileSync(file, "utf8");
      assert(!source.includes(ROOT), `${path.relative(ROOT, file)} leaked the compiler host path`);
      assert(!source.includes("server-only-page-implementation"));
      assert(!source.includes("TodoPageImplementation"));
    }
  }
}

function verifyNegativeCases() {
  for (const fixture of NEGATIVE_CASES) {
    const output = run(
      "haxe",
      ["tests/route-hrefs/build-negative.hxml", "-D", fixture.define],
      1,
    );
    assert.deepEqual(normalizeDiagnostic(output), fixture.lines, fixture.define);
  }
}

function verifyNextParity() {
  const paritySource = fs.readFileSync(
    path.join(NEXT_APP, "app/route-parity.tsx"),
    "utf8",
  );
  for (const route of [
    'Route<"/">',
    'Route<"/archive/">',
    'Route<"/catalog/nextjshx-probe">',
    'Route<"/docs/nextjshx-probe/tail">',
    'Route<"/todos/nextjshx-probe?page=2&tag=haxe">',
    '"/teams/nextjshx-probe/members/nextjshx-probe"',
  ]) {
    assert(paritySource.includes(route), `tracked parity source lost ${route}`);
  }
  run(process.execPath, [NEXT_BIN, "typegen", NEXT_APP]);
  run(process.execPath, [
    TSC_BIN,
    "--project",
    path.join(NEXT_APP, "tsconfig.json"),
    "--pretty",
    "false",
    "--noEmit",
  ]);
  const negative = run(process.execPath, [
    TSC_BIN,
    "--project",
    path.join(NEXT_APP, "tsconfig.route-negative.json"),
    "--pretty",
    "false",
    "--noEmit",
  ], 2);
  assert.match(negative, /route-parity-negative\.ts\(3,14\): error TS2322:/);
  assert.match(negative, /not-in-next-route-graph/);
}

try {
  clean();
  verifyToolchain();
  run("haxe", ["tests/route-hrefs/build-typescript.hxml"]);
  run("haxe", ["tests/route-hrefs/build-classic.hxml"]);
  run(process.execPath, [TSC_BIN, "--project", "tests/route-hrefs/tsconfig.json", "--noEmit"]);
  verifyGeneratedOutput();
  const runtime = run(process.execPath, ["tests/route-hrefs/runtime.mjs"]);
  assert.equal(runtime.trim(), "route-hrefs-runtime: OK: 13 path/query and shared-consumer assertions");
  verifyNegativeCases();
  verifyNextParity();
  console.log(
    `route-hrefs: OK: 11 typed path/query calls, 1 native route-group shape, 13 runtime assertions, ${NEGATIVE_CASES.length + 1} compile failures, strict generated TypeScript, and Next Route<T> parity`,
  );
} catch (error) {
  console.error(`[route-hrefs] ERROR: ${error.message}`);
  process.exitCode = 1;
} finally {
  clean();
}
