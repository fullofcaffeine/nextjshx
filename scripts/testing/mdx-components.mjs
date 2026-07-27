#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

import Ajv2020 from "ajv/dist/2020.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const FIXTURE = path.join(ROOT, "tests/mdx-components");
const TEMP = path.join(FIXTURE, ".tmp");
const PLAN = path.join(TEMP, "plan.json");
const NEXT_APP = path.join(FIXTURE, "next-app");
const SCHEMA = path.join(ROOT, "schemas/adapter-plan.schema.json");
const CLI_INDEX = path.join(ROOT, "tools/cli/.tmp/src/index.js");
const GENERATED_ADAPTERS = [
  "app/_nextjshx/client/4253ae4e7f6d/SignalPlot.tsx",
  "mdx-components.tsx",
];
const NEGATIVE_CASES = new Map([
  [
    "empty",
    "[NXHX-MDX-COMPONENTS-0002] MDX registry mdx_components_negative.InvalidRegistry.components must directly return one closed object literal so every MDX name and component is checked at its Haxe source span.",
  ],
  [
    "lowercase",
    '[NXHX-MDX-COMPONENTS-0002] MDX component name "signalPlot" must be a PascalCase JSX identifier so local content cannot silently replace an intrinsic HTML element.',
  ],
  [
    "value",
    '[NXHX-MDX-COMPONENTS-0002] MDX component "SignalPlot" must be nextjs.raw.react.ComponentType<Props>; found String. Use an exact Haxe Client Component ref.',
  ],
  [
    "argument",
    "[NXHX-MDX-COMPONENTS-0002] MDX registry mdx_components_negative.InvalidRegistry.components must be a concrete, non-generic, zero-argument function.",
  ],
]);

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    encoding: "utf8",
    ...options,
  });
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} failed (${result.status})\n${result.stdout}${result.stderr}`,
    );
  }
  return `${result.stdout}${result.stderr}`;
}

function digest(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function writeRenderedOutput(output) {
  const target = path.join(NEXT_APP, output.path);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, output.content, "utf8");
}

function clean() {
  fs.rmSync(TEMP, { recursive: true, force: true });
  for (const relative of GENERATED_ADAPTERS) {
    fs.rmSync(path.join(NEXT_APP, relative), { force: true });
  }
  fs.rmSync(path.join(NEXT_APP, "app/_nextjshx"), {
    recursive: true,
    force: true,
  });
}

function verifyNegativeCases() {
  for (const [name, expected] of NEGATIVE_CASES) {
    const result = spawnSync(
      "haxe",
      [
        "tests/mdx-components/build-negative.hxml",
        "-D",
        `mdx_negative_${name}`,
      ],
      { cwd: ROOT, encoding: "utf8" },
    );
    const output = `${result.stdout}${result.stderr}`.trim();
    assert.notEqual(result.status, 0, `${name} unexpectedly compiled`);
    assert(
      output.includes(expected),
      `${name} did not emit its exact diagnostic\n${output}`,
    );
    assert(
      output.startsWith("tests/mdx-components/"),
      `${name} diagnostic lost its Haxe source position\n${output}`,
    );
  }
}

async function main() {
  clean();
  run("npm", ["run", "build", "--workspace", "@nextjshx/cli-internal"]);
  run("haxe", ["tests/mdx-components/build-positive.hxml"]);
  const first = {
    plan: digest(PLAN),
    registry: digest(
      path.join(TEMP, "typescript/mdx_components/AtlasMdxComponents.tsx"),
    ),
  };
  run("haxe", ["tests/mdx-components/build-positive.hxml"]);
  assert.deepEqual(
    {
      plan: digest(PLAN),
      registry: digest(
        path.join(TEMP, "typescript/mdx_components/AtlasMdxComponents.tsx"),
      ),
    },
    first,
    "MDX registry output changed across identical builds",
  );

  const planValue = JSON.parse(fs.readFileSync(PLAN, "utf8"));
  const schema = JSON.parse(fs.readFileSync(SCHEMA, "utf8"));
  const validate = new Ajv2020({ allErrors: true, strict: true }).compile(schema);
  assert(validate(planValue), JSON.stringify(validate.errors, null, 2));

  const { parseAdapterPlan, renderAdapterPlan } = await import(
    pathToFileURL(CLI_INDEX).href
  );
  const plan = parseAdapterPlan(planValue);
  assert.deepEqual(
    plan.intents.map((intent) => [intent.kind, intent.targetPath]),
    [
      [
        "client-component",
        "_nextjshx/client/4253ae4e7f6d/SignalPlot.tsx",
      ],
      ["mdx-components", "mdx-components.tsx"],
    ],
  );
  const outputs = renderAdapterPlan("app", plan);
  assert.deepEqual(
    outputs.map((output) => output.path),
    GENERATED_ADAPTERS,
  );
  for (const output of outputs) {
    writeRenderedOutput(output);
  }

  const registry = fs.readFileSync(
    path.join(NEXT_APP, "mdx-components.tsx"),
    "utf8",
  );
  assert(
    registry.includes(
      "export const useMDXComponents: typeof NextJsHxMdxRegistry.components = NextJsHxMdxRegistry.components;",
    ),
  );
  assert(!registry.includes("function useMDXComponents"));
  assert(!/\b(?:any|unknown)\b| as const|@ts-(?:ignore|nocheck)/.test(registry));

  run("tsc6", [
    "--project",
    "tests/mdx-components/next-app/tsconfig.json",
    "--noEmit",
  ]);
  verifyNegativeCases();
  clean();
  process.stdout.write(
    `mdx-components: OK: deterministic closed registry, strict TypeScript, ${NEGATIVE_CASES.size} exact Haxe failures, and root adapter rendering\n`,
  );
}

main().catch((error) => {
  clean();
  process.stderr.write(`${error.stack ?? error}\n`);
  process.exitCode = 1;
});
