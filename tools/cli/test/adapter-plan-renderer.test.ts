import assert from "node:assert/strict";
import {
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  CliDiagnosticError,
  type AdapterPlan,
  parseAdapterPlan,
  readAdapterPlan,
  renderAdapterPlan,
} from "../src/index.js";

function position(): Record<string, unknown> {
  return {
    file: "src/routes/TodoPage.hx",
    startLine: 1,
    startCharacter: 1,
    endLine: 2,
    endCharacter: 1,
  };
}

function planValue(
  signature = '(props: PageProps<"/todos/[id]">) => JSX.Element',
): Record<string, unknown> {
  return {
    $schema: "https://nextjshx.dev/schemas/adapter-plan.schema.json",
    schemaVersion: 2,
    toolchain: {
      nextjshx: "0.0.0-development",
      haxe: "4.3.7",
      genesTs: "1.49.0+19c9fb7197b38b5035ef286786dec71f74fabb2c",
      next: "16.2.12",
    },
    intents: [
      {
        kind: "page",
        source: {
          typeName: "fixture.TodoPage",
          fieldName: "render",
          typePosition: position(),
          fieldPosition: position(),
          metadataPosition: position(),
        },
        segmentPath: "todos/[id]",
        targetPath: "todos/[id]/page.tsx",
        implementation: {
          modulePath: "../../../../src-gen/fixture/TodoPage",
          symbol: "TodoPage",
        },
        sideEffectImports: [],
        imports: [
          {
            modulePath: "../../../../src-gen/fixture/TodoPage",
            symbol: "TodoPage",
            alias: null,
            typeOnly: false,
          },
          {
            modulePath: "react",
            symbol: "JSX",
            alias: null,
            typeOnly: true,
          },
        ],
        directives: [],
        exports: [
          {
            kind: "default",
            name: "default",
            sourceField: "render",
            signature,
          },
        ],
        config: [
          {
            name: "runtime",
            value: { kind: "string", value: "nodejs" },
          },
        ],
      },
    ],
  };
}

