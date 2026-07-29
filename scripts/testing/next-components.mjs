#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const FIXTURE = path.join(ROOT, "tests/next-components");
const OUTPUT = path.join(FIXTURE, ".tmp");
const TSC = path.join(ROOT, "node_modules/typescript/bin/tsc6");

class NextComponentsFailure extends Error {}

function run(command, args, expectedStatus = 0) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    encoding: "utf8",
    env: { ...process.env, CI: "1", NO_COLOR: "1", NEXT_TELEMETRY_DISABLED: "1" },
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.error !== undefined) {
    throw result.error;
  }
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  if (result.status !== expectedStatus) {
    throw new NextComponentsFailure(
      `${path.basename(command)} ${args.join(" ")} exited ${result.status}; expected ${expectedStatus}:\n${output}`,
    );
  }
  return output;
}

function emitted(relative) {
  const file = path.join(OUTPUT, ...relative.split("/"));
  assert(fs.statSync(file).isFile(), `${relative} must be emitted`);
  return fs.readFileSync(file, "utf8");
}

function collectFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    return entry.isDirectory() ? collectFiles(absolute) : [absolute];
  });
}

function verifyPositiveOutput() {
  const consumer = emitted("next_components/ComponentConsumer.tsx");
  const semanticConsumer = emitted("next_components/SemanticComponentConsumer.tsx");
  const directImports = [
    /import Script from "next\/script"/,
    /import Link from "next\/link"/,
    /import \{useLinkStatus\} from "next\/link"/,
    /import Image from "next\/image"/,
    /import \{getImageProps\} from "next\/image"/,
    /import Form from "next\/form"/,
    /import \w+ from "next\/dynamic"/,
    /import \w+ from "next\/font\/local"/,
    /import \{Inter, Roboto\} from "next\/font\/google"/,
    /import \{Suspense\} from "react"/,
  ];
  for (const expected of directImports) {
    assert.match(consumer, expected, `direct public import is missing: ${expected}`);
  }

  const runtimeImports = consumer
    .split("\n")
    .filter((line) => /^import (?!type\b)/.test(line))
    .join("\n");
  for (const localWrapper of [
    "nextjs/raw/DynamicComponent",
    "nextjs/raw/components/Form",
    "nextjs/raw/components/Image",
    "nextjs/raw/components/Script",
    "nextjs/raw/font/Google",
    "nextjs/raw/font/Local",
  ]) {
    assert(!runtimeImports.includes(localWrapper), `${localWrapper} became a runtime wrapper import`);
  }

  for (const evidence of [
		"<Link href={props.href} prefetch={props.prefetch}",
    "<Image {...image} />",
		"<Form action={form_action}",
		'<Script src="https://example.test/widget.js" strategy="lazyOnload"',
    "useLinkStatus()",
    "getImageProps(",
    "load(options)",
    "Inter(options)",
    "Roboto(options)",
    "load__1(options)",
    "import('next/link').LinkProps<string>",
		"import type {ImageProps}",
		"import type {SyncFormAction, AsyncFormAction}",
    "import('next/dynamic').DynamicOptions<CardProps>",
    "import('next/font/google').Inter",
    "import('next/font/google').Roboto",
    "import('next/font/local').default",
		"static scriptCallbacks(): ScriptProps",
		'<Suspense fallback={fallback} name="inventory">',
  ]) {
    assert(consumer.includes(evidence), `positive fixture did not exercise ${evidence}`);
  }
  assert.match(consumer, /variable: `--\$\{string\}`/);
  assert.match(consumer, /<Card label="Loaded" \/>/);

  for (const expected of [
    /import NextLink from "next\/link"/,
    /import NextImage from "next\/image"/,
    /import NextForm from "next\/form"/,
    /import NextScript from "next\/script"/,
		/<NextLink href="\/products">Products<\/NextLink>/,
		/<a href="\/documentation">Documentation zone<\/a>/,
    /<NextImage \{\.\.\.image\} \/>/,
		/<NextForm action=\{form_action\}>/,
		/<NextScript src="https:\/\/example\.test\/widget\.js" strategy="afterInteractive" \/>/,
  ]) {
    assert.match(semanticConsumer, expected, `semantic JSX-safe component drifted: ${expected}`);
  }
  for (const intrinsicCollision of ["<link ", "<img ", "<form ", "<script "]) {
    assert(
      !semanticConsumer.includes(intrinsicCollision),
      `semantic component regressed to intrinsic ${intrinsicCollision.trim()}`,
    );
  }

  const curatedOutput = collectFiles(path.join(OUTPUT, "nextjs", "raw"))
    .filter((file) => file.endsWith(".tsx"))
    .map((file) => fs.readFileSync(file, "utf8"))
    .join("\n");
	assert.match(
		curatedOutput,
		/export type SyncFormAction = \(\(arg0: globalThis\.FormData\) => void\)/,
		"synchronous next/form actions must use the current Web FormData contract",
	);
	assert.match(
		curatedOutput,
		/export type AsyncFormAction = \(\(arg0: globalThis\.FormData\) => globalThis\.Promise<void>\)/,
		"asynchronous next/form actions must use the current Web FormData contract",
	);
  const publicBoundary = `${consumer}\n${curatedOutput}`;
	assert(
		curatedOutput.includes("export type ImageProps = import('next/image').ImageProps"),
		"Haxe-visible Image props lost their exact public Next TypeScript identity",
	);
	assert(
		curatedOutput.includes("export type ScriptProps = Omit<import('next/script').ScriptProps"),
		"Haxe-visible Script props lost their decoded public Next TypeScript identity",
	);
  assert(!publicBoundary.includes("next/dist"), "B04 emitted a private Next import");
  assert(!/\bany\b/.test(publicBoundary), "B04 widened a boundary to TypeScript any");
}

