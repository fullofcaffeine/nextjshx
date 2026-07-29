#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import net from "node:net";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright-core";
import ts from "typescript";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const FIXTURE = path.join(ROOT, "tests/fixtures/next-stable");
const GENERATED = path.join(FIXTURE, "src-gen");
const GENERATED_INTERCEPTED_PHOTO_ADAPTER = path.join(
  FIXTURE,
  "app/@modal/(.)photo/[id]/page.tsx",
);
const GENERATED_MODAL_DEFAULT_ADAPTER = path.join(FIXTURE, "app/@modal/default.tsx");
const GENERATED_FEED_ADAPTER = path.join(FIXTURE, "app/feed/page.tsx");
const GENERATED_PAGE_ADAPTER = path.join(FIXTURE, "app/haxe/page.tsx");
const GENERATED_PHOTO_ADAPTER = path.join(FIXTURE, "app/photo/[id]/page.tsx");
const GENERATED_PRODUCT_ADAPTER = path.join(FIXTURE, "app/products/[slug]/page.tsx");
const GENERATED_LAYOUT_ADAPTER = path.join(FIXTURE, "app/layout.tsx");
const GENERATED_ROUTE_ADAPTER = path.join(FIXTURE, "app/api/echo/[id]/route.ts");
const GENERATED_LOADING_ADAPTER = path.join(FIXTURE, "app/special/loading/loading.tsx");
const GENERATED_ERROR_ADAPTER = path.join(FIXTURE, "app/special/error/error.tsx");
const GENERATED_NOT_FOUND_ADAPTER = path.join(
  FIXTURE,
  "app/special/not-found/not-found.tsx",
);
const GENERATED_PROXY_ADAPTER = path.join(FIXTURE, "proxy.ts");
const GENERATED_ADAPTERS = [
  GENERATED_INTERCEPTED_PHOTO_ADAPTER,
  GENERATED_MODAL_DEFAULT_ADAPTER,
  GENERATED_FEED_ADAPTER,
  GENERATED_PAGE_ADAPTER,
  GENERATED_PHOTO_ADAPTER,
  GENERATED_PRODUCT_ADAPTER,
  GENERATED_LAYOUT_ADAPTER,
  GENERATED_ROUTE_ADAPTER,
  GENERATED_LOADING_ADAPTER,
  GENERATED_ERROR_ADAPTER,
  GENERATED_NOT_FOUND_ADAPTER,
  GENERATED_PROXY_ADAPTER,
];
const INTERCEPTED_PHOTO_ADAPTER_SNAPSHOT = path.join(
  ROOT,
  "tests/snapshots/next-stable-haxe-intercepted-photo.tsx",
);
const MODAL_DEFAULT_ADAPTER_SNAPSHOT = path.join(
  ROOT,
  "tests/snapshots/next-stable-haxe-modal-default.tsx",
);
const FEED_ADAPTER_SNAPSHOT = path.join(ROOT, "tests/snapshots/next-stable-haxe-feed.tsx");
const PAGE_ADAPTER_SNAPSHOT = path.join(ROOT, "tests/snapshots/next-stable-haxe-page.tsx");
const PHOTO_ADAPTER_SNAPSHOT = path.join(
  ROOT,
  "tests/snapshots/next-stable-haxe-photo.tsx",
);
const PRODUCT_ADAPTER_SNAPSHOT = path.join(
  ROOT,
  "tests/snapshots/next-stable-haxe-product.tsx",
);
const LAYOUT_ADAPTER_SNAPSHOT = path.join(ROOT, "tests/snapshots/next-stable-haxe-layout.tsx");
const LOADING_ADAPTER_SNAPSHOT = path.join(
  ROOT,
  "tests/snapshots/next-stable-haxe-loading.tsx",
);
const ERROR_ADAPTER_SNAPSHOT = path.join(ROOT, "tests/snapshots/next-stable-haxe-error.tsx");
const NOT_FOUND_ADAPTER_SNAPSHOT = path.join(
  ROOT,
  "tests/snapshots/next-stable-haxe-not-found.tsx",
);
const PROXY_ADAPTER_SNAPSHOT = path.join(
  ROOT,
  "tests/snapshots/next-stable-haxe-proxy.ts",
);
const CLI_BIN = path.join(ROOT, "tools/cli/.tmp/src/cli.js");
const NEXT_BIN = path.join(ROOT, "node_modules/next/dist/bin/next");
const TSC_BIN = path.join(ROOT, "node_modules/typescript/bin/tsc6");
const GENES_COMMIT = "8a7f7aaf3227fdee79a3cbd25d90ef2c99975f78";
const TYPESCRIPT_VERSION = "6.0.2";
const PLAYWRIGHT_VERSION = "1.61.1";
const EXPECTED_VERSIONS = new Map([
  ["next", "16.2.12"],
  ["react", "19.2.7"],
  ["react-dom", "19.2.7"],
  ["typescript", TYPESCRIPT_VERSION],
  ["postcss", "8.5.23"],
  ["@types/node", "20.19.24"],
  ["@types/react", "19.2.17"],
  ["@types/react-dom", "19.2.3"],
  ["playwright-core", PLAYWRIGHT_VERSION],
]);
const SUPPORTED_NODE_VERSIONS = new Set(["20.9.0", "20.19.3", "24.18.0"]);
const COMMAND_ENV = {
  ...process.env,
  CI: "1",
  NEXT_TELEMETRY_DISABLED: "1",
};
const LINKED_PACKAGES = ["next", "react", "react-dom", "typescript"];

function commandLine(command, args) {
  return [command, ...args]
    .map((value) => (/^[A-Za-z0-9_./:=@-]+$/.test(value) ? value : JSON.stringify(value)))
    .join(" ");
}

function run(command, args, options = {}) {
  const cwd = options.cwd ?? ROOT;
  console.log(`[next-stable] $ ${commandLine(command, args)}`);
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: COMMAND_ENV,
      stdio: "inherit",
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(
        new Error(
          `${command} failed with ${signal === null ? `exit ${code}` : `signal ${signal}`}`,
        ),
      );
    });
  });
}

