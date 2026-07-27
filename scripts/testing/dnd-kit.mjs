#!/usr/bin/env node

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import typescriptParser from "@typescript-eslint/parser";
import { ESLint } from "eslint";
import reactHooks from "eslint-plugin-react-hooks";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const FIXTURE = path.join(ROOT, "tests/dnd-kit");
const OUTPUT = path.join(FIXTURE, ".tmp/typescript");
const REJECTED = path.join(FIXTURE, ".tmp/rejected.tsx");
const ANSI_ESCAPE = /\u001b\[[0-?]*[ -/]*[@-~]/g;
const REACT_LINT_POSITIVE = path.join(OUTPUT, "dnd_kit/Positive.tsx");

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
      rules: { "react-hooks/rules-of-hooks": "error" },
    },
  ],
});

const NEGATIVE_CASES = new Map([
  [
    "wrong-id",
    `tests/dnd-kit/src/dnd_kit/WrongId.hx:9: characters 22-24 : Int should be String
tests/dnd-kit/src/dnd_kit/WrongId.hx:9: characters 22-24 : ... For function argument 'id'`,
  ],
  [
    "wrong-index",
    `tests/dnd-kit/src/dnd_kit/WrongIndex.hx:9: characters 26-33 : String should be Int
tests/dnd-kit/src/dnd_kit/WrongIndex.hx:9: characters 26-33 : ... For function argument 'index'`,
  ],
  [
    "wrong-callback",
    "tests/dnd-kit/src/dnd_kit/WrongCallback.hx:14: characters 39-47 : [GTS-HXX-PROP-002] component `DragDropProvider` property `onDragEnd` expects `nextjs.raw.integrations.dndkit.DragEndEvent -> Void` but received `(label : String) -> Void`.",
  ],
  [
    "wrong-ref-value",
    "tests/dnd-kit/src/dnd_kit/WrongRefValue.hx:12: characters 14-23 : [GTS-HXX-PROP-002] <li> property `ref` expects `genes.ts.Undefinable<genes.react.ReactRef<genes.react.DomElement>>` but received `String`.",
  ],
  [
    "wrong-ref-target",
    "tests/dnd-kit/src/dnd_kit/WrongRefTarget.hx:13: characters 19-28 : [GTS-HXX-PROP-002] <li> property `ref` expects `genes.ts.Undefinable<genes.react.ReactRef<genes.react.DomElement>>` but received `(_element : Null<HTMLInputElement>) -> Void`.",
  ],
  [
    "outside-hook",
    "tests/dnd-kit/src/dnd_kit/OutsideHook.hx:8: characters 3-32 : [NXHX-REACT-HOOK-0001] Reviewed React Hook nextjshx.integrations.dndkit.DndKitHookBindings.useSortable may only be called from a @:next.clientComponent render or an @:next.hook function. Mark a genuine custom Hook with @:next.hook; keep ordinary helpers Hook-free.",
  ],
]);

const HXX_NEGATIVE_MAINS = new Map([
  ["wrong-callback", "dnd_kit.WrongCallback"],
  ["wrong-ref-value", "dnd_kit.WrongRefValue"],
  ["wrong-ref-target", "dnd_kit.WrongRefTarget"],
]);

class DndKitFailure extends Error {}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    encoding: "utf8",
    env: { ...process.env, CI: "1", NO_COLOR: "1" },
    maxBuffer: 32 * 1024 * 1024,
  });
  if (result.error !== undefined) {
    throw result.error;
  }
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  const expectedStatus = options.expectedStatus ?? 0;
  if (result.status !== expectedStatus) {
    throw new DndKitFailure(
      `${command} ${args.join(" ")} exited ${result.status}; expected ${expectedStatus}:\n${output}`,
    );
  }
  return output;
}

function walk(directory) {
  return fs
    .readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const child = path.join(directory, entry.name);
      return entry.isDirectory() ? walk(child) : [child];
    })
    .sort((left, right) => left.localeCompare(right, "en"));
}

function digestTree(directory) {
  return walk(directory).map((file) => {
    const relative = path.relative(directory, file).replaceAll("\\", "/");
    const digest = crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
    return `${relative}:${digest}`;
  });
}

function normalized(output) {
  return output
    .replace(ANSI_ESCAPE, "")
    .replaceAll("\\", "/")
    .replaceAll(`${ROOT.replaceAll("\\", "/")}/`, "")
    .trim();
}

function clean() {
  fs.rmSync(path.join(FIXTURE, ".tmp"), { recursive: true, force: true });
}

