import path from "node:path";

import ts from "typescript";

import type {
  AdapterConfigValue,
  AdapterExport,
  AdapterIntent,
  AdapterPlan,
} from "./adapter-plan.js";
import { cliFailure } from "./cli-diagnostic.js";
import type { PlannedGeneratedOutput } from "./ownership-preflight.js";
import { routeShape } from "./route-topology.js";

const CACHE_DIRECTIVES = new Set([
  "use cache",
  "use cache: private",
  "use cache: remote",
]);

function cacheDirective(intent: AdapterIntent): string | null {
  return intent.directives.length === 1 &&
      CACHE_DIRECTIVES.has(intent.directives[0] as string)
    ? (intent.directives[0] as string)
    : null;
}

function renderFailure(
  intent: AdapterIntent,
  subject: string,
  expected: string,
  actual: string,
): never {
  cliFailure(
    "NXHX-CLI-RENDER-0005",
    `Cannot safely render the ${intent.kind} adapter requested by ${intent.source.typeName}.${intent.source.fieldName}.`,
    subject,
    expected,
    actual,
    `Fix the Haxe declaration at ${intent.source.metadataPosition.file}:` +
      `${intent.source.metadataPosition.startLine}:${intent.source.metadataPosition.startCharacter} and regenerate the closed adapter plan.`,
  );
}

