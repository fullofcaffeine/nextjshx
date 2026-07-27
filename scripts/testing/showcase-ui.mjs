#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { ESLint } from "eslint";
import reactHooks from "eslint-plugin-react-hooks";
import typescriptParser from "@typescript-eslint/parser";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const FIXTURE = path.join(ROOT, "tests/showcase-ui");
const OUTPUT = path.join(FIXTURE, ".tmp");
const HXX_NEGATIVE_OUTPUT = path.join(OUTPUT, "negative-hxx.tsx");
const TSC = path.join(ROOT, "node_modules/typescript/bin/tsc6");
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
      rules: {
        "react-hooks/exhaustive-deps": "error",
        "react-hooks/purity": "error",
        "react-hooks/rules-of-hooks": "error",
      },
    },
  ],
});

class ShowcaseUiFailure extends Error {}

function run(command, args, expectedStatus = 0) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    encoding: "utf8",
    env: { ...process.env, CI: "1", NO_COLOR: "1" },
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.error !== undefined) {
    throw result.error;
  }
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  if (result.status !== expectedStatus) {
    throw new ShowcaseUiFailure(
      `${path.basename(command)} ${args.join(" ")} exited ${result.status}; expected ${expectedStatus}:\n${output}`,
    );
  }
  return output;
}

function verifyHaxeSurfaceSource() {
  const directory = path.join(ROOT, "examples/showcase-ui/haxe/showcase/ui");
  const sources = fs
    .readdirSync(directory)
    .filter((name) => name.endsWith(".hx"))
    .map((name) => fs.readFileSync(path.join(directory, name), "utf8"))
    .join("\n");

  for (const forbidden of [
    /\bDynamic\b/,
    /\bAny\b/,
    /\buntyped\b/,
    /genes\.ts\.Unknown/,
    /\bcast\b/,
  ]) {
    assert(!forbidden.test(sources), `shared Haxe UI surface contains ${forbidden}`);
  }
  for (const required of [
    "enum abstract BadgeVariant",
    "enum abstract ButtonVariant",
    "enum abstract ButtonSize",
    "enum abstract InputType",
    "enum abstract SeparatorOrientation",
    "enum abstract SheetSide",
    "enum abstract AriaHasPopup",
    "extern class Slot",
    "extern class SlottedBadge",
    "extern class SlottedButton",
    "extern class SlottedSheetClose",
    "extern class SlottedSheetTrigger",
    "extern class UiCommand",
    "extern class UiCommandDialog",
    "extern class UiCommandItem",
    "typedef UiCommandDialogProps",
    "typedef UiCommandItemProps",
    "typedef TextareaProps",
  ]) {
    assert(sources.includes(required), `shared Haxe UI surface lost ${required}`);
  }
}