function capture(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: ROOT,
      env: COMMAND_ENV,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      reject(
        new Error(
          `${command} failed with ${signal === null ? `exit ${code}` : `signal ${signal}`}: ${stderr.trim()}`,
        ),
      );
    });
  });
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

async function verifyToolchain() {
  assert(
    SUPPORTED_NODE_VERSIONS.has(process.versions.node),
    `expected Node ${[...SUPPORTED_NODE_VERSIONS].join(" or ")}, found ${process.versions.node}`,
  );

  const { stdout: haxeVersion } = await capture("haxe", ["--version"]);
  assert.equal(haxeVersion.trim(), "4.3.7", "fixture must use Haxe 4.3.7");

  for (const [name, expected] of EXPECTED_VERSIONS) {
    const manifest = await readJson(path.join(ROOT, "node_modules", name, "package.json"));
    assert.equal(manifest.version, expected, `${name} must resolve to ${expected}`);
  }

  const { stdout: typescriptVersion } = await capture(process.execPath, [
    TSC_BIN,
    "--version",
  ]);
  assert.equal(
    typescriptVersion.trim(),
    `Version ${TYPESCRIPT_VERSION}`,
    "fixture must execute the exact TypeScript compiler core",
  );

  const genesLock = await fs.readFile(
    path.join(ROOT, "haxe_libraries/genes-ts.hxml"),
    "utf8",
  );
  assert(genesLock.includes(GENES_COMMIT), "genes-ts lock lost its exact commit");
  assert(!genesLock.includes(ROOT), "genes-ts lock contains a machine-local path");
}

async function removeGeneratedState() {
  await Promise.all([
    fs.rm(GENERATED, { recursive: true, force: true }),
    fs.rm(path.join(FIXTURE, ".next"), { recursive: true, force: true }),
    fs.rm(path.join(FIXTURE, ".nextjshx"), { recursive: true, force: true }),
    ...GENERATED_ADAPTERS.map((adapter) => fs.rm(adapter, { force: true })),
    fs.rm(path.join(FIXTURE, "next-env.d.ts"), { force: true }),
    fs.rm(path.join(FIXTURE, "tsconfig.tsbuildinfo"), { force: true }),
  ]);
  await removeEmptyAdapterDirectories();
}

async function removeEmptyAdapterDirectories() {
  const appRoot = path.join(FIXTURE, "app");
  const directories = new Set();
  for (const adapter of GENERATED_ADAPTERS) {
    let directory = path.dirname(adapter);
    while (directory.startsWith(`${appRoot}${path.sep}`)) {
      directories.add(directory);
      directory = path.dirname(directory);
    }
  }
  for (const directory of [...directories].sort((left, right) => right.length - left.length)) {
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
    const destination = path.join(FIXTURE, "node_modules", name);
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
  await fs.rmdir(path.join(FIXTURE, "node_modules")).catch((error) => {
    if (error.code !== "ENOENT" && error.code !== "ENOTEMPTY") {
      throw error;
    }
  });
}

async function removeCliOwnedSourceState() {
  await Promise.all([
    fs.rm(path.join(FIXTURE, ".nextjshx"), { recursive: true, force: true }),
    ...GENERATED_ADAPTERS.map((adapter) => fs.rm(adapter, { force: true })),
  ]);
  await removeEmptyAdapterDirectories();
}

async function walk(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const child = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(child)));
    } else if (entry.isFile()) {
      files.push(child);
    }
  }
  return files;
}

async function verifyAuthoredTypes() {
  const roots = [path.join(FIXTURE, "haxe"), path.join(FIXTURE, "app")];
  for (const root of roots) {
    for (const file of await walk(root)) {
      const source = await fs.readFile(file, "utf8");
      assert(!/\bDynamic\b/.test(source), `${path.relative(ROOT, file)} uses Dynamic`);
      assert(!/\buntyped\b/.test(source), `${path.relative(ROOT, file)} uses untyped`);
      assert(!/@ts-(?:ignore|nocheck)/.test(source), `${path.relative(ROOT, file)} suppresses TypeScript`);
    }
  }
}