function safeSignature(intent: AdapterIntent, exported: AdapterExport): string {
  const wrapper = `type __NextJsHxSignature = ${exported.signature};\n`;
  const transpiled = ts.transpileModule(wrapper, {
    fileName: "nextjshx-signature.ts",
    reportDiagnostics: true,
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ESNext,
    },
  });
  const error = (transpiled.diagnostics ?? []).find(
    (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error,
  );
  if (error !== undefined) {
    renderFailure(
      intent,
      `${exported.name}.signature`,
      "one syntactically valid TypeScript type",
      `TS${error.code}: ${ts.flattenDiagnosticMessageText(error.messageText, " ")}`,
    );
  }
  const source = ts.createSourceFile(
    "nextjshx-signature.ts",
    wrapper,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const statement = source.statements[0];
  if (
    source.statements.length !== 1 ||
    statement === undefined ||
    !ts.isTypeAliasDeclaration(statement)
  ) {
    renderFailure(
      intent,
      `${exported.name}.signature`,
      "exactly one TypeScript type with no declarations or statements",
      exported.signature,
    );
  }
  const alias = statement;
  let forbidden: ts.SyntaxKind | null = null;
  const inspect = (node: ts.Node): void => {
    if (
      node.kind === ts.SyntaxKind.AnyKeyword ||
      node.kind === ts.SyntaxKind.UnknownKeyword
    ) {
      forbidden = node.kind;
      return;
    }
    ts.forEachChild(node, inspect);
  };
  inspect(alias.type);
  if (forbidden !== null) {
    renderFailure(
      intent,
      `${exported.name}.signature`,
      "a precise type without any or broad unknown",
      ts.SyntaxKind[forbidden] ?? `syntax kind ${forbidden}`,
    );
  }
  return ts
    .createPrinter({ newLine: ts.NewLineKind.LineFeed })
    .printNode(ts.EmitHint.Unspecified, alias.type, source);
}

function configLiteral(value: AdapterConfigValue): string {
  switch (value.kind) {
    case "string":
    case "integer":
    case "boolean":
      return JSON.stringify(value.value);
    case "string-array":
      return JSON.stringify(value.value);
  }
}

export function proxyOutputPathForAppRoot(
  appRootRelative: string,
): string | null {
  return appRootRelative === "app"
    ? "proxy.ts"
    : appRootRelative === "src/app"
      ? "src/proxy.ts"
      : null;
}

export function mdxComponentsOutputPathForAppRoot(
  appRootRelative: string,
): string | null {
  return appRootRelative === "app"
    ? "mdx-components.tsx"
    : appRootRelative === "src/app"
      ? "src/mdx-components.tsx"
      : null;
}

interface ProxyRendering {
  readonly proxyType: string;
  readonly configType: string | null;
  readonly matcher: AdapterConfigValue | null;
}

export interface AdapterRenderOptions {
  readonly implementationDigests?: ReadonlyMap<string, string>;
}

function importedLocal(
  intent: AdapterIntent,
  modulePath: string,
  symbol: string,
  typeOnly: boolean,
): string {
  const matches = intent.imports.filter(
    (entry) =>
      entry.modulePath === modulePath &&
      entry.symbol === symbol &&
      entry.typeOnly === typeOnly,
  );
  if (matches.length !== 1) {
    renderFailure(
      intent,
      "imports",
      `exactly one ${typeOnly ? "type-only " : ""}${symbol} import from ${modulePath}`,
      `${matches.length} matching imports`,
    );
  }
  const imported = matches[0];
  if (imported === undefined) {
    renderFailure(intent, "imports", `one ${symbol} import`, "none");
  }
  return imported.alias ?? imported.symbol;
}

function validateProxyImportSet(intent: AdapterIntent, hasConfig: boolean): void {
  const permitted = intent.imports.filter(
    (entry) =>
      (!entry.typeOnly &&
        entry.modulePath === intent.implementation.modulePath &&
        entry.symbol === intent.implementation.symbol) ||
      (entry.typeOnly &&
        entry.modulePath === "next/server" &&
        (entry.symbol === "NextProxy" ||
          (hasConfig && entry.symbol === "ProxyConfig"))),
  );
  const expected = hasConfig ? 3 : 2;
  if (intent.imports.length !== expected || permitted.length !== expected) {
    renderFailure(
      intent,
      "imports",
      "only the implementation value, NextProxy type, and optional ProxyConfig type imports",
      intent.imports
        .map(
          (entry) =>
            `${entry.typeOnly ? "type " : "value "}${entry.symbol} from ${entry.modulePath}`,
        )
        .join(", "),
    );
  }
}

function validateMatcherLiteral(intent: AdapterIntent, value: string): void {
  if (
    !value.startsWith("/") ||
    value.length > 512 ||
    value.trim() !== value ||
    /[\u0000-\u001f\u007f]/.test(value)
  ) {
    renderFailure(
      intent,
      "config.matcher",
      "a slash-prefixed compact matcher literal of at most 512 characters",
      JSON.stringify(value),
    );
  }
}

function validateProxyIntent(
  intent: AdapterIntent,
  nextVersion: string,
): ProxyRendering | null {
  if (intent.kind !== "proxy") {
    return null;
  }
  if (nextVersion !== "16.2.12") {
    renderFailure(
      intent,
      "toolchain.next",
      "exactly 16.2.12 for the reviewed proxy.ts contract",
      nextVersion,
    );
  }
  if (intent.segmentPath !== "" || intent.targetPath !== "proxy.ts") {
    renderFailure(
      intent,
      "segmentPath/targetPath",
      "an empty segment path and the framework convention target proxy.ts",
      `${intent.segmentPath || "<empty>"}/${intent.targetPath}`,
    );
  }
  if (intent.directives.length !== 0) {
    renderFailure(
      intent,
      "directives",
      "no module directives for Next's server-owned request proxy",
      intent.directives.join(", "),
    );
  }
  const proxyType = importedLocal(intent, "next/server", "NextProxy", true);
  const [exported] = intent.exports;
  if (
    intent.exports.length !== 1 ||
    exported === undefined ||
    exported.kind !== "named" ||
    exported.name !== "proxy" ||
    exported.sourceField !== "proxy" ||
    exported.signature !== proxyType
  ) {
    renderFailure(
      intent,
      "exports",
      `one named proxy export delegated to source field proxy with signature ${proxyType}`,
      intent.exports
        .map(
          (entry) =>
            `${entry.kind}:${entry.name}:${entry.sourceField}:${entry.signature}`,
        )
        .join(", ") || "none",
    );
  }
  if (intent.config.length === 0) {
    if (
      intent.imports.some(
        (entry) =>
          entry.modulePath === "next/server" && entry.symbol === "ProxyConfig",
      )
    ) {
      renderFailure(
        intent,
        "imports",
        "no ProxyConfig import when matcher config is absent",
        "ProxyConfig import",
      );
    }
    validateProxyImportSet(intent, false);
    return Object.freeze({ proxyType, configType: null, matcher: null });
  }
  const [config] = intent.config;
  if (
    intent.config.length !== 1 ||
    config === undefined ||
    config.name !== "matcher" ||
    (config.value.kind !== "string" && config.value.kind !== "string-array")
  ) {
    renderFailure(
      intent,
      "config",
      "zero config entries or one matcher string/string-array entry",
      JSON.stringify(intent.config),
    );
  }
  const matcher = config.value;
  const values = matcher.kind === "string" ? [matcher.value] : [...matcher.value];
  if (values.length === 0 || values.length > 256) {
    renderFailure(
      intent,
      "config.matcher",
      "between one and 256 matcher literals",
      `${values.length} literals`,
    );
  }
  for (const value of values) {
    validateMatcherLiteral(intent, value);
  }
  for (let index = 1; index < values.length; index += 1) {
    const previous = values[index - 1] as string;
    const current = values[index] as string;
    if (Buffer.from(previous).compare(Buffer.from(current)) >= 0) {
      renderFailure(
        intent,
        "config.matcher",
        "unique matcher literals in canonical bytewise order",
        current,
      );
    }
  }
  const configType = importedLocal(
    intent,
    "next/server",
    "ProxyConfig",
    true,
  );
  validateProxyImportSet(intent, true);
  return Object.freeze({ proxyType, configType, matcher });
}

function publicRoute(intent: AdapterIntent): string {
  return routeShape(
    intent.segmentPath,
    `${intent.source.typeName}.${intent.source.fieldName}`,
  ).publicPattern;
}

function validatePageLayoutIntent(intent: AdapterIntent, nextVersion: string): void {
  if (intent.kind !== "page" && intent.kind !== "layout") {
    return;
  }
  const cache = cacheDirective(intent);
  if (intent.directives.length !== 0 && cache === null) {
    renderFailure(
      intent,
      "directives",
      "no directive or exactly one reviewed cache directive for a server-owned page or layout",
      intent.directives.join(", "),
    );
  }
  if (cache !== null && nextVersion !== "16.2.12") {
    renderFailure(
      intent,
      "toolchain.next",
      "exactly 16.2.12 for the reviewed Cache Components directive contract",
      nextVersion,
    );
  }

  const route = publicRoute(intent);
  const props = intent.kind === "page" ? "PageProps" : "LayoutProps";
  const metadataProps =
    intent.kind === "page"
      ? `PageProps<${JSON.stringify(route)}>`
      : `Pick<LayoutProps<${JSON.stringify(route)}>, "params">`;
  const paramsType =
    `Array<Awaited<${props}<${JSON.stringify(route)}>["params"]>>`;
  const allowedNamed = new Set(["metadata", "generateMetadata", "generateStaticParams"]);
  const defaultExports = intent.exports.filter((exported) => exported.kind === "default");
  const defaultExport = defaultExports[0];
  const defaultSignatures = [
    `(props: ${props}<${JSON.stringify(route)}>) => JSX.Element`,
    `(props: ${props}<${JSON.stringify(route)}>) => Promise<JSX.Element>`,
  ];
  if (
    defaultExports.length !== 1 ||
    defaultExport === undefined ||
    defaultExport.name !== "default" ||
    defaultExport.sourceField !== "render" ||
    !defaultSignatures.includes(defaultExport.signature)
  ) {
    renderFailure(
      intent,
      "default.signature",
      `one default render export with ${defaultSignatures.join(" or ")}`,
      defaultExport === undefined
        ? "missing"
        : `${defaultExport.name}:${defaultExport.sourceField}:${defaultExport.signature}`,
    );
  }
  for (const exported of intent.exports) {
    if (exported.kind === "default") {
      if (cache !== null && !exported.signature.includes(") => Promise<JSX.Element>")) {
        renderFailure(
          intent,
          "default.signature",
          "an async page/layout export when a file-level cache directive is present",
          exported.signature,
        );
      }
      continue;
    }
    if (!allowedNamed.has(exported.name)) {
      renderFailure(
        intent,
        "exports",
        "only metadata, generateMetadata, or generateStaticParams named exports",
        exported.name,
      );
    }
    const expected =
      exported.name === "metadata"
        ? ["Metadata"]
        : exported.name === "generateMetadata"
          ? [
              `(props: ${metadataProps}, parent: ResolvingMetadata) => Metadata`,
              `(props: ${metadataProps}, parent: ResolvingMetadata) => Promise<Metadata>`,
            ]
          : [`() => ${paramsType}`, `() => Promise<${paramsType}>`];
    if (exported.sourceField !== exported.name || !expected.includes(exported.signature)) {
      renderFailure(
        intent,
        `${exported.name}.signature`,
        `${expected.join(" or ")} delegated to source field ${exported.name}`,
        `${exported.sourceField}:${exported.signature}`,
      );
    }
    if (
      cache !== null &&
      exported.name !== "metadata" &&
      !exported.signature.includes("=> Promise<")
    ) {
      renderFailure(
        intent,
        `${exported.name}.signature`,
        "an async function export under the file-level cache directive",
        exported.signature,
      );
    }
  }
  const named = new Set(intent.exports.map((entry) => entry.name));
  if (named.has("metadata") && named.has("generateMetadata")) {
    renderFailure(
      intent,
      "exports",
      "metadata or generateMetadata, never both",
      "metadata and generateMetadata",
    );
  }

  if (intent.config.length > 0 && nextVersion !== "16.2.12") {
    renderFailure(
      intent,
      "toolchain.next",
      "exactly 16.2.12 for the reviewed stable segment-config contract",
      nextVersion,
    );
  }
  for (const config of intent.config) {
    if (named.has(config.name)) {
      renderFailure(
        intent,
        "exports/config",
        "segment config represented only as validated literal config",
        config.name,
      );
    }
    switch (config.name) {
      case "runtime":
        if (
          config.value.kind !== "string" ||
          (config.value.value !== "nodejs" && config.value.value !== "edge")
        ) {
          renderFailure(
            intent,
            "config.runtime",
            'the stable literal "nodejs" or "edge"',
            JSON.stringify(config.value),
          );
        }
        break;
      case "preferredRegion":
        {
          const regions =
            config.value.kind === "string"
              ? [config.value.value]
              : config.value.kind === "string-array"
                ? config.value.value
                : null;
          if (
            regions === null ||
            regions.length === 0 ||
            regions.some((region) => region.length > 128) ||
            new Set(regions).size !== regions.length
          ) {
            renderFailure(
              intent,
              "config.preferredRegion",
              "one compact region string of at most 128 characters or a non-empty literal array of unique such strings",
              JSON.stringify(config.value),
            );
          }
        }
        break;
      case "dynamicParams":
        if (config.value.kind !== "boolean") {
          renderFailure(
            intent,
            "config.dynamicParams",
            "a boolean literal",
            JSON.stringify(config.value),
          );
        }
        break;
      case "revalidate":
        if (
          !(
            (config.value.kind === "integer" && config.value.value >= 0) ||
            (config.value.kind === "boolean" && config.value.value === false)
          )
        ) {
          renderFailure(
            intent,
            "config.revalidate",
            "false or a non-negative integer literal",
            JSON.stringify(config.value),
          );
        }
        break;
      case "maxDuration":
        if (config.value.kind !== "integer" || config.value.value <= 0) {
          renderFailure(
            intent,
            "config.maxDuration",
            "a positive integer literal",
            JSON.stringify(config.value),
          );
        }
        break;
      default:
        renderFailure(
          intent,
          "config",
          "only runtime, preferredRegion, dynamicParams, revalidate, or maxDuration",
          config.name,
        );
    }
  }
}

function validateCacheFunctionIntent(
  intent: AdapterIntent,
  implementationLocal: string,
  nextVersion: string,
): void {
  if (intent.kind !== "cache-function") {
    return;
  }
  if (nextVersion !== "16.2.12") {
    renderFailure(
      intent,
      "toolchain.next",
      "exactly 16.2.12 for the reviewed cached-function directive contract",
      nextVersion,
    );
  }
  const directive = cacheDirective(intent);
  if (directive === null) {
    renderFailure(
      intent,
      "directives",
      "exactly one of use cache, use cache: private, or use cache: remote",
      intent.directives.length === 0 ? "none" : intent.directives.join(", "),
    );
  }
  if (
    !intent.targetPath.startsWith("_nextjshx/cache/") ||
    !intent.targetPath.endsWith(".ts") ||
    intent.targetPath.endsWith(".tsx") ||
    intent.segmentPath !== path.posix.dirname(intent.targetPath)
  ) {
    renderFailure(
      intent,
      "segmentPath/targetPath",
      "one .ts file under the private _nextjshx/cache adapter directory",
      `${intent.segmentPath}/${intent.targetPath}`,
    );
  }
  const permittedImports = intent.imports.filter(
    (entry) =>
      !entry.typeOnly &&
      entry.modulePath === intent.implementation.modulePath &&
      entry.symbol === intent.implementation.symbol,
  );
  if (intent.imports.length !== 1 || permittedImports.length !== 1) {
    renderFailure(
      intent,
      "imports",
      "only the cached-function implementation value",
      intent.imports
        .map(
          (entry) =>
            `${entry.typeOnly ? "type " : "value "}${entry.symbol} from ${entry.modulePath}`,
        )
        .join(", "),
    );
  }
  if (intent.exports.length === 0) {
    renderFailure(intent, "exports", "at least one named async cached function", "none");
  }
  for (const exported of intent.exports) {
    const expectedSignature =
      `(...args: Parameters<typeof ${implementationLocal}.${exported.sourceField}>) => ` +
      `Promise<Awaited<ReturnType<typeof ${implementationLocal}.${exported.sourceField}>>>`;
    if (
      exported.kind !== "named" ||
      exported.name !== exported.sourceField ||
      exported.signature !== expectedSignature
    ) {
      renderFailure(
        intent,
        "exports",
        `named same-field cached functions with signature ${expectedSignature}`,
        `${exported.kind}:${exported.name}:${exported.sourceField}:${exported.signature}`,
      );
    }
    safeSignature(intent, exported);
  }
  if (intent.source.fieldName !== intent.exports[0]?.sourceField) {
    renderFailure(
      intent,
      "source.fieldName",
      "the first canonical cached-function source field",
      intent.source.fieldName,
    );
  }
  if (intent.config.length !== 0) {
    renderFailure(
      intent,
      "config",
      "no route config on a cached-function boundary",
      intent.config.map((entry) => entry.name).join(", "),
    );
  }
}

function validateClientComponentIntent(
  intent: AdapterIntent,
  implementationLocal: string,
): void {
  if (intent.kind !== "client-component") {
    return;
  }
  if (
    intent.directives.length !== 1 ||
    intent.directives[0] !== "use client"
  ) {
    renderFailure(
      intent,
      "directives",
      "exactly use client for a generated Client Component boundary",
      intent.directives.length === 0 ? "none" : intent.directives.join(", "),
    );
  }
  if (
    !intent.targetPath.endsWith(".tsx") ||
    intent.targetPath !==
      path.posix.join(
        intent.segmentPath,
        path.posix.basename(intent.targetPath),
      )
  ) {
    renderFailure(
      intent,
      "targetPath",
      "one .tsx component file directly under its declared segment path",
      intent.targetPath,
    );
  }
  const permittedImports = intent.imports.filter(
    (entry) =>
      (!entry.typeOnly &&
        entry.modulePath === intent.implementation.modulePath &&
        entry.symbol === intent.implementation.symbol) ||
      (entry.typeOnly &&
        entry.modulePath === "react" &&
        entry.symbol === "ComponentType" &&
        entry.alias === null),
  );
  if (intent.imports.length !== 2 || permittedImports.length !== 2) {
    renderFailure(
      intent,
      "imports",
      "only the client implementation value and React ComponentType type",
      intent.imports
        .map(
          (entry) =>
            `${entry.typeOnly ? "type " : "value "}${entry.symbol} from ${entry.modulePath}`,
        )
        .join(", "),
    );
  }
  const [exported] = intent.exports;
  const expectedSignature =
    `ComponentType<Parameters<typeof ${implementationLocal}.render>[0]>`;
  if (
    intent.exports.length !== 1 ||
    exported === undefined ||
    exported.kind !== "default" ||
    exported.name !== "default" ||
    exported.sourceField !== "render" ||
    exported.signature !== expectedSignature
  ) {
    renderFailure(
      intent,
      "exports",
      `one default render export with signature ${expectedSignature}`,
      intent.exports
        .map(
          (entry) =>
            `${entry.kind}:${entry.name}:${entry.sourceField}:${entry.signature}`,
        )
        .join(", ") || "none",
    );
  }
  if (intent.config.length !== 0) {
    renderFailure(
      intent,
      "config",
      "no route config on a Client Component boundary",
      intent.config.map((entry) => entry.name).join(", "),
    );
  }
}

function validateReactHookIntent(
  intent: AdapterIntent,
  implementationLocal: string,
): void {
  if (intent.kind !== "react-hook") {
    return;
  }
  if (
    intent.directives.length !== 1 ||
    intent.directives[0] !== "use client"
  ) {
    renderFailure(
      intent,
      "directives",
      "exactly use client for an exported React Hook boundary",
      intent.directives.length === 0 ? "none" : intent.directives.join(", "),
    );
  }
  if (
    !intent.targetPath.endsWith(".ts") ||
    intent.targetPath.endsWith(".tsx") ||
    intent.targetPath !==
      path.posix.join(intent.segmentPath, path.posix.basename(intent.targetPath))
  ) {
    renderFailure(
      intent,
      "targetPath",
      "one .ts Hook module directly under its declared generated segment",
      intent.targetPath,
    );
  }
  const permittedImports = intent.imports.filter(
    (entry) =>
      !entry.typeOnly &&
      entry.modulePath === intent.implementation.modulePath &&
      entry.symbol === intent.implementation.symbol,
  );
  if (intent.imports.length !== 1 || permittedImports.length !== 1) {
    renderFailure(
      intent,
      "imports",
      "only the Haxe Hook implementation value",
      intent.imports
        .map(
          (entry) =>
            `${entry.typeOnly ? "type " : "value "}${entry.symbol} from ${entry.modulePath}`,
        )
        .join(", "),
    );
  }
  const [exported] = intent.exports;
  const expectedSignature =
    exported === undefined
      ? "one named use-prefixed Hook"
      : `typeof ${implementationLocal}.${exported.sourceField}`;
  if (
    intent.exports.length !== 1 ||
    exported === undefined ||
    exported.kind !== "named" ||
    exported.name !== exported.sourceField ||
    !/^use(?:$|[A-Z0-9])/.test(exported.name) ||
    exported.signature !== expectedSignature ||
    intent.source.fieldName !== exported.sourceField
  ) {
    renderFailure(
      intent,
      "exports",
      `one same-name use-prefixed const alias with signature ${expectedSignature}`,
      intent.exports
        .map(
          (entry) =>
            `${entry.kind}:${entry.name}:${entry.sourceField}:${entry.signature}`,
        )
        .join(", ") || "none",
    );
  }
  if (intent.config.length !== 0) {
    renderFailure(
      intent,
      "config",
      "no route config on an exported React Hook boundary",
      intent.config.map((entry) => entry.name).join(", "),
    );
  }
}

function validateServerFunctionIntent(
  intent: AdapterIntent,
  implementationLocal: string,
): void {
  if (intent.kind !== "server-function") {
    return;
  }
  if (
    intent.directives.length !== 1 ||
    intent.directives[0] !== "use server"
  ) {
    renderFailure(
      intent,
      "directives",
      "exactly use server for a generated Server Function boundary",
      intent.directives.length === 0 ? "none" : intent.directives.join(", "),
    );
  }
  if (
    !intent.targetPath.endsWith(".ts") ||
    intent.targetPath.endsWith(".tsx") ||
    intent.targetPath !==
      path.posix.join(
        intent.segmentPath,
        path.posix.basename(intent.targetPath),
      )
  ) {
    renderFailure(
      intent,
      "targetPath",
      "one .ts action file directly under its declared segment path",
      intent.targetPath,
    );
  }
  const permittedImports = intent.imports.filter(
    (entry) =>
      !entry.typeOnly &&
      entry.modulePath === intent.implementation.modulePath &&
      entry.symbol === intent.implementation.symbol,
  );
  if (intent.imports.length !== 1 || permittedImports.length !== 1) {
    renderFailure(
      intent,
      "imports",
      "only the Server Function implementation value",
      intent.imports
        .map(
          (entry) =>
            `${entry.typeOnly ? "type " : "value "}${entry.symbol} from ${entry.modulePath}`,
        )
        .join(", "),
    );
  }
  if (intent.exports.length === 0) {
    renderFailure(intent, "exports", "at least one named async action", "none");
  }
  for (const exported of intent.exports) {
    const expectedSignature =
      `(...args: Parameters<typeof ${implementationLocal}.${exported.sourceField}>) => ` +
      `Promise<Awaited<ReturnType<typeof ${implementationLocal}.${exported.sourceField}>>>`;
    if (
      exported.kind !== "named" ||
      exported.name !== exported.sourceField ||
      exported.signature !== expectedSignature
    ) {
      renderFailure(
        intent,
        "exports",
        `named same-field actions with signature ${expectedSignature}`,
        `${exported.kind}:${exported.name}:${exported.sourceField}:${exported.signature}`,
      );
    }
    safeSignature(intent, exported);
  }
  if (intent.source.fieldName !== intent.exports[0]?.sourceField) {
    renderFailure(
      intent,
      "source.fieldName",
      "the first canonical Server Function source field",
      intent.source.fieldName,
    );
  }
  if (intent.config.length !== 0) {
    renderFailure(
      intent,
      "config",
      "no route config on a Server Function boundary",
      intent.config.map((entry) => entry.name).join(", "),
    );
  }
}

function validateMdxComponentsIntent(
  intent: AdapterIntent,
  implementationLocal: string,
): void {
  if (intent.kind !== "mdx-components") {
    return;
  }
  if (intent.segmentPath !== "" || intent.targetPath !== "mdx-components.tsx") {
    renderFailure(
      intent,
      "targetPath",
      "the root mdx-components.tsx convention with an empty segment",
      `${intent.segmentPath}/${intent.targetPath}`,
    );
  }
  if (intent.directives.length !== 0) {
    renderFailure(
      intent,
      "directives",
      "no module directive for the server-owned MDX component registry",
      intent.directives.join(", "),
    );
  }
  if (intent.config.length !== 0) {
    renderFailure(
      intent,
      "config",
      "no route config on the MDX component registry",
      intent.config.map((entry) => entry.name).join(", "),
    );
  }
  const permittedImports = intent.imports.filter(
    (entry) =>
      !entry.typeOnly &&
      entry.modulePath === intent.implementation.modulePath &&
      entry.symbol === intent.implementation.symbol,
  );
  if (intent.imports.length !== 1 || permittedImports.length !== 1) {
    renderFailure(
      intent,
      "imports",
      "only the exact Haxe registry implementation value",
      intent.imports
        .map(
          (entry) =>
            `${entry.typeOnly ? "type " : "value "}${entry.symbol} from ${entry.modulePath}`,
        )
        .join(", "),
    );
  }
  const [exported] = intent.exports;
  const expectedSignature = `typeof ${implementationLocal}.components`;
  if (
    intent.exports.length !== 1 ||
    exported === undefined ||
    exported.kind !== "named" ||
    exported.name !== "useMDXComponents" ||
    exported.sourceField !== "components" ||
    exported.signature !== expectedSignature ||
    intent.source.fieldName !== "components"
  ) {
    renderFailure(
      intent,
      "exports",
      `one exact useMDXComponents const alias from ${implementationLocal}.components with signature ${expectedSignature}`,
      intent.exports
        .map(
          (entry) =>
            `${entry.kind}:${entry.name}:${entry.sourceField}:${entry.signature}`,
        )
        .join(", ") || "none",
    );
  }
  if (exported !== undefined) {
    safeSignature(intent, exported);
  }
}

function renderIntent(
  appRootRelative: string,
  intent: AdapterIntent,
  nextVersion: string,
  implementationDigest: string | null,
): PlannedGeneratedOutput {
  const outputPath = intent.kind === "proxy"
    ? (proxyOutputPathForAppRoot(appRootRelative) ??
      renderFailure(
        intent,
        "appRoot",
        "app or src/app so Next can discover proxy.ts at its supported root",
        appRootRelative,
      ))
    : intent.kind === "mdx-components"
      ? (mdxComponentsOutputPathForAppRoot(appRootRelative) ??
        renderFailure(
          intent,
          "appRoot",
          "app or src/app so Next can discover mdx-components.tsx at its supported root",
          appRootRelative,
        ))
    : path.posix.join(appRootRelative, intent.targetPath);
  if (
    implementationDigest !== null &&
    !/^[0-9a-f]{64}$/.test(implementationDigest)
  ) {
    renderFailure(
      intent,
      "implementationDigest",
      "one lowercase SHA-256 digest",
      implementationDigest,
    );
  }
  const proxyRendering = validateProxyIntent(intent, nextVersion);
  const conventionFile =
    intent.kind === "page"
      ? "page.tsx"
      : intent.kind === "layout"
        ? "layout.tsx"
        : intent.kind === "loading"
          ? "loading.tsx"
          : intent.kind === "error"
            ? "error.tsx"
            : intent.kind === "not-found"
              ? "not-found.tsx"
              : intent.kind === "default"
                ? "default.tsx"
              : intent.kind === "route-handler"
                ? "route.ts"
                : intent.kind === "proxy"
                  ? "proxy.ts"
                  : null;
  if (
    conventionFile !== null &&
    intent.targetPath !== path.posix.join(intent.segmentPath, conventionFile)
  ) {
    renderFailure(
      intent,
      "targetPath",
      path.posix.join(intent.segmentPath, conventionFile),
      intent.targetPath,
    );
  }
  const localNames = new Set<string>();
  let implementationLocal: string | null = null;
  const imports = intent.imports.map((imported) => {
    const local = imported.alias ?? imported.symbol;
    if (localNames.has(local)) {
      renderFailure(
        intent,
        "imports",
        "one unique local identifier per import",
        local,
      );
    }
    localNames.add(local);
    if (
      !imported.typeOnly &&
      imported.modulePath === intent.implementation.modulePath &&
      imported.symbol === intent.implementation.symbol
    ) {
      implementationLocal = local;
    }
    return `${imported.typeOnly ? "import type" : "import"} { ${imported.symbol}` +
      `${imported.alias === null ? "" : ` as ${imported.alias}`} } from ` +
      `${JSON.stringify(imported.modulePath)};`;
  });
  if (implementationLocal === null) {
    renderFailure(
      intent,
      "implementation",
      "one non-type import matching the implementation module and symbol",
      `${intent.implementation.symbol} from ${intent.implementation.modulePath}`,
    );
  }

  validateClientComponentIntent(intent, implementationLocal);
  validateReactHookIntent(intent, implementationLocal);
  validateServerFunctionIntent(intent, implementationLocal);
  validateCacheFunctionIntent(intent, implementationLocal, nextVersion);
  validateMdxComponentsIntent(intent, implementationLocal);

  const declarationNames = new Set<string>();
  for (const exported of intent.exports) {
    declarationNames.add(
      exported.kind === "default" ? "NextJsHxDefault" : exported.name,
    );
  }
  for (const config of intent.config) {
    declarationNames.add(intent.kind === "proxy" ? "config" : config.name);
  }
  const conflictingName = [...declarationNames].find((name) => localNames.has(name));
  if (conflictingName !== undefined) {
    renderFailure(
      intent,
      "imports/exports",
      "generated declaration names distinct from every import local",
      conflictingName,
    );
  }

  const supportedDirectives = new Set([
    "use client",
    "use server",
    "use strict",
    ...CACHE_DIRECTIVES,
  ]);
  const unsupportedDirective = intent.directives.find(
    (directive) => !supportedDirectives.has(directive),
  );
  if (unsupportedDirective !== undefined) {
    renderFailure(
      intent,
      "directives",
      "only use client, use server, or use strict",
      unsupportedDirective,
    );
  }
  if (
    intent.kind === "error" &&
    (intent.directives.length !== 1 || intent.directives[0] !== "use client")
  ) {
    renderFailure(
      intent,
      "directives",
      "exactly use client for Next's error.tsx Client Component boundary",
      intent.directives.length === 0 ? "none" : intent.directives.join(", "),
    );
  }
  if (
    (intent.kind === "loading" ||
      intent.kind === "not-found" ||
      intent.kind === "default") &&
    intent.directives.length !== 0
  ) {
    renderFailure(
      intent,
      "directives",
      `no client directive for the server-owned ${intent.kind} boundary`,
      intent.directives.join(", "),
    );
  }

  validatePageLayoutIntent(intent, nextVersion);

  if (
    intent.kind === "loading" ||
    intent.kind === "error" ||
    intent.kind === "not-found" ||
    intent.kind === "default"
  ) {
    const [exported] = intent.exports;
    if (
      intent.exports.length !== 1 ||
      exported === undefined ||
      exported.kind !== "default" ||
      exported.name !== "default" ||
      exported.sourceField !== "render"
    ) {
      const actualExports = intent.exports
        .map((entry) => `${entry.kind}:${entry.name}:${entry.sourceField}`)
        .join(", ");
      renderFailure(
        intent,
        "exports",
        "one default export delegated to the validated render field",
        actualExports || "none",
      );
    }
    let expectedSignatures: readonly string[];
    if (intent.kind === "error") {
      expectedSignatures = [
        "(props: { error: Error & { digest?: string }; reset: () => void }) => JSX.Element",
      ];
    } else if (intent.kind === "default") {
      const route = publicRoute(intent);
      const props = `Pick<LayoutProps<${JSON.stringify(route)}>, "params">`;
      expectedSignatures = [
        "() => JSX.Element",
        "() => Promise<JSX.Element>",
        `(props: ${props}) => JSX.Element`,
        `(props: ${props}) => Promise<JSX.Element>`,
      ];
      const finalSegment = intent.segmentPath.split("/").at(-1) ?? "";
      const shape = routeShape(
        intent.segmentPath,
        `${intent.source.typeName}.${intent.source.fieldName}`,
      );
      if (shape.topology !== "parallel-view" || !finalSegment.startsWith("@")) {
        renderFailure(
          intent,
          "segmentPath",
          "the root of one named parallel slot such as dashboard/@modal",
          intent.segmentPath,
        );
      }
    } else {
      expectedSignatures = ["() => JSX.Element", "() => Promise<JSX.Element>"];
    }
    if (!expectedSignatures.includes(exported.signature)) {
      renderFailure(
        intent,
        "default.signature",
        expectedSignatures.join(" or "),
        exported.signature,
      );
    }
    if (intent.config.length !== 0) {
      renderFailure(
        intent,
        "config",
        "no named config exports for this reviewed special-file contract",
        intent.config.map((entry) => entry.name).join(", "),
      );
    }
  }

  const declarations: string[] = [];
  if (proxyRendering !== null) {
    declarations.push(
      `export const proxy: ${proxyRendering.proxyType} = ${implementationLocal}.proxy;`,
    );
    if (
      proxyRendering.matcher !== null &&
      proxyRendering.configType !== null
    ) {
      declarations.push(
        `export const config: ${proxyRendering.configType} = { matcher: ${configLiteral(proxyRendering.matcher)} };`,
      );
    }
  }
  const configByName = new Map(intent.config.map((entry) => [entry.name, entry]));
  if (proxyRendering !== null) {
    configByName.clear();
  }
  for (const exported of intent.exports) {
    if (proxyRendering !== null) {
      continue;
    }
    if (intent.kind === "server-function") {
      declarations.push(
        `export async function ${exported.name}(` +
          `...args: Parameters<typeof ${implementationLocal}.${exported.sourceField}>` +
          `): Promise<Awaited<ReturnType<typeof ${implementationLocal}.${exported.sourceField}>>> {\n` +
          `  return ${implementationLocal}.${exported.sourceField}(...args);\n` +
          `}`,
      );
      continue;
    }
    if (intent.kind === "cache-function") {
      const directive = cacheDirective(intent);
      if (directive === null) {
        renderFailure(intent, "directives", "one reviewed cache directive", "none");
      }
      declarations.push(
        `export async function ${exported.name}(` +
          `...args: Parameters<typeof ${implementationLocal}.${exported.sourceField}>` +
          `): Promise<Awaited<ReturnType<typeof ${implementationLocal}.${exported.sourceField}>>> {\n` +
          `  ${JSON.stringify(directive)};\n` +
          `  return ${implementationLocal}.${exported.sourceField}(...args);\n` +
          `}`,
      );
      continue;
    }
    if (
      (intent.kind === "page" || intent.kind === "layout") &&
      cacheDirective(intent) !== null &&
      (exported.kind === "default" ||
        exported.name === "generateMetadata" ||
        exported.name === "generateStaticParams")
    ) {
      const name = exported.kind === "default" ? "NextJsHxDefault" : exported.name;
      declarations.push(
        `${exported.kind === "default" ? "export default " : "export "}async function ${name}(` +
          `...args: Parameters<typeof ${implementationLocal}.${exported.sourceField}>` +
          `): Promise<Awaited<ReturnType<typeof ${implementationLocal}.${exported.sourceField}>>> {\n` +
          `  return ${implementationLocal}.${exported.sourceField}(...args);\n` +
          `}`,
      );
      continue;
    }
    if (exported.kind === "default") {
      declarations.push(
        `const NextJsHxDefault: ${safeSignature(intent, exported)} = ` +
          `${implementationLocal}.${exported.sourceField};`,
        "export default NextJsHxDefault;",
      );
      continue;
    }
    const config = configByName.get(exported.name);
    if (config !== undefined) {
      declarations.push(
        `export const ${exported.name} = ${configLiteral(config.value)};`,
      );
      configByName.delete(exported.name);
      continue;
    }
    declarations.push(
      `export const ${exported.name}: ${safeSignature(intent, exported)} = ` +
        `${implementationLocal}.${exported.sourceField};`,
    );
  }
  for (const config of configByName.values()) {
    declarations.push(`export const ${config.name} = ${configLiteral(config.value)};`);
  }
  if (declarations.length === 0) {
    renderFailure(
      intent,
      "exports/config",
      "at least one validated Next adapter export",
      "empty adapter module",
    );
  }

  const sections = [
    intent.kind === "cache-function"
      ? ""
      : intent.directives.map((directive) => `${JSON.stringify(directive)};`).join("\n"),
    `// Generated by NextJsHx from ${intent.source.typeName}.${intent.source.fieldName}.` +
      (implementationDigest === null
        ? ""
        : ` Implementation graph: sha256:${implementationDigest}.`),
    imports.join("\n"),
    declarations.join("\n"),
  ].filter((section) => section.length > 0);
  return Object.freeze({
    path: outputPath,
    kind: `${intent.kind}-adapter`,
    source: `${intent.source.typeName}.${intent.source.fieldName}`,
    content: `${sections.join("\n\n")}\n`,
  });
}

export function renderAdapterPlan(
  appRootRelative: string,
  plan: AdapterPlan,
  options: AdapterRenderOptions = {},
): readonly PlannedGeneratedOutput[] {
  const rendered = Object.freeze(
    plan.intents.map((intent) =>
      renderIntent(
        appRootRelative,
        intent,
        plan.toolchain.next,
        options.implementationDigests?.get(
          intent.kind === "proxy"
            ? (proxyOutputPathForAppRoot(appRootRelative) ?? "")
            : intent.kind === "mdx-components"
              ? (mdxComponentsOutputPathForAppRoot(appRootRelative) ?? "")
            : path.posix.join(appRootRelative, intent.targetPath),
        ) ?? null,
      ),
    ),
  );
  if (options.implementationDigests !== undefined) {
    const renderedPaths = new Set(rendered.map((output) => output.path));
    const missing = rendered
      .filter((output) => !options.implementationDigests?.has(output.path))
      .map((output) => output.path);
    const extra = [...options.implementationDigests.keys()]
      .filter((candidate) => !renderedPaths.has(candidate));
    if (missing.length > 0 || extra.length > 0) {
      throw new Error(
        `implementation digest coverage differs from rendered adapters: missing ${missing.join(", ") || "none"}; extra ${extra.join(", ") || "none"}`,
      );
    }
  }
  return rendered;
}