function verifyEmittedTsx() {
  const file = path.join(OUTPUT, "showcase_ui/SurfaceConsumer.tsx");
  assert(fs.statSync(file).isFile(), "positive Haxe fixture must emit SurfaceConsumer.tsx");
  const emitted = fs.readFileSync(file, "utf8");

  for (const expected of [
    /import \{Badge\} from "@nextjshx\/showcase-ui\/badge"/,
    /import \{Button\} from "@nextjshx\/showcase-ui\/button"/,
    /import \{Slot\} from "@radix-ui\/react-slot"/,
    /import \{CardTitle, CardDescription, CardAction, CardHeader, CardContent, CardFooter, Card\} from "@nextjshx\/showcase-ui\/card"/,
    /import \{Input\} from "@nextjshx\/showcase-ui\/input"/,
    /import \{Separator\} from "@nextjshx\/showcase-ui\/separator"/,
    /import \{SheetTrigger, SheetTitle, SheetDescription, SheetHeader, SheetClose, SheetFooter, SheetContent, Sheet\} from "@nextjshx\/showcase-ui\/sheet"/,
    /from "@nextjshx\/showcase-ui\/command"/,
    /import \{Textarea\} from "@nextjshx\/showcase-ui\/textarea"/,
    /import \{ArrowUpRight\} from "@nextjshx\/showcase-ui\/icons"/,
    /<ArrowUpRight \{\.\.\.icon\} \/>/,
    /<Badge variant="outline" asChild>/,
    /<Slot className="contract-slot" onClick=/,
    /<Button variant="outline" size="sm" type="button" onClick=\{function \(event: import\('react'\)\.MouseEvent<HTMLButtonElement>\) \{\s+event\.preventDefault\(\);\s+\}\}>Continue<\/Button>/,
    /<Button variant="link" size="sm" asChild>/,
    /<SheetTrigger asChild>/,
    /<SheetClose asChild>/,
    /<SheetContent side="right" showCloseButton/,
    /<Textarea \{\.\.\.textarea\} \/>/,
    /const tmp7: JSX\.Element = <ArrowUpRight \{\.\.\.icon\} \/>;\s+const tmp8: JSX\.Element = <CardAction>\{tmp7\}<\/CardAction>/,
    /const tmp19: JSX\.Element = <Button>Open<\/Button>;\s+const tmp20: JSX\.Element = <SheetTrigger asChild>\{tmp19\}<\/SheetTrigger>/,
    /const tmp24: JSX\.Element = <Button>Close<\/Button>;\s+const tmp25: JSX\.Element = <SheetClose asChild>\{tmp24\}<\/SheetClose>/,
    /<Command label="Inline compiler commands" loop>/,
    /<CommandItem value="open-contract" keywords=\{\["open", "contract"\]\} focusTargetId="contract-trigger" onSelect=/,
    /<CommandShortcutLabel>⌘K<\/CommandShortcutLabel>/,
    /<CommandDialog \{\.\.\.commandDialog\} modKShortcut returnFocusId="contract-trigger">/,
  ]) {
    assert.match(emitted, expected, `emitted shared UI contract drifted: ${expected}`);
  }
  assert(!/\bany\b/.test(emitted), "shared UI fixture widened emitted TypeScript to any");
  assert(!/asChild=\{true\}/.test(emitted), "static asChild flag lost canonical TSX shorthand");
  assert(
    !/[A-Za-z_:][A-Za-z0-9_:-]*=\{"[^"{}]*"\}/.test(emitted),
    "emitted shared UI TSX wrapped a static string in an expression container",
  );
  assert(
    !/<(?:SlottedButton|SlottedBadge|SlottedSheetTrigger|SlottedSheetClose)/.test(emitted),
    "Haxe-only polymorphic identities leaked into emitted TSX",
  );
  assert(
    !/<CardAction><ArrowUpRight|<SheetTrigger asChild><Button>Open|<SheetClose asChild><Button>Close/.test(
      emitted,
    ),
    "source TSX collapsed HXX child-before-parent component evaluation order",
  );
}