async function verifyGeneratedOutput() {
  const files = await walk(GENERATED);
  const relativeFiles = files.map((file) => path.relative(GENERATED, file));
  assert(relativeFiles.includes("index.tsx"), "genes-ts did not emit the TSX entry module");
  assert(
    relativeFiles.includes(path.join("app", "HaxePage.tsx")),
    "genes-ts did not emit the split Haxe page implementation",
  );
  assert(
    relativeFiles.includes(path.join("app", "ProductPage.tsx")),
    "genes-ts did not emit the split generated-metadata page implementation",
  );
  for (const name of ["FeedPage", "PhotoPage", "InterceptedPhotoPage", "ModalDefault"]) {
    assert(
      relativeFiles.includes(path.join("app", `${name}.tsx`)),
      `genes-ts did not emit the split ${name} routing implementation`,
    );
  }
  assert(
    relativeFiles.includes(path.join("nextjs", "app", "PageMetadataProps.tsx")),
    "genes-ts did not emit page-only generated-metadata props",
  );
  assert(
    relativeFiles.includes(path.join("app", "RootLayout.tsx")),
    "genes-ts did not emit the split root layout implementation",
  );
  assert(
    relativeFiles.includes(path.join("route_handler_fixture", "EchoRoute.tsx")),
    "genes-ts did not emit the split Route Handler implementation in the TSX build graph",
  );
  assert(
    relativeFiles.includes(path.join("request_proxy_fixture", "RequestProxy.tsx")),
    "genes-ts did not emit the split request proxy implementation",
  );
  for (const name of ["ErrorView", "LoadingView", "NotFoundView"]) {
    assert(
      relativeFiles.includes(path.join("special_file_fixture", `${name}.tsx`)),
      `genes-ts did not emit the split ${name} special-file implementation`,
    );
  }
  assert(
    relativeFiles.every((file) => !file.endsWith(".js")),
    "genes-ts emitted JavaScript in the TypeScript fixture",
  );

  const haxePage = await fs.readFile(path.join(GENERATED, "app/HaxePage.tsx"), "utf8");
  const productPage = await fs.readFile(path.join(GENERATED, "app/ProductPage.tsx"), "utf8");
  const feedPage = await fs.readFile(path.join(GENERATED, "app/FeedPage.tsx"), "utf8");
  const photoPage = await fs.readFile(path.join(GENERATED, "app/PhotoPage.tsx"), "utf8");
  const interceptedPhotoPage = await fs.readFile(
    path.join(GENERATED, "app/InterceptedPhotoPage.tsx"),
    "utf8",
  );
  const modalDefault = await fs.readFile(path.join(GENERATED, "app/ModalDefault.tsx"), "utf8");
  const pageMetadataProps = await fs.readFile(
    path.join(GENERATED, "nextjs/app/PageMetadataProps.tsx"),
    "utf8",
  );
  const rootLayout = await fs.readFile(path.join(GENERATED, "app/RootLayout.tsx"), "utf8");
  const errorView = await fs.readFile(
    path.join(GENERATED, "special_file_fixture/ErrorView.tsx"),
    "utf8",
  );
  const loadingView = await fs.readFile(
    path.join(GENERATED, "special_file_fixture/LoadingView.tsx"),
    "utf8",
  );
  const notFoundView = await fs.readFile(
    path.join(GENERATED, "special_file_fixture/NotFoundView.tsx"),
    "utf8",
  );
  const errorProps = await fs.readFile(
    path.join(GENERATED, "nextjs/app/ErrorProps.tsx"),
    "utf8",
  );
  const requestProxy = await fs.readFile(
    path.join(GENERATED, "request_proxy_fixture/RequestProxy.tsx"),
    "utf8",
  );
  assert(haxePage.includes("export class HaxePage"), "HaxePage is not a named ESM export");
  assert(
    haxePage.includes('import type {JSX} from "react"'),
    "HaxePage lost the explicit React 19 JSX type import",
  );
  assert(haxePage.includes('<main id="haxe-page">'), "HaxePage lost its TSX markup");
  assert(
    haxePage.includes("static href(): import('next').Route<\"/haxe\">"),
    "HaxePage lost its generated typed href companion",
  );
  assert(
    haxePage.includes("declare static metadata: import('next').Metadata"),
    "HaxePage lost its typed static metadata field",
  );
  assert(
    feedPage.includes('static href(): import(\'next\').Route<"/feed">') &&
      feedPage.includes('href={`/photo/${__nextRoute0Encoded0}`}'),
    "FeedPage lost its canonical typed link to the intercepted photo destination",
  );
  assert(
    photoPage.includes("static href(params: PhotoParams): import('next').Route<`/photo/${string}`>") &&
      photoPage.includes('id="canonical-photo"'),
    "PhotoPage lost its canonical route identity or hard-navigation view",
  );
  assert(
    interceptedPhotoPage.includes(
      'return <dialog id="photo-modal" open><p>Intercepted Haxe photo modal</p></dialog>;',
    ),
    "InterceptedPhotoPage lost canonical static dialog markup",
  );
  assert(!interceptedPhotoPage.includes("open={true}"), "static dialog open became a redundant expression");
  assert(
    interceptedPhotoPage.includes(
      "static href(params: PhotoParams): import('next').Route<`/photo/${string}`>",
    ) &&
      !interceptedPhotoPage.includes("@modal") &&
      !interceptedPhotoPage.includes("(.)photo"),
    "the intercepted view leaked filesystem topology into its canonical href",
  );
  assert(
    modalDefault.includes('return <span id="modal-default">No active modal</span>;'),
    "ModalDefault lost the typed parallel-slot fallback",
  );
  assert(
    productPage.includes(
      "static generateMetadata(props: PageMetadataProps<ProductParams, Readonly<Record<string, string | string[] | undefined>>>, parent: globalThis.Promise<Awaited<import('next').ResolvingMetadata>>): globalThis.Promise<import('next').Metadata>",
    ),
    "ProductPage lost its exact generated-metadata signature",
  );
  assert(
    productPage.includes("static generateStaticParams(): globalThis.Promise<ProductParams[]>"),
    "ProductPage lost its typed static-params function",
  );
  assert(
    productPage.includes("static href(params: ProductParams): import('next').Route<`/products/${string}`>"),
    "ProductPage lost its generated dynamic href companion",
  );
  assert(
    productPage.includes(
      "static hrefWithQuery(params: ProductParams, query: ProductQuery): import('next').Route<`/products/${string}` | `${Extract<`/products/${string}`, string>}?${string}`>",
    ),
    "ProductPage lost its generated typed-query companion",
  );
  assert(haxePage.includes("new URLSearchParams()"), "HaxePage lost native typed-query encoding");
  assert(
    haxePage.includes('append("page", Std.string(__nextQuery0Value_page))') &&
      haxePage.includes('append("tag", Std.string(__nextQuery0Item2))'),
    "HaxePage lost scalar or repeated query encoding",
  );
  assert(!haxePage.includes("ProductPage.hrefWithQuery"), "HaxePage retained the inline page companion call");
  assert(!/from ["'].+ProductPage["']/.test(haxePage), "typed query construction imported the product page implementation");
  assert(
    pageMetadataProps.includes("params: globalThis.Promise<Params>") &&
      pageMetadataProps.includes("searchParams: globalThis.Promise<Query>"),
    "PageMetadataProps lost its Promise-shaped page-only inputs",
  );
  for (const [name, source] of [
    ["HaxePage.tsx", haxePage],
    ["ProductPage.tsx", productPage],
  ]) {
    assert(!source.includes("SegmentConfig"), `${name} retained the compile-time marker`);
    assert(!/static segment\b/.test(source), `${name} retained the erased segment field`);
    assert(!/\b(?:any|unknown)\b/.test(source), `${name} contains a broad type`);
  }
  assert(rootLayout.includes("export class RootLayout"), "RootLayout is not a named ESM export");
  assert(rootLayout.includes("<html lang=\"en\">"), "RootLayout lost its html root");
  assert(rootLayout.includes("<body>"), "RootLayout lost its body root");
  assert(rootLayout.includes("props.children"), "RootLayout lost its typed children");
  assert(
    rootLayout.includes("modal: import('react').ReactNode") &&
      rootLayout.includes("props.modal"),
    "RootLayout lost its required typed @modal slot",
  );
  assert(
    errorView.includes("static render(props: ErrorProps): JSX.Element"),
    "ErrorView lost the semantic error-boundary props type",
  );
  assert(errorView.includes("onClick={props.reset}"), "ErrorView lost its typed reset callback");
  assert(errorView.includes("props.error.message"), "ErrorView lost its typed Error access");
  assert(loadingView.includes('id="haxe-loading"'), "LoadingView lost its streamed marker");
  assert(notFoundView.includes('id="haxe-not-found"'), "NotFoundView lost its 404 marker");
  assert(
    errorProps.includes("error: Error & { digest?: string }"),
    "ErrorProps lost Next's exact error intersection",
  );
  assert(errorProps.includes("reset: () => void"), "ErrorProps lost the zero-argument reset type");
  assert(requestProxy.includes("static proxy(request:"), "RequestProxy lost its typed entry");
  assert(
    requestProxy.includes("request.nextUrl.pathname"),
    "RequestProxy lost its NextRequest pathname behavior",
  );
  assert(!/\bany\b/.test(requestProxy), "RequestProxy contains any");
  assert(!/\sas\s/.test(requestProxy), "RequestProxy contains a TypeScript assertion");
  for (const [name, source] of [
    ["ErrorView.tsx", errorView],
    ["LoadingView.tsx", loadingView],
    ["NotFoundView.tsx", notFoundView],
    ["ErrorProps.tsx", errorProps],
    ["FeedPage.tsx", feedPage],
    ["PhotoPage.tsx", photoPage],
    ["InterceptedPhotoPage.tsx", interceptedPhotoPage],
    ["ModalDefault.tsx", modalDefault],
  ]) {
    assert(!/\b(?:any|unknown)\b/.test(source), `${name} contains a broad type`);
    assert(!/\sas\s/.test(source), `${name} contains a TypeScript assertion`);
  }

  for (const file of files.filter((candidate) => candidate.endsWith(".ts") || candidate.endsWith(".tsx"))) {
    const source = await fs.readFile(file, "utf8");
    const relativeImports = [...source.matchAll(/\bfrom\s+["'](\.{1,2}\/[^"']+)["']/g)];
    for (const match of relativeImports) {
      assert(
        path.posix.extname(match[1]) === "",
        `${path.relative(ROOT, file)} emitted an extension-bearing relative import ${match[1]}`,
      );
    }
  }

  console.log(
    `[next-stable] generated-output: OK: ${relativeFiles.length} split TS/TSX files checked`,
  );
}

async function verifyOwnedAdapters() {
  const interceptedPhoto = await fs.readFile(GENERATED_INTERCEPTED_PHOTO_ADAPTER, "utf8");
  const modalDefault = await fs.readFile(GENERATED_MODAL_DEFAULT_ADAPTER, "utf8");
  const feed = await fs.readFile(GENERATED_FEED_ADAPTER, "utf8");
  const page = await fs.readFile(GENERATED_PAGE_ADAPTER, "utf8");
  const photo = await fs.readFile(GENERATED_PHOTO_ADAPTER, "utf8");
  const product = await fs.readFile(GENERATED_PRODUCT_ADAPTER, "utf8");
  const layout = await fs.readFile(GENERATED_LAYOUT_ADAPTER, "utf8");
  const loading = await fs.readFile(GENERATED_LOADING_ADAPTER, "utf8");
  const error = await fs.readFile(GENERATED_ERROR_ADAPTER, "utf8");
  const notFound = await fs.readFile(GENERATED_NOT_FOUND_ADAPTER, "utf8");
  const proxy = await fs.readFile(GENERATED_PROXY_ADAPTER, "utf8");
  assert(
    interceptedPhoto.includes("Generated by NextJsHx from app.InterceptedPhotoPage.render") &&
      interceptedPhoto.includes('from "../../../../src-gen/app/InterceptedPhotoPage"'),
    "the intercepted photo page lost its owned Haxe adapter identity",
  );
  assert(
    interceptedPhoto.includes('(props: PageProps<"/photo/[id]">) => JSX.Element'),
    "the intercepted page adapter leaked its filesystem-only slot markers into PageProps",
  );
  assert(
    modalDefault.includes("Generated by NextJsHx from app.ModalDefault.render") &&
      modalDefault.includes('from "../../src-gen/app/ModalDefault"'),
    "the @modal default lost its owned Haxe adapter identity",
  );
  assert(
    modalDefault.includes("const NextJsHxDefault: () => JSX.Element = ModalDefault.render;"),
    "the @modal default lost its exact zero-argument signature",
  );
  assert(
    feed.includes("Generated by NextJsHx from app.FeedPage.render") &&
      feed.includes('(props: PageProps<"/feed">) => JSX.Element'),
    "the canonical feed lost its owned typed page adapter",
  );
  assert(
    photo.includes("Generated by NextJsHx from app.PhotoPage.render") &&
      photo.includes('(props: PageProps<"/photo/[id]">) => JSX.Element'),
    "the canonical photo route lost its owned typed page adapter",
  );
  assert(
    page.includes("Generated by NextJsHx from app.HaxePage.render"),
    "the fixture page is not a NextJsHx-owned adapter",
  );
  assert(
    page.includes('from "../../src-gen/app/HaxePage"'),
    "the page adapter lost its generated Haxe implementation import",
  );
  assert(
    page.includes('import type { JSX } from "react"'),
    "the page adapter lost React 19's module-owned JSX type import",
  );
  assert(
    page.includes('(props: PageProps<"/haxe">) => JSX.Element'),
    "the page adapter lost Next's route-literal PageProps signature",
  );
  assert(
    page.includes("export const metadata: Metadata = HaxePage.metadata;"),
    "the page adapter lost its typed static metadata export",
  );
  for (const literal of [
    'export const runtime = "nodejs";',
    'export const preferredRegion = "home";',
    "export const revalidate = false;",
    "export const maxDuration = 5;",
  ]) {
    assert(page.includes(literal), `the page adapter lost direct config literal ${literal}`);
  }
  assert(
    product.includes("Generated by NextJsHx from app.ProductPage.render"),
    "the generated-metadata page is not a NextJsHx-owned adapter",
  );
  assert(
    product.includes('from "../../../src-gen/app/ProductPage"'),
    "the generated-metadata page lost its Haxe implementation import",
  );
  assert(
    product.includes('(props: PageProps<"/products/[slug]">) => JSX.Element'),
    "the generated-metadata page lost Next's route-literal PageProps signature",
  );
  assert(
    product.includes(
      'export const generateMetadata: (props: PageProps<"/products/[slug]">, parent: ResolvingMetadata) => Promise<Metadata> = ProductPage.generateMetadata;',
    ),
    "the generated-metadata page lost its exact metadata export",
  );
  assert(
    product.includes(
      'export const generateStaticParams: () => Promise<Array<Awaited<PageProps<"/products/[slug]">["params"]>>> = ProductPage.generateStaticParams;',
    ),
    "the generated-metadata page lost its route-matched static-params export",
  );
  for (const literal of [
    "export const dynamicParams = false;",
    "export const maxDuration = 10;",
    'export const preferredRegion = ["iad1", "sfo1"];',
    "export const revalidate = 60;",
  ]) {
    assert(product.includes(literal), `the generated-metadata page lost direct config literal ${literal}`);
  }
  assert(
    layout.includes("Generated by NextJsHx from app.RootLayout.render"),
    "the fixture root layout is not a NextJsHx-owned adapter",
  );
  assert(
    layout.includes('from "../src-gen/app/RootLayout"'),
    "the root layout adapter lost its generated Haxe implementation import",
  );
  assert(
    layout.includes('import type { JSX } from "react"'),
    "the layout adapter lost React 19's module-owned JSX type import",
  );
  assert(
    layout.includes('(props: LayoutProps<"/">) => JSX.Element'),
    "the layout adapter lost Next's route-literal LayoutProps signature",
  );
  assert.equal(
    page,
    await fs.readFile(PAGE_ADAPTER_SNAPSHOT, "utf8"),
    "the formatted page adapter drifted from its reviewed snapshot",
  );
  assert.equal(
    product,
    await fs.readFile(PRODUCT_ADAPTER_SNAPSHOT, "utf8"),
    "the formatted generated-metadata adapter drifted from its reviewed snapshot",
  );
  assert.equal(
    layout,
    await fs.readFile(LAYOUT_ADAPTER_SNAPSHOT, "utf8"),
    "the formatted layout adapter drifted from its reviewed snapshot",
  );
  assert.equal(
    interceptedPhoto,
    await fs.readFile(INTERCEPTED_PHOTO_ADAPTER_SNAPSHOT, "utf8"),
    "the formatted intercepted-photo adapter drifted from its reviewed snapshot",
  );
  assert.equal(
    modalDefault,
    await fs.readFile(MODAL_DEFAULT_ADAPTER_SNAPSHOT, "utf8"),
    "the formatted modal-default adapter drifted from its reviewed snapshot",
  );
  assert.equal(
    feed,
    await fs.readFile(FEED_ADAPTER_SNAPSHOT, "utf8"),
    "the formatted feed adapter drifted from its reviewed snapshot",
  );
  assert.equal(
    photo,
    await fs.readFile(PHOTO_ADAPTER_SNAPSHOT, "utf8"),
    "the formatted photo adapter drifted from its reviewed snapshot",
  );
  assert(
    loading.includes("Generated by NextJsHx from special_file_fixture.LoadingView.render"),
    "the loading fallback is not a NextJsHx-owned adapter",
  );
  assert(
    loading.includes('from "../../../src-gen/special_file_fixture/LoadingView"'),
    "the loading adapter lost its generated Haxe implementation import",
  );
  assert(!loading.startsWith('"use client";'), "loading.tsx must remain a Server Component");
  assert(
    loading.includes("const NextJsHxDefault: () => JSX.Element = LoadingView.render;"),
    "the loading adapter lost its exact default signature",
  );
  assert(
    error.startsWith('"use client";\n'),
    "error.tsx must begin with its macro-owned client directive",
  );
  assert(
    error.includes("Generated by NextJsHx from special_file_fixture.ErrorView.render"),
    "the error boundary is not a NextJsHx-owned adapter",
  );
  assert(
    error.includes('from "../../../src-gen/special_file_fixture/ErrorView"'),
    "the error adapter lost its generated Haxe implementation import",
  );
  assert(
    error.includes("error: Error & {") &&
      error.includes("digest?: string;") &&
      error.includes("reset: () => void;"),
    "the error adapter lost Next's exact error/reset props",
  );
  assert(
    notFound.includes("Generated by NextJsHx from special_file_fixture.NotFoundView.render"),
    "the not-found fallback is not a NextJsHx-owned adapter",
  );
  assert(
    notFound.includes('from "../../../src-gen/special_file_fixture/NotFoundView"'),
    "the not-found adapter lost its generated Haxe implementation import",
  );
  assert(!notFound.startsWith('"use client";'), "not-found.tsx must remain a Server Component");
  assert(
    notFound.includes("const NextJsHxDefault: () => JSX.Element = NotFoundView.render;"),
    "the not-found adapter lost its exact default signature",
  );
  assert.equal(
    loading,
    await fs.readFile(LOADING_ADAPTER_SNAPSHOT, "utf8"),
    "the formatted loading adapter drifted from its reviewed snapshot",
  );
  assert.equal(
    error,
    await fs.readFile(ERROR_ADAPTER_SNAPSHOT, "utf8"),
    "the formatted error adapter drifted from its reviewed snapshot",
  );
  assert.equal(
    notFound,
    await fs.readFile(NOT_FOUND_ADAPTER_SNAPSHOT, "utf8"),
    "the formatted not-found adapter drifted from its reviewed snapshot",
  );
  assert(
    proxy.includes("Generated by NextJsHx from request_proxy_fixture.RequestProxy.proxy"),
    "the root proxy is not a NextJsHx-owned adapter",
  );
  assert(
    proxy.includes('from "./src-gen/request_proxy_fixture/RequestProxy"'),
    "the proxy adapter lost its root-relative Haxe implementation import",
  );
  assert(
    proxy.includes('import type { NextProxy as NextJsHxProxy } from "next/server"'),
    "the proxy adapter lost Next's public callable type",
  );
  assert(
    proxy.includes('import type { ProxyConfig as NextJsHxProxyConfig } from "next/server"'),
    "the proxy adapter lost Next's public config type",
  );
  assert(proxy.includes("export const proxy: NextJsHxProxy"));
  assert(
    proxy.includes('matcher: ["/haxe", "/products/:path*"]'),
    "the proxy adapter lost its canonical typed matchers",
  );
  assert.equal(
    proxy,
    await fs.readFile(PROXY_ADAPTER_SNAPSHOT, "utf8"),
    "the formatted proxy adapter drifted from its reviewed snapshot",
  );
  const route = await fs.readFile(GENERATED_ROUTE_ADAPTER, "utf8");
  assert(
    route.includes("Generated by NextJsHx from route_handler_fixture.EchoRoute.remove"),
    "the fixture API route is not a NextJsHx-owned Route Handler adapter",
  );
  assert(
    route.includes('from "../../../../src-gen/route_handler_fixture/EchoRoute"'),
    "the Route Handler adapter lost its derived implementation import",
  );
  assert(
    route.includes('import type { NextRequest as NextJsHxRouteRequest } from "next/server"'),
    "the Route Handler adapter lost its public NextRequest type import",
  );
  assert(route.includes("export const GET:"), "the Route Handler adapter lost GET");
  assert(route.includes("export const POST:"), "the Route Handler adapter lost POST");
  assert(route.includes("export const DELETE:"), "the Route Handler adapter lost DELETE");
  assert(
    route.includes('RouteContext<"/api/echo/[id]">'),
    "the Route Handler adapter lost Next's route-literal context check",
  );
  assert(!/\b(?:any|unknown)\b/.test(route), "the Route Handler adapter contains a broad type");
  assert(!/@ts-(?:ignore|nocheck)/.test(route), "the Route Handler adapter suppresses TypeScript");
  for (const [name, source] of [
    ["@modal/(.)photo/[id]/page.tsx", interceptedPhoto],
    ["@modal/default.tsx", modalDefault],
    ["feed/page.tsx", feed],
    ["page.tsx", page],
    ["photo/[id]/page.tsx", photo],
    ["products/[slug]/page.tsx", product],
    ["layout.tsx", layout],
    ["route.ts", route],
    ["loading.tsx", loading],
    ["error.tsx", error],
    ["not-found.tsx", notFound],
    ["proxy.ts", proxy],
  ]) {
    assert(!/\b(?:any|unknown)\b/.test(source), `${name} contains a broad type`);
    assert(!/@ts-(?:ignore|nocheck)/.test(source), `${name} suppresses TypeScript`);
    const parsed = ts.createSourceFile(name, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    let assertion = null;
    const inspect = (node) => {
      if (ts.isAsExpression(node) || ts.isTypeAssertionExpression(node)) {
        assertion = node;
        return;
      }
      ts.forEachChild(node, inspect);
    };
    inspect(parsed);
    assert.equal(assertion, null, `${name} contains a TypeScript cast`);
  }
  const manifest = await readJson(path.join(FIXTURE, ".nextjshx/manifest.json"));
  assert.deepEqual(
    manifest.outputs.map((output) => output.path),
    [
      "app/@modal/(.)photo/[id]/page.tsx",
      "app/@modal/default.tsx",
      "app/api/echo/[id]/route.ts",
      "app/feed/page.tsx",
      "app/haxe/page.tsx",
      "app/layout.tsx",
      "app/photo/[id]/page.tsx",
      "app/products/[slug]/page.tsx",
      "app/special/error/error.tsx",
      "app/special/loading/loading.tsx",
      "app/special/not-found/not-found.tsx",
      "proxy.ts",
    ],
    "the ownership manifest must contain exactly the twelve generated convention adapters",
  );
}

async function verifyBuild(bundlerFlag) {
  await removeGeneratedState();
  await verifyToolchain();
  await verifyAuthoredTypes();
  await run(process.execPath, ["tools/cli/scripts/ensure-build.mjs", "runtime"]);
  const createdLinks = await linkWorkspaceDependencies();
  try {
    await run(
      process.execPath,
      [CLI_BIN, "build", "--", bundlerFlag],
      { cwd: FIXTURE },
    );
    await verifyGeneratedOutput();
    await verifyOwnedAdapters();
    await fs.access(path.join(FIXTURE, ".next/BUILD_ID"));
    console.log(`[next-stable] nextjshx build (${bundlerFlag}): OK`);
  } finally {
    await removeCliOwnedSourceState();
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
  assert(address !== null && typeof address !== "string", "could not reserve a loopback port");
  const { port } = address;
  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  return port;
}

async function stopServer(child, exitPromise) {
  if (child.exitCode !== null || child.signalCode !== null) {
    return;
  }
  child.kill("SIGTERM");
  const stopped = await Promise.race([
    exitPromise.then(() => true),
    new Promise((resolve) => setTimeout(() => resolve(false), 5_000)),
  ]);
  if (!stopped && child.exitCode === null && child.signalCode === null) {
    child.kill("SIGKILL");
    await exitPromise;
  }
}

async function streamedLoadingProof(port) {
  const response = await fetch(`http://127.0.0.1:${port}/special/loading`, {
    headers: { accept: "text/html" },
    signal: AbortSignal.timeout(15_000),
  });
  assert.equal(response.status, 200, "the loading proof route failed");
  assert(response.body !== null, "the loading proof response has no stream");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let html = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      html += decoder.decode();
      break;
    }
    html += decoder.decode(value, { stream: true });
  }
  const fallback = html.indexOf('id="haxe-loading"');
  const resolved = html.indexOf('id="loading-resolved"');
  assert(fallback >= 0, "the streamed response never rendered the Haxe loading fallback");
  assert(resolved >= 0, "the streamed response never resolved the native proof page");
  assert(fallback < resolved, "the loading fallback did not precede the resolved page bytes");
  assert(html.includes("HAXE-LOADING-FALLBACK"), "the loading fallback lost its Haxe content");
  assert(html.includes("LOADING-RESOLVED"), "the loading proof lost its resolved content");
  console.log("[next-stable] smoke: OK: loading.tsx streamed before the resolved page");
}

async function notFoundProof(port) {
  const response = await fetch(`http://127.0.0.1:${port}/special/not-found`, {
    headers: { accept: "text/html" },
    signal: AbortSignal.timeout(10_000),
  });
  assert.equal(response.status, 404, "the not-found proof must retain Next's HTTP 404 status");
  const html = await response.text();
  assert(html.includes("haxe-not-found"), "the 404 response lost the Haxe not-found payload");
  assert(html.includes("HAXE-NOT-FOUND"), "the 404 response lost the Haxe not-found content");
  console.log("[next-stable] smoke: OK: not-found.tsx retained its Haxe payload and HTTP 404");
}

async function staticParamsProof(port) {
  const generated = await fetch(`http://127.0.0.1:${port}/products/second`, {
    headers: { accept: "text/html" },
    signal: AbortSignal.timeout(10_000),
  });
  assert.equal(generated.status, 200, "the second Haxe-generated static param was not routable");
  const generatedHtml = await generated.text();
  assert(
    generatedHtml.includes('id="haxe-product-page"'),
    "the second generated product route lost its Haxe page",
  );

  const absent = await fetch(`http://127.0.0.1:${port}/products/not-generated`, {
    headers: { accept: "text/html" },
    signal: AbortSignal.timeout(10_000),
  });
  assert.equal(
    absent.status,
    404,
    "dynamicParams: false must reject a slug omitted from Haxe generateStaticParams",
  );
  console.log(
    "[next-stable] smoke: OK: generateStaticParams served two Haxe slugs and rejected an absent slug",
  );
}

async function browserExecutable() {
  const configured = process.env.NEXTJSHX_CHROME;
  if (configured !== undefined && !path.isAbsolute(configured)) {
    throw new Error("NEXTJSHX_CHROME must be an absolute browser executable path");
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
  throw new Error(
    "no system Chrome/Chromium executable found; set NEXTJSHX_CHROME to an absolute path",
  );
}

async function browserNavigationProofs(port) {
  const executablePath = await browserExecutable();
  const browser = await chromium.launch({
    executablePath,
    headless: true,
    args: ["--disable-dev-shm-usage", "--no-sandbox"],
  });
  try {
    const topologyPage = await browser.newPage();
    await topologyPage.goto(`http://127.0.0.1:${port}/feed`, {
      waitUntil: "networkidle",
      timeout: 20_000,
    });
    await topologyPage.locator("#feed-page").waitFor({ state: "visible", timeout: 10_000 });
    await topologyPage.locator("#modal-default").waitFor({ state: "visible", timeout: 10_000 });
    assert.equal(
      await topologyPage.locator("#photo-modal, #canonical-photo").count(),
      0,
      "the initial feed rendered a photo view before navigation",
    );

    await Promise.all([
      topologyPage.waitForURL(`http://127.0.0.1:${port}/photo/42`, {
        waitUntil: "networkidle",
        timeout: 20_000,
      }),
      topologyPage.locator("#open-photo").click(),
    ]);
    await topologyPage.locator("#photo-modal").waitFor({ state: "visible", timeout: 10_000 });
    await topologyPage.locator("#feed-page").waitFor({ state: "visible", timeout: 10_000 });
    assert.equal(
      await topologyPage.locator("#canonical-photo, #modal-default").count(),
      0,
      "soft navigation did not preserve the feed behind only the intercepted modal",
    );

    await topologyPage.reload({ waitUntil: "networkidle", timeout: 20_000 });
    await topologyPage.locator("#canonical-photo").waitFor({ state: "visible", timeout: 10_000 });
    await topologyPage.locator("#modal-default").waitFor({ state: "visible", timeout: 10_000 });
    assert.equal(
      await topologyPage.locator("#feed-page, #photo-modal").count(),
      0,
      "hard navigation did not select the canonical photo page and default modal slot",
    );
    await topologyPage.close();
    console.log(
      "[next-stable] smoke: OK: intercepted photo used a modal on soft navigation and the canonical page after reload",
    );

    const notFoundPage = await browser.newPage();
    const notFoundResponse = await notFoundPage.goto(
      `http://127.0.0.1:${port}/special/not-found`,
      { waitUntil: "networkidle", timeout: 20_000 },
    );
    assert.equal(notFoundResponse?.status(), 404, "browser navigation lost the 404 status");
    await notFoundPage
      .locator("#haxe-not-found")
      .waitFor({ state: "visible", timeout: 10_000 });
    assert.equal(
      await notFoundPage.locator("#haxe-not-found").textContent(),
      "HAXE-NOT-FOUND",
      "the hydrated browser view lost the Haxe not-found content",
    );
    await notFoundPage.close();
    console.log("[next-stable] smoke: OK: browser rendered the Haxe not-found view");

    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${port}/special/error`, {
      waitUntil: "networkidle",
      timeout: 20_000,
    });
    const trigger = page.locator("#trigger-error");
    await trigger.waitFor({ state: "visible", timeout: 10_000 });
    await trigger.click();
    const boundary = page.locator("#haxe-error-boundary");
    await boundary.waitFor({ state: "visible", timeout: 10_000 });
    assert(
      (await page.locator("#haxe-error-message").textContent())?.includes(
        "RESETTABLE-HAXE-BOUNDARY",
      ),
      "the Haxe error view lost the typed Error message",
    );
    await page.waitForTimeout(900);
    await page.locator("#haxe-error-reset").click();
    await page.locator("#error-proof-ready").waitFor({ state: "visible", timeout: 10_000 });
    assert.equal(await boundary.count(), 0, "the typed reset callback did not clear the boundary");
    console.log("[next-stable] smoke: OK: error.tsx caught and reset a client render failure");
  } finally {
    await browser.close();
  }
}

async function smoke() {
  await verifyToolchain();
  await fs.access(path.join(FIXTURE, ".next/BUILD_ID"));
  const port = await reservePort();
  const child = spawn(
    process.execPath,
    [NEXT_BIN, "start", FIXTURE, "--hostname", "127.0.0.1", "--port", String(port)],
    {
      cwd: ROOT,
      env: COMMAND_ENV,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let output = "";
  for (const stream of [child.stdout, child.stderr]) {
    stream.setEncoding("utf8");
    stream.on("data", (chunk) => {
      output += chunk;
      process.stdout.write(chunk);
    });
  }
  const exitPromise = new Promise((resolve) => child.once("exit", resolve));

  try {
    for (const route of ["/", "/haxe", "/products/first"]) {
      const deadline = Date.now() + 30_000;
      let response;
      let lastError;
      while (Date.now() < deadline) {
        if (child.exitCode !== null || child.signalCode !== null) {
          throw new Error(`Next production server exited before GET ${route}:\n${output}`);
        }
        try {
          response = await fetch(`http://127.0.0.1:${port}${route}`, {
            signal: AbortSignal.timeout(2_000),
          });
          if (response.ok) {
            break;
          }
          lastError = new Error(`HTTP ${response.status}`);
        } catch (error) {
          lastError = error;
        }
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
      assert(response?.ok, `production server did not serve ${route}: ${lastError}`);
      const html = await response.text();
      if (route === "/") {
        assert.equal(
          response.headers.get("x-nextjshx-proxy"),
          null,
          "the matcher unexpectedly ran the Haxe proxy for the native root",
        );
      } else {
        assert.equal(
          response.headers.get("x-nextjshx-proxy"),
          route,
          `the Haxe proxy did not expose the matched pathname for ${route}`,
        );
      }
      assert(html.includes('id="nextjshx-fixture"'), `${route} lost the Haxe marker`);
      assert(html.includes("Haxe → genes-ts → Next.js"), `${route} lost the Haxe content`);
      if (route === "/") {
        assert(html.includes('id="native-root"'), "/ lost its native TypeScript page child");
        assert(
          html.includes("This root page remains native TypeScript."),
          "/ lost its native TypeScript page content",
        );
      } else if (route === "/haxe") {
        assert(html.includes('id="haxe-page"'), "/haxe lost its generated Haxe page child");
        assert(
          html.includes("This page implementation originated in typed Haxe."),
          "/haxe lost its generated Haxe page content",
        );
        assert(
          html.includes("<title>Static metadata from Haxe</title>"),
          "/haxe lost its static Haxe metadata title",
        );
        assert(
          html.includes('id="typed-query-link"') &&
            html.includes('/products/first?page=2&amp;tag=haxe+next&amp;tag=typed'),
          "/haxe lost its deterministic typed-query link",
        );
      } else {
        assert(
          html.includes('id="haxe-product-page"'),
          "/products/first lost its generated Haxe page child",
        );
        assert(
          html.includes("This product page and its static route list originated in typed Haxe."),
          "/products/first lost its generated Haxe page content",
        );
        assert(
          html.includes("<title>Generated product metadata from Haxe</title>"),
          "/products/first lost its generated Haxe metadata title",
        );
      }
      console.log(`[next-stable] smoke: OK: GET ${route} returned ${response.status}`);
    }

    await streamedLoadingProof(port);
    await notFoundProof(port);
    await staticParamsProof(port);
    await browserNavigationProofs(port);

    const get = await fetch(`http://127.0.0.1:${port}/api/echo/alpha`);
    assert.equal(get.status, 200, "GET Route Handler failed");
    assert.equal(await get.text(), "GET:alpha", "GET Route Handler lost typed params");
    console.log("[next-stable] smoke: OK: GET /api/echo/alpha returned 200");

    const post = await fetch(`http://127.0.0.1:${port}/api/echo/beta`, { method: "POST" });
    assert.equal(post.status, 200, "POST Route Handler failed");
    assert.deepEqual(
      await post.json(),
      { method: "POST", id: "beta" },
      "POST Route Handler lost its typed JSON body",
    );
    console.log("[next-stable] smoke: OK: POST /api/echo/beta returned typed JSON");

    const remove = await fetch(`http://127.0.0.1:${port}/api/echo/gamma`, {
      method: "DELETE",
    });
    assert.equal(remove.status, 200, "DELETE Route Handler failed");
    assert.equal(await remove.text(), "DELETE", "DELETE Route Handler returned unexpected bytes");
    console.log("[next-stable] smoke: OK: DELETE /api/echo/gamma returned 200");
  } finally {
    await stopServer(child, exitPromise);
  }
}

const mode = process.argv[2] ?? "verify";
const trailingArguments = process.argv.slice(3);
switch (mode) {
  case "verify":
    if (trailingArguments.length > 1) {
      throw new Error("verify accepts at most one bundler flag");
    }
    {
      const bundlerFlag = trailingArguments[0] ?? "--turbopack";
      if (bundlerFlag !== "--turbopack" && bundlerFlag !== "--webpack") {
        throw new Error(
          `unsupported stable fixture bundler ${bundlerFlag}; expected --turbopack or --webpack`,
        );
      }
      await verifyBuild(bundlerFlag);
    }
    break;
  case "smoke":
    if (trailingArguments.length !== 0) {
      throw new Error("smoke does not accept additional arguments");
    }
    await smoke();
    break;
  case "clean":
    if (trailingArguments.length !== 0) {
      throw new Error("clean does not accept additional arguments");
    }
    await removeGeneratedState();
    console.log("[next-stable] clean: OK");
    break;
  default:
    throw new Error(`unknown mode ${mode}; expected verify, smoke, or clean`);
}