function verifyPositive() {
  run("haxe", ["tests/dnd-kit/build-positive.hxml"]);
  const first = digestTree(OUTPUT);
  run("haxe", ["tests/dnd-kit/build-positive.hxml"]);
  assert.deepEqual(digestTree(OUTPUT), first, "dnd-kit generated output was not deterministic");

  const positive = fs.readFileSync(path.join(OUTPUT, "dnd_kit/Positive.tsx"), "utf8");
  assert(positive.includes('import {useSortable} from "@dnd-kit/react/sortable"'));
  assert(positive.includes('import {DragDropProvider} from "@dnd-kit/react"'));
  assert(positive.includes('useSortable({"id": id, "index": index})'));
  assert(positive.includes('useSortable({"id": 42.0, "index": index})'));
  assert(positive.includes("<li ref={ref}>Checked sortable row</li>"));
  assert.match(
    positive,
    /function useSemantic\([^]*?return useSortable\(\{"id": id, "index": index\}\);[^]*?export class Positive/,
    "the reviewed Haxe Hook body must be a genuine analyzer-visible module function",
  );
  assert.match(positive, /Positive\.useSemantic = useSemantic;/);
  assert.match(positive, /Positive\.useRawNumeric = useRawNumeric;/);
  assert(
    positive.indexOf("Positive.useSemantic = useSemantic;") <
      positive.indexOf('Register.setHxClass("dnd_kit.Positive", Positive);'),
    "the final Hook identity must be installed before Haxe registration",
  );
  assert(!/\b(?:Dynamic|any|unknown|untyped|Reflect)\b|\sas\s|__cast|Register\.unsafeCast/.test(positive));

  const semantic = fs.readFileSync(
    path.join(OUTPUT, "nextjs/integrations/dndkit/DndKit.tsx"),
    "utf8",
  );
  assert(semantic.includes('import {arrayMove} from "@dnd-kit/helpers"'));
  assert(semantic.includes('typeof(id) != "string"'));
  assert(!/\b(?:Dynamic|any|unknown|untyped|Reflect)\b|\sas\s|__cast|Register\.unsafeCast/.test(semantic));

  run("tsc6", ["--project", "tests/dnd-kit/tsconfig.json"]);
}

function verifyNegatives() {
  for (const [name, expected] of NEGATIVE_CASES) {
    fs.rmSync(REJECTED, { force: true });
    const main = HXX_NEGATIVE_MAINS.get(name) ?? "dnd_kit.NegativeMain";
    const output = run(
      "haxe",
      [
        "tests/dnd-kit/build-negative.hxml",
        "-main",
        main,
        "-D",
        `dnd_kit_case=${name}`,
      ],
      { expectedStatus: 1 },
    );
    assert.equal(normalized(output), expected, name);
    assert.equal(fs.existsSync(REJECTED), false, `${name} emitted rejected TSX`);
  }
}

function lintFailure(results) {
  return results
    .flatMap((result) =>
      result.messages.map(
        (message) =>
          `${path.relative(ROOT, result.filePath)}:${message.line}:${message.column} ${message.ruleId}: ${message.message}`,
      ),
    )
    .join("\n");
}

async function verifyReactLint() {
  const positive = await REACT_LINTER.lintText(fs.readFileSync(REACT_LINT_POSITIVE, "utf8"), {
    filePath: REACT_LINT_POSITIVE,
  });
  assert.equal(
    positive.reduce((total, result) => total + result.errorCount, 0),
    0,
    lintFailure(positive),
  );

  const negative = await REACT_LINTER.lintText(
    `
import { useSortable } from "@dnd-kit/react/sortable";

export function BrokenSortable(props: { enabled: boolean; id: string }) {
  if (props.enabled) {
    useSortable({ id: props.id, index: 0 });
  }
  return <p>{props.id}</p>;
}
`,
    { filePath: path.join(FIXTURE, ".tmp/react-lint-negative.tsx") },
  );
  assert(
    negative.flatMap((result) => result.messages).some((message) => message.ruleId === "react-hooks/rules-of-hooks"),
    "official React lint missed the conditional dnd-kit Hook control",
  );
}

try {
  clean();
  assert.equal(run("haxe", ["--version"]).trim(), "4.3.7");
  verifyPositive();
  verifyNegatives();
  await verifyReactLint();
  console.log(
    `[dnd-kit] OK: deterministic analyzer-visible Haxe Hooks, strict TS, official React lint controls, and ${NEGATIVE_CASES.size} exact Haxe negatives`,
  );
} catch (error) {
  console.error(`[dnd-kit] ERROR: ${error.message}`);
  process.exitCode = 1;
}