function verifyNegativeContracts() {
  assert.match(
    run("haxe", ["tests/showcase-ui/build-negative-props.hxml"], 1),
    /String should be Null<showcase\.ui\.ButtonSize>/,
    "invalid Button size diagnostic drifted",
  );
  assert.match(
    run("haxe", ["tests/showcase-ui/build-negative-spread.hxml"], 1),
    /Spread attribute missing expression/,
    "malformed HXX spread diagnostic drifted",
  );

  const hxxCases = [
    [
      "hxx_unknown_intrinsic",
      /HxxNegative\.hx:30: characters 18-23 : \[GTS-HXX-TAG-001\] Unknown intrinsic tag `<buton>`/,
    ],
    [
      "hxx_missing_required",
      /HxxNegative\.hx:32: characters 18-31 : \[GTS-HXX-PROP-004\] component `RequiredLabel` is missing required property `label`/,
    ],
    [
      "hxx_unknown_component_prop",
      /HxxNegative\.hx:34: characters 27-34 : \[GTS-HXX-PROP-001\].*does not declare a `heroic` property/,
    ],
    [
      "hxx_wrong_component_prop",
      /HxxNegative\.hx:36: characters 33-36 : \[GTS-HXX-PROP-002\].*property `size` expects `showcase\.ui\.ButtonSize` but received `Int`/,
    ],
    [
      "hxx_invalid_component_child",
      /HxxNegative\.hx:38: characters 28-39 : \[GTS-HXX-CHILD-001\].*does not accept nested children/,
    ],
    [
      "hxx_invalid_spread",
      /HxxNegative\.hx:41: characters 31-36 : \[GTS-HXX-SPREAD-003\].*spread contains unknown property `heroic`/,
    ],
    [
      "hxx_invalid_handler",
      /HxxNegative\.hx:43: characters 25-48 : \[GTS-HXX-PROP-002\] <button> property `onClick` expects .* but received `String`/,
    ],
    [
      "hxx_slot_text_child",
      /HxxNegative\.hx:45: characters 23-37 : \[GTS-HXX-CHILD-003\] component `Slot` child expects `genes\.react\.Element` but received `String`/,
    ],
    [
      "hxx_slot_multiple_children",
      /HxxNegative\.hx:47: characters 43-63 : \[GTS-HXX-CHILD-003\] component `Slot` accepts one child of type `genes\.react\.Element`, not 2 children/,
    ],
    [
      "hxx_slotted_button_multiple_children",
      /HxxNegative\.hx:49: characters 62-78 : \[GTS-HXX-CHILD-003\] component `SlottedButton` accepts one child of type `genes\.react\.Element`, not 2 children/,
    ],
    [
      "hxx_sheet_trigger_missing_child",
      /HxxNegative\.hx:51: characters 18-37 : \[GTS-HXX-CHILD-002\] component `SlottedSheetTrigger` requires a child compatible with `genes\.react\.Element`/,
    ],
    [
      "hxx_sheet_wrong_callback",
      /HxxNegative\.hx:53: characters 38-69 : \[GTS-HXX-PROP-002\] component `Sheet` property `onOpenChange` expects `Bool -> Void` but received `\(_value : String\) -> Void`/,
    ],
    [
      "hxx_plain_button_as_child",
      /HxxNegative\.hx:55: characters 27-34 : \[GTS-HXX-PROP-001\] component `UiButton` does not declare a `asChild` property/,
    ],
    [
      "hxx_slotted_button_missing_flag",
      /HxxNegative\.hx:57: characters 18-31 : \[GTS-HXX-PROP-004\] component `SlottedButton` is missing required property `asChild`/,
    ],
    [
      "hxx_command_wrong_select",
      /HxxNegative\.hx:59: characters 42-70 : \[GTS-HXX-PROP-002\] component `UiCommandItem` property `onSelect` expects `String -> Void` but received `\(_value : Int\) -> Void`/,
    ],
    [
      "hxx_command_wrong_keywords",
      /HxxNegative\.hx:61: characters 42-48 : \[GTS-HXX-PROP-002\] component `UiCommandItem` property `keywords` expects `Array<String>` but received `Array<Int>`/,
    ],
    [
      "hxx_command_wrong_shortcut",
      /HxxNegative\.hx:63: characters 34-52 : \[GTS-HXX-PROP-002\] component `UiCommandDialog` property `modKShortcut` expects `Bool` but received `String`/,
    ],
  ];

  for (const [define, expected] of hxxCases) {
    fs.rmSync(HXX_NEGATIVE_OUTPUT, { force: true });
    const diagnostic = run(
      "haxe",
      ["tests/showcase-ui/build-negative-hxx.hxml", "-D", define],
      1,
    );
    assert.match(diagnostic, expected, `${define} Haxe-first diagnostic drifted`);
    assert(
      !fs.existsSync(HXX_NEGATIVE_OUTPUT),
      `${define} committed TSX after Haxe rejected the authored HXX`,
    );
  }
}

async function verifyReactLint() {
  const file = path.join(ROOT, "examples/showcase-ui/src/components/ui/command.tsx");
  const results = await REACT_LINTER.lintText(fs.readFileSync(file, "utf8"), { filePath: file });
  const errors = results.flatMap((result) =>
    result.messages
      .filter((message) => message.severity === 2)
      .map(
        (message) =>
          `${path.relative(ROOT, result.filePath)}:${message.line}:${message.column} ${message.ruleId}: ${message.message}`,
      ),
  );
  assert.deepEqual(errors, [], `source-owned Command failed official React lint:\n${errors.join("\n")}`);
}

try {
  fs.rmSync(OUTPUT, { recursive: true, force: true });
  verifyHaxeSurfaceSource();
  run(TSC, ["--project", "examples/showcase-ui/tsconfig.json", "--pretty", "false"]);
  await verifyReactLint();
  run("haxe", ["tests/showcase-ui/build-positive.hxml"]);
  verifyEmittedTsx();
  run(TSC, ["--project", "tests/showcase-ui/tsconfig.json", "--pretty", "false"]);
  verifyNegativeContracts();
  console.log(
    "[showcase-ui] OK: source-owned shadcn/Radix/cmdk packages, official React lint, exact component props, canonical TSX, and 19 negative contracts",
  );
} catch (error) {
  console.error(`[showcase-ui] ERROR: ${error.message}`);
  process.exitCode = 1;
} finally {
  fs.rmSync(OUTPUT, { recursive: true, force: true });
}