function proxyPlanValue(
  matchers: readonly string[] = ["/haxe", "/products/:path*"],
): Record<string, unknown> {
  return {
    $schema: "https://nextjshx.dev/schemas/adapter-plan.schema.json",
    schemaVersion: 2,
    toolchain: {
      nextjshx: "0.0.0-development",
      haxe: "4.3.7",
      genesTs: "1.49.0+19c9fb7197b38b5035ef286786dec71f74fabb2c",
      next: "16.2.12",
    },
    intents: [
      {
        kind: "proxy",
        source: {
          typeName: "fixture.RequestProxy",
          fieldName: "proxy",
          typePosition: position(),
          fieldPosition: position(),
          metadataPosition: position(),
        },
        segmentPath: "",
        targetPath: "proxy.ts",
        implementation: {
          modulePath: "./src-gen/fixture/RequestProxy",
          symbol: "RequestProxy",
        },
        sideEffectImports: [],
        imports: [
          {
            modulePath: "./src-gen/fixture/RequestProxy",
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
          ...(matchers.length === 0
            ? []
            : [
                {
                  modulePath: "next/server",
                  symbol: "ProxyConfig",
                  alias: "NextJsHxProxyConfig",
                  typeOnly: true,
                },
              ]),
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
        config:
          matchers.length === 0
            ? []
            : [
                {
                  name: "matcher",
                  value:
                    matchers.length === 1
                      ? { kind: "string", value: matchers[0] }
                      : { kind: "string-array", value: [...matchers] },
                },
              ],
      },
    ],
  };
}

function clientComponentPlanValue(): Record<string, unknown> {
  return {
    $schema: "https://nextjshx.dev/schemas/adapter-plan.schema.json",
    schemaVersion: 2,
    toolchain: {
      nextjshx: "0.0.0-development",
      haxe: "4.3.7",
      genesTs: "1.49.0+19c9fb7197b38b5035ef286786dec71f74fabb2c",
      next: "16.2.12",
    },
    intents: [
      {
        kind: "client-component",
        source: {
          typeName: "fixture.LikeButton",
          fieldName: "render",
          typePosition: position(),
          fieldPosition: position(),
          metadataPosition: position(),
        },
        segmentPath: "components",
        targetPath: "components/LikeButton.tsx",
        implementation: {
          modulePath: "../../../src-gen/fixture/LikeButton",
          symbol: "LikeButton",
        },
        sideEffectImports: [],
        imports: [
          {
            modulePath: "../../../src-gen/fixture/LikeButton",
            symbol: "LikeButton",
            alias: null,
            typeOnly: false,
          },
          {
            modulePath: "react",
            symbol: "ComponentType",
            alias: null,
            typeOnly: true,
          },
        ],
        directives: ["use client"],
        exports: [
          {
            kind: "default",
            name: "default",
            sourceField: "render",
            signature: "ComponentType<Parameters<typeof LikeButton.render>[0]>",
          },
        ],
        config: [],
      },
    ],
  };
}

function reactHookPlanValue(): Record<string, unknown> {
  return {
    $schema: "https://nextjshx.dev/schemas/adapter-plan.schema.json",
    schemaVersion: 2,
    toolchain: {
      nextjshx: "0.0.0-development",
      haxe: "4.3.7",
      genesTs: "1.49.0+19c9fb7197b38b5035ef286786dec71f74fabb2c",
      next: "16.2.12",
    },
    intents: [
      {
        kind: "react-hook",
        source: {
          typeName: "fixture.SelectionHooks",
          fieldName: "useSelection",
          typePosition: position(),
          fieldPosition: position(),
          metadataPosition: position(),
        },
        segmentPath: "_nextjshx/hook/0123456789ab",
        targetPath: "_nextjshx/hook/0123456789ab/useSelection.ts",
        implementation: {
          modulePath: "../../../../src-gen/fixture/SelectionHooks",
          symbol: "SelectionHooks",
        },
        sideEffectImports: [],
        imports: [
          {
            modulePath: "../../../../src-gen/fixture/SelectionHooks",
            symbol: "SelectionHooks",
            alias: null,
            typeOnly: false,
          },
        ],
        directives: ["use client"],
        exports: [
          {
            kind: "named",
            name: "useSelection",
            sourceField: "useSelection",
            signature: "typeof SelectionHooks.useSelection",
          },
        ],
        config: [],
      },
    ],
  };
}

function mdxComponentsPlanValue(): Record<string, unknown> {
  return {
    $schema: "https://nextjshx.dev/schemas/adapter-plan.schema.json",
    schemaVersion: 2,
    toolchain: {
      nextjshx: "0.0.0-development",
      haxe: "4.3.7",
      genesTs: "1.49.0+19c9fb7197b38b5035ef286786dec71f74fabb2c",
      next: "16.2.12",
    },
    intents: [
      {
        kind: "mdx-components",
        source: {
          typeName: "fixture.AtlasMdxComponents",
          fieldName: "components",
          typePosition: position(),
          fieldPosition: position(),
          metadataPosition: position(),
        },
        segmentPath: "",
        targetPath: "mdx-components.tsx",
        implementation: {
          modulePath: "./src-gen/fixture/AtlasMdxComponents",
          symbol: "AtlasMdxComponents",
        },
        sideEffectImports: [],
        imports: [
          {
            modulePath: "./src-gen/fixture/AtlasMdxComponents",
            symbol: "AtlasMdxComponents",
            alias: "NextJsHxMdxRegistry",
            typeOnly: false,
          },
        ],
        directives: [],
        exports: [
          {
            kind: "named",
            name: "useMDXComponents",
            sourceField: "components",
            signature: "typeof NextJsHxMdxRegistry.components",
          },
        ],
        config: [],
      },
    ],
  };
}

function serverFunctionPlanValue(): Record<string, unknown> {
  return {
    $schema: "https://nextjshx.dev/schemas/adapter-plan.schema.json",
    schemaVersion: 2,
    toolchain: {
      nextjshx: "0.0.0-development",
      haxe: "4.3.7",
      genesTs: "1.49.0+19c9fb7197b38b5035ef286786dec71f74fabb2c",
      next: "16.2.12",
    },
    intents: [
      {
        kind: "server-function",
        source: {
          typeName: "fixture.TodoActions",
          fieldName: "createTodo",
          typePosition: position(),
          fieldPosition: position(),
          metadataPosition: position(),
        },
        segmentPath: "todos",
        targetPath: "todos/actions.ts",
        implementation: {
          modulePath: "../../../src-gen/fixture/TodoActions",
          symbol: "TodoActions",
        },
        sideEffectImports: [],
        imports: [
          {
            modulePath: "../../../src-gen/fixture/TodoActions",
            symbol: "TodoActions",
            alias: null,
            typeOnly: false,
          },
        ],
        directives: ["use server"],
        exports: [
          {
            kind: "named",
            name: "createTodo",
            sourceField: "createTodo",
            signature:
              "(...args: Parameters<typeof TodoActions.createTodo>) => Promise<Awaited<ReturnType<typeof TodoActions.createTodo>>>",
          },
          {
            kind: "named",
            name: "toggleTodo",
            sourceField: "toggleTodo",
            signature:
              "(...args: Parameters<typeof TodoActions.toggleTodo>) => Promise<Awaited<ReturnType<typeof TodoActions.toggleTodo>>>",
          },
        ],
        config: [],
      },
    ],
  };
}

function cacheFunctionPlanValue(
  directive = "use cache",
): Record<string, unknown> {
  return {
    $schema: "https://nextjshx.dev/schemas/adapter-plan.schema.json",
    schemaVersion: 2,
    toolchain: {
      nextjshx: "0.0.0-development",
      haxe: "4.3.7",
      genesTs: "1.49.0+19c9fb7197b38b5035ef286786dec71f74fabb2c",
      next: "16.2.12",
    },
    intents: [
      {
        kind: "cache-function",
        source: {
          typeName: "fixture.CachedCatalog",
          fieldName: "lookup",
          typePosition: position(),
          fieldPosition: position(),
          metadataPosition: position(),
        },
        segmentPath: "_nextjshx/cache/catalog",
        targetPath: "_nextjshx/cache/catalog/data.ts",
        implementation: {
          modulePath: "../../../../src-gen/fixture/CachedCatalog",
          symbol: "CachedCatalog",
        },
        sideEffectImports: [],
        imports: [
          {
            modulePath: "../../../../src-gen/fixture/CachedCatalog",
            symbol: "CachedCatalog",
            alias: null,
            typeOnly: false,
          },
        ],
        directives: [directive],
        exports: [
          {
            kind: "named",
            name: "lookup",
            sourceField: "lookup",
            signature:
              "(...args: Parameters<typeof CachedCatalog.lookup>) => Promise<Awaited<ReturnType<typeof CachedCatalog.lookup>>>",
          },
        ],
        config: [],
      },
    ],
  };
}

function expectCliDiagnostic(
  operation: () => unknown,
  code: string,
): CliDiagnosticError {
  try {
    operation();
  } catch (error) {
    assert(error instanceof CliDiagnosticError);
    assert.equal(error.diagnostic.code, code);
    assert.equal(error.diagnostic.docs, "docs/cli.md");
    return error;
  }
  assert.fail(`expected ${code}`);
}

test("parses a closed canonical plan and renders only delegated adapter code", () => {
  const plan = parseAdapterPlan(planValue());
  assert(Object.isFrozen(plan));
  assert(Object.isFrozen(plan.intents));
  const outputs = renderAdapterPlan("src/app", plan);
  assert.deepEqual(outputs, [
    {
      path: "src/app/todos/[id]/page.tsx",
      kind: "page-adapter",
      source: "fixture.TodoPage.render",
      content:
        "// Generated by NextJsHx from fixture.TodoPage.render.\n\n" +
        "import { TodoPage } from \"../../../../src-gen/fixture/TodoPage\";\n" +
        "import type { JSX } from \"react\";\n\n" +
        "const NextJsHxDefault: (props: PageProps<\"/todos/[id]\">) => JSX.Element = TodoPage.render;\n" +
        "export default NextJsHxDefault;\n" +
        "export const runtime = \"nodejs\";\n",
    },
  ]);
});

test("keeps layout CSS requests in authored order as ordinary ESM imports", () => {
  const value = planValue();
  const intent = (value.intents as Array<Record<string, unknown>>)[0];
  assert(intent !== undefined);
  intent.kind = "layout";
  intent.segmentPath = "";
  intent.targetPath = "layout.tsx";
  intent.sideEffectImports = ["./globals.css", "design-system/theme.css"];
  intent.exports = [
    {
      kind: "default",
      name: "default",
      sourceField: "render",
      signature: '(props: LayoutProps<"/">) => JSX.Element',
    },
  ];
  intent.config = [];

  const [output] = renderAdapterPlan("src/app", parseAdapterPlan(value));
  assert(output !== undefined);
  assert.equal(
    output.content,
    "// Generated by NextJsHx from fixture.TodoPage.render.\n\n" +
      'import "./globals.css";\n' +
      'import "design-system/theme.css";\n' +
      'import { TodoPage } from "../../../../src-gen/fixture/TodoPage";\n' +
      'import type { JSX } from "react";\n\n' +
      'const NextJsHxDefault: (props: LayoutProps<"/">) => JSX.Element = TodoPage.render;\n' +
      "export default NextJsHxDefault;\n",
  );
});

test("rejects duplicate layout CSS requests before rendering", () => {
  const value = planValue();
  const intent = (value.intents as Array<Record<string, unknown>>)[0];
  assert(intent !== undefined);
  intent.sideEffectImports = ["./globals.css", "./globals.css"];
  expectCliDiagnostic(() => parseAdapterPlan(value), "NXHX-CLI-PLAN-0004");
});

test("rejects malformed or escaping CSS requests in a corrupted plan", () => {
  for (const request of ["../globals.css", "./globals.scss", "./globals.css?raw"]) {
    const value = planValue();
    const intent = (value.intents as Array<Record<string, unknown>>)[0];
    assert(intent !== undefined);
    intent.sideEffectImports = [request];
    expectCliDiagnostic(() => parseAdapterPlan(value), "NXHX-CLI-PLAN-0004");
  }
});

test("rejects a CSS request on a page even if a plan is corrupted", () => {
  const value = planValue();
  const intent = (value.intents as Array<Record<string, unknown>>)[0];
  assert(intent !== undefined);
  intent.sideEffectImports = ["./globals.css"];

  const plan = parseAdapterPlan(value);
  expectCliDiagnostic(
    () => renderAdapterPlan("src/app", plan),
    "NXHX-CLI-RENDER-0005",
  );
});

test("renders module-level page bindings without a synthetic class owner", () => {
  const value = planValue(
    '(props: PageProps<"/todos/[id]">) => Promise<JSX.Element>',
  );
  const intent = (value.intents as Array<Record<string, unknown>>)[0];
  assert(intent !== undefined);
  intent.implementation = {
    modulePath: "../../../../src-gen/fixture/TodoPage",
    symbol: "render",
  };
  intent.imports = [
    {
      modulePath: "../../../../src-gen/fixture/TodoPage",
      symbol: "generateStaticParams",
      alias: "NextJsHxGenerateStaticParamsImplementation",
      typeOnly: false,
    },
    {
      modulePath: "../../../../src-gen/fixture/TodoPage",
      symbol: "render",
      alias: null,
      typeOnly: false,
    },
    {
      modulePath: "react",
      symbol: "JSX",
      alias: null,
      typeOnly: true,
    },
  ];
  intent.exports = [
    ...(intent.exports as Array<unknown>),
    {
      kind: "named",
      name: "generateStaticParams",
      sourceField: "generateStaticParams",
      signature:
        '() => Array<Awaited<PageProps<"/todos/[id]">["params"]>>',
    },
  ];

  const [output] = renderAdapterPlan("src/app", parseAdapterPlan(value));
  assert(output !== undefined);
  assert.equal(
    output.content,
    "// Generated by NextJsHx from fixture.TodoPage.render.\n\n" +
      "import { generateStaticParams as NextJsHxGenerateStaticParamsImplementation } from \"../../../../src-gen/fixture/TodoPage\";\n" +
      "import { render } from \"../../../../src-gen/fixture/TodoPage\";\n" +
      "import type { JSX } from \"react\";\n\n" +
      "const NextJsHxDefault: (props: PageProps<\"/todos/[id]\">) => Promise<JSX.Element> = render;\n" +
      "export default NextJsHxDefault;\n" +
      "export const generateStaticParams: () => Array<Awaited<PageProps<\"/todos/[id]\">[\"params\"]>> = NextJsHxGenerateStaticParamsImplementation;\n" +
      "export const runtime = \"nodejs\";\n",
  );
  assert(!String(output.content).includes("_Fields_"));
});

test("aliases direct module metadata before publishing Next's named export", () => {
  const value = planValue();
  const intent = (value.intents as Array<Record<string, unknown>>)[0];
  assert(intent !== undefined);
  intent.implementation = {
    modulePath: "../../../../src-gen/fixture/TodoPage",
    symbol: "render",
  };
  intent.imports = [
    {
      modulePath: "../../../../src-gen/fixture/TodoPage",
      symbol: "metadata",
      alias: "NextJsHxMetadataImplementation",
      typeOnly: false,
    },
    {
      modulePath: "../../../../src-gen/fixture/TodoPage",
      symbol: "render",
      alias: null,
      typeOnly: false,
    },
    {
      modulePath: "next",
      symbol: "Metadata",
      alias: null,
      typeOnly: true,
    },
    {
      modulePath: "react",
      symbol: "JSX",
      alias: null,
      typeOnly: true,
    },
  ];
  intent.exports = [
    ...(intent.exports as Array<unknown>),
    {
      kind: "named",
      name: "metadata",
      sourceField: "metadata",
      signature: "Metadata",
    },
  ];

  const [output] = renderAdapterPlan("src/app", parseAdapterPlan(value));
  assert(output !== undefined);
  assert.equal(
    output.content,
    "// Generated by NextJsHx from fixture.TodoPage.render.\n\n" +
      "import { metadata as NextJsHxMetadataImplementation } from \"../../../../src-gen/fixture/TodoPage\";\n" +
      "import { render } from \"../../../../src-gen/fixture/TodoPage\";\n" +
      "import type { Metadata } from \"next\";\n" +
      "import type { JSX } from \"react\";\n\n" +
      "const NextJsHxDefault: (props: PageProps<\"/todos/[id]\">) => JSX.Element = render;\n" +
      "export default NextJsHxDefault;\n" +
      "export const metadata: Metadata = NextJsHxMetadataImplementation;\n" +
      "export const runtime = \"nodejs\";\n",
  );
  assert(!String(output.content).includes("_Fields_"));
});

test("keeps filesystem topology out of grouped and intercepted public signatures", () => {
  const grouped = planValue();
  const groupedIntent = (grouped.intents as Array<Record<string, unknown>>)[0];
  assert(groupedIntent !== undefined);
  groupedIntent.segmentPath = "(marketing)/todos/[id]";
  groupedIntent.targetPath = "(marketing)/todos/[id]/page.tsx";

  const [groupedOutput] = renderAdapterPlan(
    "src/app",
    parseAdapterPlan(grouped),
  );
  assert(groupedOutput !== undefined);
  assert.equal(
    groupedOutput.path,
    "src/app/(marketing)/todos/[id]/page.tsx",
  );
  assert.match(
    String(groupedOutput.content),
    /PageProps<"\/todos\/\[id\]">/,
  );
  assert.doesNotMatch(String(groupedOutput.content), /PageProps<"\/\(marketing\)/);

  const intercepted = planValue();
  const interceptedIntent = (
    intercepted.intents as Array<Record<string, unknown>>
  )[0];
  assert(interceptedIntent !== undefined);
  interceptedIntent.segmentPath = "feed/@modal/(..)todos/[id]";
  interceptedIntent.targetPath = "feed/@modal/(..)todos/[id]/page.tsx";

  const [interceptedOutput] = renderAdapterPlan(
    "src/app",
    parseAdapterPlan(intercepted),
  );
  assert(interceptedOutput !== undefined);
  assert.equal(
    interceptedOutput.path,
    "src/app/feed/@modal/(..)todos/[id]/page.tsx",
  );
  assert.match(
    String(interceptedOutput.content),
    /PageProps<"\/todos\/\[id\]">/,
  );
  assert.doesNotMatch(String(interceptedOutput.content), /PageProps<"\/feed/);
});

test("rejects malformed topology before rendering a route adapter", () => {
  const malformed = planValue();
  const intent = (malformed.intents as Array<Record<string, unknown>>)[0];
  assert(intent !== undefined);
  intent.segmentPath = "feed/@children/todos/[id]";
  intent.targetPath = "feed/@children/todos/[id]/page.tsx";
  expectCliDiagnostic(
    () => renderAdapterPlan("src/app", parseAdapterPlan(malformed)),
    "NXHX-CLI-ROUTE-0007",
  );
});

test("rejects a weakened page default signature", () => {
  const weak = planValue("(props: object) => JSX.Element");
  assert.equal(
    expectCliDiagnostic(
      () => renderAdapterPlan("src/app", parseAdapterPlan(weak)),
      "NXHX-CLI-RENDER-0005",
    ).diagnostic.subject,
    "default.signature",
  );
});

test("embeds one exact implementation-graph digest and rejects partial coverage", () => {
  const plan = parseAdapterPlan(planValue());
  const outputPath = "src/app/todos/[id]/page.tsx";
  const implementationDigest = "a".repeat(64);
  const [output] = renderAdapterPlan("src/app", plan, {
    implementationDigests: new Map([[outputPath, implementationDigest]]),
  });
  assert(output !== undefined);
  assert.match(
    String(output.content),
    new RegExp(`^// Generated by NextJsHx from fixture\\.TodoPage\\.render\\. Implementation graph: sha256:${implementationDigest}\\.`),
  );

  assert.throws(
    () => renderAdapterPlan("src/app", plan, { implementationDigests: new Map() }),
    /implementation digest coverage differs.*missing src\/app\/todos\/\[id\]\/page\.tsx/,
  );
  assert.throws(
    () => renderAdapterPlan("src/app", plan, {
      implementationDigests: new Map([
        [outputPath, implementationDigest],
        ["src/app/unowned/page.tsx", "b".repeat(64)],
      ]),
    }),
    /implementation digest coverage differs.*extra src\/app\/unowned\/page\.tsx/,
  );
});

test("renders one typed proxy and optional matcher config at Next's exact root", () => {
  const plan = parseAdapterPlan(proxyPlanValue());
  const [rootOutput] = renderAdapterPlan("app", plan);
  const [srcOutput] = renderAdapterPlan("src/app", plan);
  assert(rootOutput !== undefined);
  assert(srcOutput !== undefined);
  assert.equal(rootOutput.path, "proxy.ts");
  assert.equal(srcOutput.path, "src/proxy.ts");
  assert.equal(rootOutput.kind, "proxy-adapter");
  assert.equal(
    rootOutput.content,
    "// Generated by NextJsHx from fixture.RequestProxy.proxy.\n\n" +
      'import { RequestProxy } from "./src-gen/fixture/RequestProxy";\n' +
      'import type { NextProxy as NextJsHxProxy } from "next/server";\n' +
      'import type { ProxyConfig as NextJsHxProxyConfig } from "next/server";\n\n' +
      "export const proxy: NextJsHxProxy = RequestProxy.proxy;\n" +
      'export const config: NextJsHxProxyConfig = { matcher: ["/haxe","/products/:path*"] };\n',
  );

  const [withoutConfig] = renderAdapterPlan(
    "app",
    parseAdapterPlan(proxyPlanValue([])),
  );
  assert(withoutConfig !== undefined);
  assert(!String(withoutConfig.content).includes("ProxyConfig"));
  assert(!String(withoutConfig.content).includes("export const config"));
});

test("rejects weakened proxy roots, imports, exports, and matcher literals", () => {
  assert.equal(
    expectCliDiagnostic(
      () => renderAdapterPlan("frontend/app", parseAdapterPlan(proxyPlanValue())),
      "NXHX-CLI-RENDER-0005",
    ).diagnostic.subject,
    "appRoot",
  );

  const invalidMatchers = [
    ["haxe"],
    ["/products", "/haxe"],
    ["/haxe", "/haxe"],
  ];
  for (const matchers of invalidMatchers) {
    assert.equal(
      expectCliDiagnostic(
        () => renderAdapterPlan("app", parseAdapterPlan(proxyPlanValue(matchers))),
        "NXHX-CLI-RENDER-0005",
      ).diagnostic.subject,
      "config.matcher",
    );
  }

  const extraImport = proxyPlanValue();
  const extraIntent = (extraImport.intents as Array<Record<string, unknown>>)[0];
  assert(extraIntent !== undefined);
  extraIntent.imports = [
    ...(extraIntent.imports as Array<unknown>),
    {
      modulePath: "side-effect-package",
      symbol: "surprise",
      alias: null,
      typeOnly: false,
    },
  ];
  assert.equal(
    expectCliDiagnostic(
      () => renderAdapterPlan("app", parseAdapterPlan(extraImport)),
      "NXHX-CLI-RENDER-0005",
    ).diagnostic.subject,
    "imports",
  );

  const weakExport = proxyPlanValue();
  const weakIntent = (weakExport.intents as Array<Record<string, unknown>>)[0];
  assert(weakIntent !== undefined);
  const exported = (weakIntent.exports as Array<Record<string, unknown>>)[0];
  assert(exported !== undefined);
  exported.signature = "(request: NextRequest) => null";
  assert.equal(
    expectCliDiagnostic(
      () => renderAdapterPlan("app", parseAdapterPlan(weakExport)),
      "NXHX-CLI-RENDER-0005",
    ).diagnostic.subject,
    "exports",
  );
});

test("renders reviewed metadata, static params, and direct Next segment literals", () => {
  const value = planValue();
  const intent = (value.intents as Array<Record<string, unknown>>)[0];
  assert(intent !== undefined);
  intent.imports = [
    (intent.imports as Array<unknown>)[0],
    {
      modulePath: "next",
      symbol: "Metadata",
      alias: null,
      typeOnly: true,
    },
    {
      modulePath: "next",
      symbol: "ResolvingMetadata",
      alias: null,
      typeOnly: true,
    },
    (intent.imports as Array<unknown>)[1],
  ];
  intent.exports = [
    ...(intent.exports as Array<unknown>),
    {
      kind: "named",
      name: "generateMetadata",
      sourceField: "generateMetadata",
      signature:
        '(props: PageProps<"/todos/[id]">, parent: ResolvingMetadata) => Promise<Metadata>',
    },
    {
      kind: "named",
      name: "generateStaticParams",
      sourceField: "generateStaticParams",
      signature:
        '() => Promise<Array<Awaited<PageProps<"/todos/[id]">["params"]>>>',
    },
  ];
  intent.config = [
    { name: "dynamicParams", value: { kind: "boolean", value: false } },
    { name: "maxDuration", value: { kind: "integer", value: 10 } },
    {
      name: "preferredRegion",
      value: { kind: "string-array", value: ["iad1", "sfo1"] },
    },
    { name: "revalidate", value: { kind: "integer", value: 60 } },
    { name: "runtime", value: { kind: "string", value: "nodejs" } },
  ];

  const [output] = renderAdapterPlan("src/app", parseAdapterPlan(value));
  assert(output !== undefined);
  if (typeof output.content !== "string") {
    assert.fail("adapter renderer returned binary metadata output");
  }
  const content = output.content;
  assert(content.includes("export const generateMetadata:"));
  assert(content.includes("export const generateStaticParams:"));
  assert(content.includes("export const dynamicParams = false;"));
  assert(content.includes("export const maxDuration = 10;"));
  assert(content.includes('export const preferredRegion = ["iad1","sfo1"];'));
  assert(content.includes("export const revalidate = 60;"));
  assert(content.includes('export const runtime = "nodejs";'));
  assert(!content.includes(" as const"));
});

test("rejects corrupted metadata exports and version-gated segment config", () => {
  const weakMetadata = planValue();
  const weakIntent = (weakMetadata.intents as Array<Record<string, unknown>>)[0];
  assert(weakIntent !== undefined);
  weakIntent.exports = [
    ...(weakIntent.exports as Array<unknown>),
    {
      kind: "named",
      name: "generateMetadata",
      sourceField: "generateMetadata",
      signature: "() => string",
    },
  ];
  assert.equal(
    expectCliDiagnostic(
      () => renderAdapterPlan("src/app", parseAdapterPlan(weakMetadata)),
      "NXHX-CLI-RENDER-0005",
    ).diagnostic.subject,
    "generateMetadata.signature",
  );

  const invalidCases = [
    {
      subject: "config.runtime",
      config: { name: "runtime", value: { kind: "string", value: "experimental-edge" } },
    },
    {
      subject: "config.revalidate",
      config: { name: "revalidate", value: { kind: "boolean", value: true } },
    },
    {
      subject: "config.maxDuration",
      config: { name: "maxDuration", value: { kind: "integer", value: 0 } },
    },
    {
      subject: "config.preferredRegion",
      config: { name: "preferredRegion", value: { kind: "string-array", value: [] } },
    },
    {
      subject: "config.preferredRegion",
      config: {
        name: "preferredRegion",
        value: { kind: "string-array", value: ["iad1", "iad1"] },
      },
    },
    {
      subject: "config",
      config: { name: "experimentalOption", value: { kind: "boolean", value: true } },
    },
  ];
  for (const fixture of invalidCases) {
    const candidate = planValue();
    const intent = (candidate.intents as Array<Record<string, unknown>>)[0];
    assert(intent !== undefined);
    intent.config = [fixture.config];
    assert.equal(
      expectCliDiagnostic(
        () => renderAdapterPlan("src/app", parseAdapterPlan(candidate)),
        "NXHX-CLI-RENDER-0005",
      ).diagnostic.subject,
      fixture.subject,
    );
  }

  const wrongVersion = planValue();
  const toolchain = wrongVersion.toolchain as Record<string, unknown>;
  toolchain.next = "16.3.0";
  assert.equal(
    expectCliDiagnostic(
      () => renderAdapterPlan("src/app", parseAdapterPlan(wrongVersion)),
      "NXHX-CLI-RENDER-0005",
    ).diagnostic.subject,
    "toolchain.next",
  );
});

test("renders an error boundary with the client directive as its first statement", () => {
  const value = planValue();
  const intent = (value.intents as Array<Record<string, unknown>>)[0];
  assert(intent !== undefined);
  intent.kind = "error";
  intent.segmentPath = "todos/[id]";
  intent.targetPath = "todos/[id]/error.tsx";
  intent.directives = ["use client"];
  intent.exports = [
    {
      kind: "default",
      name: "default",
      sourceField: "render",
      signature:
        "(props: { error: Error & { digest?: string }; reset: () => void }) => JSX.Element",
    },
  ];
  intent.config = [];

  const [output] = renderAdapterPlan("src/app", parseAdapterPlan(value));
  assert(output !== undefined);
  assert.equal(output.path, "src/app/todos/[id]/error.tsx");
  assert.equal(output.kind, "error-adapter");
  assert.equal(
    output.content,
    '"use client";\n\n' +
      "// Generated by NextJsHx from fixture.TodoPage.render.\n\n" +
      'import { TodoPage } from "../../../../src-gen/fixture/TodoPage";\n' +
      'import type { JSX } from "react";\n\n' +
      "const NextJsHxDefault: (props: {\n" +
      "    error: Error & {\n" +
      "        digest?: string;\n" +
      "    };\n" +
      "    reset: () => void;\n" +
      "}) => JSX.Element = TodoPage.render;\n" +
      "export default NextJsHxDefault;\n",
  );
});

test("renders a precise directive-first Client Component adapter", () => {
  const [output] = renderAdapterPlan(
    "src/app",
    parseAdapterPlan(clientComponentPlanValue()),
  );
  assert(output !== undefined);
  assert.equal(output.path, "src/app/components/LikeButton.tsx");
  assert.equal(output.kind, "client-component-adapter");
  assert(typeof output.content === "string");
  assert.equal(output.content.split(/\r?\n/)[0], '"use client";');
  assert.equal(output.content.split('"use client";').length - 1, 1);
  assert.equal(
    output.content,
    '"use client";\n\n' +
      "// Generated by NextJsHx from fixture.LikeButton.render.\n\n" +
      'import { LikeButton } from "../../../src-gen/fixture/LikeButton";\n' +
      'import type { ComponentType } from "react";\n\n' +
      "const NextJsHxDefault: ComponentType<Parameters<typeof LikeButton.render>[0]> = LikeButton.render;\n" +
      "export default NextJsHxDefault;\n",
  );
});

test("rejects weakened Client Component directives, imports, signatures, and config", () => {
  const clientIntent = (value: Record<string, unknown>) => {
    const [intent] = value.intents as Array<Record<string, unknown>>;
    assert(intent !== undefined);
    return intent;
  };

  const missingDirective = clientComponentPlanValue();
  clientIntent(missingDirective).directives = [];
  assert.equal(
    expectCliDiagnostic(
      () => renderAdapterPlan("src/app", parseAdapterPlan(missingDirective)),
      "NXHX-CLI-RENDER-0005",
    ).diagnostic.subject,
    "directives",
  );

  const wrongImport = clientComponentPlanValue();
  const imports = clientIntent(wrongImport).imports as Array<Record<string, unknown>>;
  assert(imports[1] !== undefined);
  imports[1].symbol = "JSX";
  assert.equal(
    expectCliDiagnostic(
      () => renderAdapterPlan("src/app", parseAdapterPlan(wrongImport)),
      "NXHX-CLI-RENDER-0005",
    ).diagnostic.subject,
    "imports",
  );

  const weakSignature = clientComponentPlanValue();
  const exports = clientIntent(weakSignature).exports as Array<Record<string, unknown>>;
  assert(exports[0] !== undefined);
  exports[0].signature = "ComponentType<{ label: string }>";
  assert.equal(
    expectCliDiagnostic(
      () => renderAdapterPlan("src/app", parseAdapterPlan(weakSignature)),
      "NXHX-CLI-RENDER-0005",
    ).diagnostic.subject,
    "exports",
  );

  const extraConfig = clientComponentPlanValue();
  clientIntent(extraConfig).config = [
    { name: "runtime", value: { kind: "string", value: "nodejs" } },
  ];
  assert.equal(
    expectCliDiagnostic(
      () => renderAdapterPlan("src/app", parseAdapterPlan(extraConfig)),
      "NXHX-CLI-RENDER-0005",
    ).diagnostic.subject,
    "config",
  );
});

test("renders a directive-first, zero-wrapper React Hook export", () => {
  const [output] = renderAdapterPlan(
    "src/app",
    parseAdapterPlan(reactHookPlanValue()),
  );
  assert(output !== undefined);
  assert.equal(
    output.path,
    "src/app/_nextjshx/hook/0123456789ab/useSelection.ts",
  );
  assert.equal(output.kind, "react-hook-adapter");
  assert.equal(
    output.content,
    '"use client";\n\n' +
      "// Generated by NextJsHx from fixture.SelectionHooks.useSelection.\n\n" +
      'import { SelectionHooks } from "../../../../src-gen/fixture/SelectionHooks";\n\n' +
      "export const useSelection: typeof SelectionHooks.useSelection = SelectionHooks.useSelection;\n",
  );
  assert.equal(output.content.split(/\r?\n/)[0], '"use client";');
  assert(!output.content.includes("function useSelection"));
  assert(!/\b(?:any|unknown)\b|\sas\s/.test(output.content));
});

test("rejects weakened React Hook directives, paths, imports, signatures, and config", () => {
  const hookIntent = (value: Record<string, unknown>) => {
    const [intent] = value.intents as Array<Record<string, unknown>>;
    assert(intent !== undefined);
    return intent;
  };

  const missingDirective = reactHookPlanValue();
  hookIntent(missingDirective).directives = [];
  assert.equal(
    expectCliDiagnostic(
      () => renderAdapterPlan("src/app", parseAdapterPlan(missingDirective)),
      "NXHX-CLI-RENDER-0005",
    ).diagnostic.subject,
    "directives",
  );

  const wrongPath = reactHookPlanValue();
  hookIntent(wrongPath).targetPath =
    "_nextjshx/hook/0123456789ab/useSelection.tsx";
  assert.equal(
    expectCliDiagnostic(
      () => renderAdapterPlan("src/app", parseAdapterPlan(wrongPath)),
      "NXHX-CLI-RENDER-0005",
    ).diagnostic.subject,
    "targetPath",
  );

  const extraImport = reactHookPlanValue();
  (hookIntent(extraImport).imports as Array<Record<string, unknown>>).push({
    modulePath: "react",
    symbol: "useState",
    alias: null,
    typeOnly: false,
  });
  assert.equal(
    expectCliDiagnostic(
      () => renderAdapterPlan("src/app", parseAdapterPlan(extraImport)),
      "NXHX-CLI-RENDER-0005",
    ).diagnostic.subject,
    "imports",
  );

  const weakSignature = reactHookPlanValue();
  const exports = hookIntent(weakSignature).exports as Array<Record<string, unknown>>;
  assert(exports[0] !== undefined);
  exports[0].signature = "() => number";
  assert.equal(
    expectCliDiagnostic(
      () => renderAdapterPlan("src/app", parseAdapterPlan(weakSignature)),
      "NXHX-CLI-RENDER-0005",
    ).diagnostic.subject,
    "exports",
  );

  const extraConfig = reactHookPlanValue();
  hookIntent(extraConfig).config = [
    { name: "runtime", value: { kind: "string", value: "nodejs" } },
  ];
  assert.equal(
    expectCliDiagnostic(
      () => renderAdapterPlan("src/app", parseAdapterPlan(extraConfig)),
      "NXHX-CLI-RENDER-0005",
    ).diagnostic.subject,
    "config",
  );
});

test("renders a typed root MDX component registry for both supported app roots", () => {
  const plan = parseAdapterPlan(mdxComponentsPlanValue());
  const [rootOutput] = renderAdapterPlan("app", plan);
  const [srcOutput] = renderAdapterPlan("src/app", plan);
  assert(rootOutput !== undefined);
  assert(srcOutput !== undefined);
  assert.equal(rootOutput.path, "mdx-components.tsx");
  assert.equal(srcOutput.path, "src/mdx-components.tsx");
  assert.equal(rootOutput.kind, "mdx-components-adapter");
  assert.equal(
    rootOutput.content,
    "// Generated by NextJsHx from fixture.AtlasMdxComponents.components.\n\n" +
      'import { AtlasMdxComponents as NextJsHxMdxRegistry } from "./src-gen/fixture/AtlasMdxComponents";\n' +
      "\n" +
      "export const useMDXComponents: typeof NextJsHxMdxRegistry.components = NextJsHxMdxRegistry.components;\n",
  );
  assert.equal(srcOutput.content, rootOutput.content);
  assert(!/\b(?:any|unknown)\b/.test(rootOutput.content));
  assert(!rootOutput.content.includes(" as const"));
  assert(!rootOutput.content.includes("function useMDXComponents"));
});

test("rejects weakened MDX roots, paths, directives, imports, exports, and config", () => {
  const mdxIntent = (value: Record<string, unknown>) => {
    const [intent] = value.intents as Array<Record<string, unknown>>;
    assert(intent !== undefined);
    return intent;
  };

  assert.equal(
    expectCliDiagnostic(
      () =>
        renderAdapterPlan(
          "frontend/app",
          parseAdapterPlan(mdxComponentsPlanValue()),
        ),
      "NXHX-CLI-RENDER-0005",
    ).diagnostic.subject,
    "appRoot",
  );

  const wrongPath = mdxComponentsPlanValue();
  mdxIntent(wrongPath).targetPath = "content/mdx-components.tsx";
  assert.equal(
    expectCliDiagnostic(
      () => renderAdapterPlan("app", parseAdapterPlan(wrongPath)),
      "NXHX-CLI-RENDER-0005",
    ).diagnostic.subject,
    "targetPath",
  );

  const directive = mdxComponentsPlanValue();
  mdxIntent(directive).directives = ["use client"];
  assert.equal(
    expectCliDiagnostic(
      () => renderAdapterPlan("app", parseAdapterPlan(directive)),
      "NXHX-CLI-RENDER-0005",
    ).diagnostic.subject,
    "directives",
  );

  const extraImport = mdxComponentsPlanValue();
  (mdxIntent(extraImport).imports as Array<Record<string, unknown>>).push({
    modulePath: "react",
    symbol: "ComponentType",
    alias: null,
    typeOnly: true,
  });
  assert.equal(
    expectCliDiagnostic(
      () => renderAdapterPlan("app", parseAdapterPlan(extraImport)),
      "NXHX-CLI-RENDER-0005",
    ).diagnostic.subject,
    "imports",
  );

  const weakExport = mdxComponentsPlanValue();
  const exports = mdxIntent(weakExport).exports as Array<Record<string, unknown>>;
  assert(exports[0] !== undefined);
  exports[0].signature = "() => Record<string, unknown>";
  assert.equal(
    expectCliDiagnostic(
      () => renderAdapterPlan("app", parseAdapterPlan(weakExport)),
      "NXHX-CLI-RENDER-0005",
    ).diagnostic.subject,
    "exports",
  );

  const extraConfig = mdxComponentsPlanValue();
  mdxIntent(extraConfig).config = [
    { name: "runtime", value: { kind: "string", value: "nodejs" } },
  ];
  assert.equal(
    expectCliDiagnostic(
      () => renderAdapterPlan("app", parseAdapterPlan(extraConfig)),
      "NXHX-CLI-RENDER-0005",
    ).diagnostic.subject,
    "config",
  );
});

test("renders precise directive-first native Server Function wrappers", () => {
  const [output] = renderAdapterPlan(
    "src/app",
    parseAdapterPlan(serverFunctionPlanValue()),
  );
  assert(output !== undefined);
  assert.equal(output.path, "src/app/todos/actions.ts");
  assert.equal(output.kind, "server-function-adapter");
  assert(typeof output.content === "string");
  assert.equal(output.content.split(/\r?\n/)[0], '"use server";');
  assert.equal(output.content.split('"use server";').length - 1, 1);
  assert.equal(
    output.content,
    '"use server";\n\n' +
      "// Generated by NextJsHx from fixture.TodoActions.createTodo.\n\n" +
      'import { TodoActions } from "../../../src-gen/fixture/TodoActions";\n\n' +
      "export async function createTodo(...args: Parameters<typeof TodoActions.createTodo>): Promise<Awaited<ReturnType<typeof TodoActions.createTodo>>> {\n" +
      "  return TodoActions.createTodo(...args);\n" +
      "}\n" +
      "export async function toggleTodo(...args: Parameters<typeof TodoActions.toggleTodo>): Promise<Awaited<ReturnType<typeof TodoActions.toggleTodo>>> {\n" +
      "  return TodoActions.toggleTodo(...args);\n" +
      "}\n",
  );
  assert(!/\b(?:any|unknown)\b/.test(output.content));
});

test("renders cache directives inside precise async function wrappers", () => {
  for (const directive of [
    "use cache",
    "use cache: private",
    "use cache: remote",
  ]) {
    const [output] = renderAdapterPlan(
      "src/app",
      parseAdapterPlan(cacheFunctionPlanValue(directive)),
    );
    assert(output !== undefined);
    assert.equal(output.path, "src/app/_nextjshx/cache/catalog/data.ts");
    assert.equal(output.kind, "cache-function-adapter");
    assert.equal(
      output.content,
      "// Generated by NextJsHx from fixture.CachedCatalog.lookup.\n\n" +
        'import { CachedCatalog } from "../../../../src-gen/fixture/CachedCatalog";\n\n' +
        "export async function lookup(...args: Parameters<typeof CachedCatalog.lookup>): Promise<Awaited<ReturnType<typeof CachedCatalog.lookup>>> {\n" +
        `  ${JSON.stringify(directive)};\n` +
        "  return CachedCatalog.lookup(...args);\n" +
        "}\n",
    );
    assert.equal(output.content.split(JSON.stringify(directive)).length - 1, 1);
    assert(output.content.indexOf(JSON.stringify(directive)) > output.content.indexOf("export async function"));
    assert(!/\b(?:any|unknown)\b/.test(output.content));
  }
});

test("renders a module-level cache directive before an async page wrapper", () => {
  const value = planValue(
    '(props: PageProps<"/todos/[id]">) => Promise<JSX.Element>',
  );
  const intent = (value.intents as Array<Record<string, unknown>>)[0];
  assert(intent !== undefined);
  intent.directives = ["use cache"];

  const [output] = renderAdapterPlan("src/app", parseAdapterPlan(value));
  assert(output !== undefined);
  assert.equal(typeof output.content, "string");
  if (typeof output.content !== "string") {
    assert.fail("cached page adapter renderer returned binary metadata output");
  }
  assert.equal(output.content.split(/\r?\n/)[0], '"use cache";');
  assert(output.content.includes("export default async function NextJsHxDefault("));
  assert(output.content.indexOf('"use cache";') < output.content.indexOf("import "));
});

test("rejects weakened cached-function directives, paths, signatures, and versions", () => {
  for (const directive of ["use server", "use cache: surprise"]) {
    expectCliDiagnostic(
      () =>
        renderAdapterPlan(
          "app",
          parseAdapterPlan(cacheFunctionPlanValue(directive)),
        ),
      "NXHX-CLI-RENDER-0005",
    );
  }

  const wrongPath = cacheFunctionPlanValue();
  const wrongPathIntent = (wrongPath.intents as Array<Record<string, unknown>>)[0];
  assert(wrongPathIntent !== undefined);
  wrongPathIntent.segmentPath = "catalog";
  wrongPathIntent.targetPath = "catalog/data.ts";
  expectCliDiagnostic(
    () => renderAdapterPlan("app", parseAdapterPlan(wrongPath)),
    "NXHX-CLI-RENDER-0005",
  );

  const weak = cacheFunctionPlanValue();
  const weakIntent = (weak.intents as Array<Record<string, unknown>>)[0];
  assert(weakIntent !== undefined);
  const weakExport = (weakIntent.exports as Array<Record<string, unknown>>)[0];
  assert(weakExport !== undefined);
  weakExport.signature = "(key: string) => Promise<string>";
  expectCliDiagnostic(
    () => renderAdapterPlan("app", parseAdapterPlan(weak)),
    "NXHX-CLI-RENDER-0005",
  );

  const future = cacheFunctionPlanValue();
  (future.toolchain as Record<string, unknown>).next = "16.3.0";
  expectCliDiagnostic(
    () => renderAdapterPlan("app", parseAdapterPlan(future)),
    "NXHX-CLI-RENDER-0005",
  );
});

test("rejects weakened Server Function directives, imports, signatures, exports, and config", () => {
  const serverIntent = (value: Record<string, unknown>) => {
    const [intent] = value.intents as Array<Record<string, unknown>>;
    assert(intent !== undefined);
    return intent;
  };

  const missingDirective = serverFunctionPlanValue();
  serverIntent(missingDirective).directives = [];
  assert.equal(
    expectCliDiagnostic(
      () => renderAdapterPlan("src/app", parseAdapterPlan(missingDirective)),
      "NXHX-CLI-RENDER-0005",
    ).diagnostic.subject,
    "directives",
  );

  const wrongImport = serverFunctionPlanValue();
  const imports = serverIntent(wrongImport).imports as Array<Record<string, unknown>>;
  assert(imports[0] !== undefined);
  imports[0].typeOnly = true;
  assert.equal(
    expectCliDiagnostic(
      () => renderAdapterPlan("src/app", parseAdapterPlan(wrongImport)),
      "NXHX-CLI-RENDER-0005",
    ).diagnostic.subject,
    "implementation",
  );

  const weakSignature = serverFunctionPlanValue();
  const exports = serverIntent(weakSignature).exports as Array<Record<string, unknown>>;
  assert(exports[0] !== undefined);
  exports[0].signature = "(...args: string[]) => Promise<string>";
  assert.equal(
    expectCliDiagnostic(
      () => renderAdapterPlan("src/app", parseAdapterPlan(weakSignature)),
      "NXHX-CLI-RENDER-0005",
    ).diagnostic.subject,
    "exports",
  );

  const renamedExport = serverFunctionPlanValue();
  const renamed = serverIntent(renamedExport).exports as Array<Record<string, unknown>>;
  assert(renamed[0] !== undefined);
  renamed[0].name = "create";
  assert.equal(
    expectCliDiagnostic(
      () => renderAdapterPlan("src/app", parseAdapterPlan(renamedExport)),
      "NXHX-CLI-RENDER-0005",
    ).diagnostic.subject,
    "exports",
  );

  const extraConfig = serverFunctionPlanValue();
  serverIntent(extraConfig).config = [
    { name: "runtime", value: { kind: "string", value: "nodejs" } },
  ];
  assert.equal(
    expectCliDiagnostic(
      () => renderAdapterPlan("src/app", parseAdapterPlan(extraConfig)),
      "NXHX-CLI-RENDER-0005",
    ).diagnostic.subject,
    "config",
  );
});

test("rejects weakened special-file directives, signatures, exports, and config", () => {
  const errorValue = () => {
    const value = planValue();
    const intent = (value.intents as Array<Record<string, unknown>>)[0];
    assert(intent !== undefined);
    intent.kind = "error";
    intent.targetPath = "todos/[id]/error.tsx";
    intent.directives = ["use client"];
    intent.exports = [
      {
        kind: "default",
        name: "default",
        sourceField: "render",
        signature:
          "(props: { error: Error & { digest?: string }; reset: () => void }) => JSX.Element",
      },
    ];
    intent.config = [];
    return { value, intent };
  };

  const missingDirective = errorValue();
  missingDirective.intent.directives = [];
  assert.equal(
    expectCliDiagnostic(
      () => renderAdapterPlan("src/app", parseAdapterPlan(missingDirective.value)),
      "NXHX-CLI-RENDER-0005",
    ).diagnostic.subject,
    "directives",
  );

  const weakSignature = errorValue();
  const weakExport = (weakSignature.intent.exports as Array<Record<string, unknown>>)[0];
  assert(weakExport !== undefined);
  weakExport.signature = "(props: { error: Error; reset: () => void }) => null";
  assert.equal(
    expectCliDiagnostic(
      () => renderAdapterPlan("src/app", parseAdapterPlan(weakSignature.value)),
      "NXHX-CLI-RENDER-0005",
    ).diagnostic.subject,
    "default.signature",
  );

  const namedExport = errorValue();
  const named = (namedExport.intent.exports as Array<Record<string, unknown>>)[0];
  assert(named !== undefined);
  named.kind = "named";
  named.name = "ErrorBoundary";
  assert.equal(
    expectCliDiagnostic(
      () => renderAdapterPlan("src/app", parseAdapterPlan(namedExport.value)),
      "NXHX-CLI-RENDER-0005",
    ).diagnostic.subject,
    "exports",
  );

  const extraConfig = errorValue();
  extraConfig.intent.config = [
    { name: "runtime", value: { kind: "string", value: "nodejs" } },
  ];
  assert.equal(
    expectCliDiagnostic(
      () => renderAdapterPlan("src/app", parseAdapterPlan(extraConfig.value)),
      "NXHX-CLI-RENDER-0005",
    ).diagnostic.subject,
    "config",
  );
});

test("renders a typed parallel-slot default and rejects non-slot placement", () => {
  const defaultValue = () => {
    const value = planValue();
    const intent = (value.intents as Array<Record<string, unknown>>)[0];
    assert(intent !== undefined);
    intent.kind = "default";
    intent.segmentPath = "proof/[id]/@sidebar";
    intent.targetPath = "proof/[id]/@sidebar/default.tsx";
    intent.directives = [];
    intent.exports = [
      {
        kind: "default",
        name: "default",
        sourceField: "render",
        signature:
          '(props: Pick<LayoutProps<"/proof/[id]">, "params">) => Promise<JSX.Element>',
      },
    ];
    intent.config = [];
    return { value, intent };
  };

  const valid = defaultValue();
  const [output] = renderAdapterPlan("src/app", parseAdapterPlan(valid.value));
  assert(output !== undefined);
  assert.equal(output.path, "src/app/proof/[id]/@sidebar/default.tsx");
  assert.match(
    String(output.content),
    /Pick<LayoutProps<"\/proof\/\[id\]">, "params">/,
  );
  assert.doesNotMatch(String(output.content), /@sidebar.*LayoutProps/);

  const outsideSlot = defaultValue();
  outsideSlot.intent.segmentPath = "proof/[id]/fallback";
  outsideSlot.intent.targetPath = "proof/[id]/fallback/default.tsx";
  assert.equal(
    expectCliDiagnostic(
      () => renderAdapterPlan("src/app", parseAdapterPlan(outsideSlot.value)),
      "NXHX-CLI-RENDER-0005",
    ).diagnostic.subject,
    "segmentPath",
  );
});

test("rejects unknown keys, unsafe paths, and non-canonical collection order", () => {
  const unknown = planValue();
  unknown.unreviewed = true;
  expectCliDiagnostic(() => parseAdapterPlan(unknown), "NXHX-CLI-PLAN-0004");

  const traversal = planValue();
  const traversalIntent = (traversal.intents as Array<Record<string, unknown>>)[0];
  assert(traversalIntent !== undefined);
  traversalIntent.targetPath = "todos/../page.tsx";
  expectCliDiagnostic(() => parseAdapterPlan(traversal), "NXHX-CLI-PLAN-0004");

  const nonCanonical = planValue();
  const intent = (nonCanonical.intents as Array<Record<string, unknown>>)[0];
  assert(intent !== undefined);
  intent.imports = [
    {
      modulePath: "react",
      symbol: "ReactNode",
      alias: null,
      typeOnly: true,
    },
    ...intent.imports as Array<unknown>,
  ];
  expectCliDiagnostic(() => parseAdapterPlan(nonCanonical), "NXHX-CLI-PLAN-0004");
});

test("rejects TypeScript signature injection and deliberately broad types", () => {
  for (const signature of [
    "number; process.exit(1)",
    "(value: any) => null",
    "(value: unknown) => null",
  ]) {
    const plan = parseAdapterPlan(planValue(signature));
    const error = expectCliDiagnostic(
      () => renderAdapterPlan("src/app", plan),
      "NXHX-CLI-RENDER-0005",
    );
    assert.equal(error.diagnostic.subject, "default.signature");
  }
});

test("rejects import/declaration collisions and unreviewed module directives", () => {
  const collision = planValue();
  const collisionIntent = (collision.intents as Array<Record<string, unknown>>)[0];
  assert(collisionIntent !== undefined);
  collisionIntent.imports = [
    {
      modulePath: "../../../../src-gen/fixture/TodoPage",
      symbol: "TodoPage",
      alias: "NextJsHxDefault",
      typeOnly: false,
    },
  ];
  const implementation = collisionIntent.implementation as Record<string, unknown>;
  implementation.symbol = "TodoPage";
  expectCliDiagnostic(
    () => renderAdapterPlan("src/app", parseAdapterPlan(collision)),
    "NXHX-CLI-RENDER-0005",
  );

  const directive = planValue();
  const directiveIntent = (directive.intents as Array<Record<string, unknown>>)[0];
  assert(directiveIntent !== undefined);
  directiveIntent.directives = ["use surprising-runtime"];
  expectCliDiagnostic(
    () => renderAdapterPlan("src/app", parseAdapterPlan(directive)),
    "NXHX-CLI-RENDER-0005",
  );
});

test("rejects a route kind whose target is not its exact Next convention file", () => {
  const mismatched = planValue();
  const intent = (mismatched.intents as Array<Record<string, unknown>>)[0];
  assert(intent !== undefined);
  intent.targetPath = "todos/[id]/custom.tsx";
  expectCliDiagnostic(
    () => renderAdapterPlan("src/app", parseAdapterPlan(mismatched)),
    "NXHX-CLI-RENDER-0005",
  );
});

test("rejects duplicate portable targets even when the source declarations differ", () => {
  const duplicate = planValue();
  const intents = duplicate.intents as Array<Record<string, unknown>>;
  const first = structuredClone(intents[0]) as Record<string, unknown>;
  const source = first.source as Record<string, unknown>;
  source.typeName = "fixture.OtherPage";
  intents.push(first);
  expectCliDiagnostic(
    () => parseAdapterPlan(duplicate) as AdapterPlan,
    "NXHX-CLI-PLAN-0004",
  );
});

test("opens plan input without following a symbolic link", () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "nextjshx-plan-read-"));
  try {
    const target = path.join(root, "target.json");
    const link = path.join(root, "plan.json");
    writeFileSync(target, `${JSON.stringify(planValue())}\n`, "utf8");
    symlinkSync(target, link);
    expectCliDiagnostic(() => readAdapterPlan(link), "NXHX-CLI-PLAN-0004");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
