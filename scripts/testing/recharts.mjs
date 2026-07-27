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
const FIXTURE = path.join(ROOT, "tests/recharts");
const OUTPUT = path.join(FIXTURE, ".tmp/typescript");
const REJECTED = path.join(FIXTURE, ".tmp/rejected.tsx");
const ANSI_ESCAPE = /\u001b\[[0-?]*[ -/]*[@-~]/g;

const NEGATIVE_CASES = new Map([
  [
    "category-as-series",
    {
      main: "recharts_fixture.CategoryAsSeries",
      diagnostic:
        "tests/recharts/src/recharts_fixture/CategoryAsSeries.hx:13: characters 24-54 : [GTS-HXX-PROP-002] component `Bar` property `dataKey` expects `nextjs.raw.integrations.recharts.StackedBarSeriesKey` but received `nextjs.raw.integrations.recharts.StackedBarCategoryKey`.",
    },
  ],
  [
    "incomplete-row",
    {
      main: "recharts_fixture.IncompleteRow",
      diagnostic: `tests/recharts/src/recharts_fixture/IncompleteRow.hx:6: characters 44-72 : Object requires field secondary
tests/recharts/src/recharts_fixture/IncompleteRow.hx:6: characters 2-73 : { primary : Int, category : String } should be nextjs.raw.integrations.recharts.StackedBarDatum
tests/recharts/src/recharts_fixture/IncompleteRow.hx:6: characters 2-73 : ... { primary : Int, category : String } has no field secondary`,
    },
  ],
  [
    "series-as-category",
    {
      main: "recharts_fixture.SeriesAsCategory",
      diagnostic:
        "tests/recharts/src/recharts_fixture/SeriesAsCategory.hx:14: characters 51-78 : [GTS-HXX-PROP-002] component `YAxis` property `dataKey` expects `nextjs.raw.integrations.recharts.StackedBarCategoryKey` but received `nextjs.raw.integrations.recharts.StackedBarSeriesKey`.",
    },
  ],
  [
    "wrong-bar-size",
    {
      main: "recharts_fixture.WrongBarSize",
      diagnostic:
        "tests/recharts/src/recharts_fixture/WrongBarSize.hx:13: characters 53-67 : [GTS-HXX-PROP-002] component `Bar` property `barSize` expects `Int` but received `String`.",
    },
  ],
]);

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

class RechartsFailure extends Error {}

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
    throw new RechartsFailure(
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
  run("haxe", ["tests/recharts/build-positive.hxml"]);
  const first = digestTree(OUTPUT);
  run("haxe", ["tests/recharts/build-positive.hxml"]);
  assert.deepEqual(digestTree(OUTPUT), first, "Recharts generated output was not deterministic");

  const positive = fs.readFileSync(
    path.join(OUTPUT, "recharts_fixture/Positive.tsx"),
    "utf8",
  );
  assert(positive.includes('import {BarChart, CartesianGrid, XAxis, YAxis, Bar} from "recharts"'));
  assert(
    positive.includes(
      '<BarChart data={model.rows} responsive accessibilityLayer layout="vertical" className="priority-runway"',
    ),
  );
  assert(positive.includes('<YAxis type="category" dataKey="category"'));
  assert(positive.includes('<XAxis type="number" allowDecimals={false} axisLine={false} tickLine={false} tickCount={2} />'));
  assert.equal((positive.match(/<Bar dataKey=/g) ?? []).length, 2);
  assert(!positive.includes("Tooltip"));
  assert(!positive.includes("ResponsiveContainer"));

  const semantic = fs.readFileSync(
    path.join(OUTPUT, "nextjs/integrations/recharts/StackedBars.tsx"),
    "utf8",
  );
  assert(semantic.includes('key: "primary" | "secondary"'));
  assert(semantic.includes('{"category": category, "primary": primary, "secondary": secondary}'));
  for (const [name, source] of [
    ["positive", positive],
    ["semantic", semantic],
  ]) {
    assert(
      !/\b(?:Dynamic|any|unknown|untyped|Reflect)\b|\sas\s|__cast|Register\.unsafeCast/.test(source),
      `${name} output contains a broad or unchecked escape`,
    );
  }

  run("node_modules/.bin/tsc6", ["--project", "tests/recharts/tsconfig.json", "--noEmit"]);
}

function verifyNegatives() {
  for (const [name, expected] of NEGATIVE_CASES) {
    fs.rmSync(REJECTED, { force: true });
    const output = run(
      "haxe",
      ["tests/recharts/build-negative.hxml", "-main", expected.main],
      { expectedStatus: 1 },
    );
    assert.equal(normalized(output), expected.diagnostic, name);
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
  const positivePath = path.join(OUTPUT, "recharts_fixture/Positive.tsx");
  const positive = await REACT_LINTER.lintText(fs.readFileSync(positivePath, "utf8"), {
    filePath: positivePath,
  });
  assert.equal(
    positive.reduce((total, result) => total + result.errorCount, 0),
    0,
    lintFailure(positive),
  );

  const negative = await REACT_LINTER.lintText(
    `
import { useState } from "react";

export function BrokenChart(props: { enabled: boolean }) {
  if (props.enabled) {
    useState(0);
  }
  return <p>Broken chart</p>;
}
`,
    { filePath: path.join(FIXTURE, ".tmp/react-lint-negative.tsx") },
  );
  assert(
    negative
      .flatMap((result) => result.messages)
      .some((message) => message.ruleId === "react-hooks/rules-of-hooks"),
    "official React lint missed the conditional Hook control",
  );
}

try {
  clean();
  assert.equal(run("haxe", ["--version"]).trim(), "4.3.7");
  verifyPositive();
  verifyNegatives();
  await verifyReactLint();
  console.log(
    `[recharts] OK: deterministic direct TSX, strict TypeScript, official React lint, and ${NEGATIVE_CASES.size} exact Haxe negatives`,
  );
} catch (error) {
  console.error(`[recharts] ERROR: ${error.message}`);
  process.exitCode = 1;
}