function verifyHaxeFailures() {
  const cases = [
    ["tests/next-components/build-negative-link.hxml", /Object requires field href/],
    ["tests/next-components/build-negative-image.hxml", /Object requires field alt/],
    ["tests/next-components/build-negative-form.hxml", /Bool should be Null<nextjs\.raw\.components\.FormPrefetch>/],
    ["tests/next-components/build-negative-script.hxml", /String should be Null<nextjs\.raw\.components\.ScriptStrategy>/],
    ["tests/next-components/build-negative-font.hxml", /String should be nextjs\.raw\.font\.InterAxis/],
  ];
  for (const [build, diagnostic] of cases) {
    assert.match(run("haxe", [build], 1), diagnostic, `${build} diagnostic drifted`);
  }

	const hxxCases = [
		["hxx_missing_link_href", /\[GTS-HXX-PROP-004\].*missing required property `href`/],
		["hxx_missing_image_alt", /\[GTS-HXX-PROP-004\].*missing required property `alt`/],
		["hxx_missing_form_action", /\[GTS-HXX-PROP-004\].*missing required property `action`/],
		["hxx_wrong_script_strategy", /\[GTS-HXX-PROP-002\].*property `strategy` expects .*ScriptStrategy.*received `String`/],
		["hxx_missing_component_prop", /\[GTS-HXX-PROP-004\].*missing required property `label`/],
		["hxx_cross_zone_next_link", /\[GTS-HXX-PROP-002\].*property `href` expects .*SameZoneHref.*received `nextjs\.route\.CrossZoneHref`/],
		["hxx_same_zone_double_quote", /\[NXHX-NAV-SAME-ZONE-0001\].*must not contain whitespace, controls, backslashes, or quotes/],
	];
	const output = path.join(OUTPUT, "negative-hxx.tsx");
	for (const [define, diagnostic] of hxxCases) {
		fs.rmSync(output, {force: true});
		assert.match(
			run("haxe", ["tests/next-components/build-negative-hxx.hxml", "-D", define], 1),
			diagnostic,
			`${define} Haxe-first component diagnostic drifted`,
		);
		assert(!fs.existsSync(output), `${define} committed TSX after Haxe rejected HXX`);
	}
}

function verifyTypeScriptOracleFailures() {
  const diagnostics = run(
    TSC,
    ["--project", "tests/next-components/tsconfig.invalid.json", "--pretty", "false"],
    2,
  );
  for (const expected of [
    /"font-inter".*not assignable to type '`--\$\{string\}`'/,
    /Property 'href' is missing/,
    /Property 'alt' is missing/,
    /Property 'action' is missing/,
    /Type '"idle"' is not assignable/,
    /Property 'label' is missing/,
  ]) {
    assert.match(diagnostics, expected, `strict TypeScript diagnostic drifted: ${expected}`);
  }
}

try {
  fs.rmSync(OUTPUT, { recursive: true, force: true });
  run("haxe", ["tests/next-components/build-typescript.hxml"]);
  verifyPositiveOutput();
  run(TSC, ["--project", "tests/next-components/tsconfig.json", "--pretty", "false"]);
  verifyHaxeFailures();
  verifyTypeScriptOracleFailures();
  console.log(
		"[next-components] OK: 18 direct-import exports, strict TSX parity, five structural plus seven HXX failures, and six native TypeScript controls",
  );
} catch (error) {
  console.error(`[next-components] ERROR: ${error.message}`);
  process.exitCode = 1;
} finally {
  fs.rmSync(OUTPUT, { recursive: true, force: true });
}
