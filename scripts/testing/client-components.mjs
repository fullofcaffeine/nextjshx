#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import typescriptParser from "@typescript-eslint/parser";
import Ajv2020 from "ajv/dist/2020.js";
import { ESLint } from "eslint";
import reactHooks from "eslint-plugin-react-hooks";
import { chromium } from "playwright-core";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const FIXTURE = path.join(ROOT, "tests/client-components");
const NEXT_APP = path.join(FIXTURE, "next-app");
const DIRECT_OUTPUT = path.join(FIXTURE, ".tmp/typescript");
const PLAN = path.join(FIXTURE, ".tmp/plan.json");
const REJECTED_PLAN = path.join(FIXTURE, ".tmp/rejected-plan.json");
const REJECTED_HXX_OUTPUT = path.join(FIXTURE, ".tmp/rejected-hxx.tsx");
const REJECTED_NUQS_HXX_OUTPUT = path.join(FIXTURE, ".tmp/rejected-nuqs-hxx.tsx");
const GENERATED_REACT_LINT_NEGATIVE_OUTPUT = path.join(
  FIXTURE,
  ".tmp/client_components_react_lint_negative/GeneratedMissingDependency.tsx",
);
const MEMO_RUNTIME_OUTPUT = path.join(FIXTURE, ".tmp/memo-runtime");
const SNAPSHOT = path.join(ROOT, "tests/snapshots/client-component-plan-v1.json");
const SCHEMA = path.join(ROOT, "schemas/adapter-plan.schema.json");
const CLI = path.join(ROOT, "tools/cli/.tmp/src/cli.js");
const NEXT = path.join(ROOT, "node_modules/next/dist/bin/next");
const GENERATED_ADAPTERS = [
  "app/_nextjshx/actions/flight.ts",
  "app/_nextjshx/client/15df5be7865a/FlightBoundary.tsx",
  "app/_nextjshx/client/608bef9587b3/InteractiveCounter.tsx",
  "app/_nextjshx/client/81f1eb774589/QueryPanel.tsx",
  "app/_nextjshx/client/a9abe9029f6d/RejectedFlightBoundary.tsx",
  "app/_nextjshx/client/c63756482b38/NestedToggle.tsx",
  "app/_nextjshx/hook/4d8dcc73935a/useSemanticCounter.ts",
  "app/_nextjshx/hook/a04911485bc8/useSelection.ts",
  "app/_nextjshx/hook/c82d49c13609/useTodoQuery.ts",
  "app/page.tsx",
];
const LEGACY_GENERATED_ADAPTERS = ["app/components/InteractiveCounter.tsx"];
const LINKED_PACKAGES = ["next", "nuqs", "react", "react-dom", "typescript"];
const ANSI_ESCAPE = /\x1b\[[0-?]*[ -/]*[@-~]/g;

const NEGATIVE_CASES = new Map([
  [
    "function-prop",
    "tests/client-components/negative/client_components_negative/FunctionProps.hx:7: characters 2-30 : [NXHX-SERIALIZABLE-PROP-0001] props.onSelect is not a supported React boundary value: ordinary functions cannot cross the Server-to-Client boundary; use a generated Server Function ref when that feature is intended. Found String -> Void. Use primitives, arrays, plain immutable records, ReactNode composition, or an exact nextjs.client.flight.v19 capability.",
  ],
  [
    "class-prop",
    "tests/client-components/negative/client_components_negative/ClassProps.hx:14: characters 2-30 : [NXHX-SERIALIZABLE-PROP-0001] props.session is not a supported React boundary value: class instances and runtime containers do not have a stable plain-value encoding. Found client_components_negative.ClientSession. Use primitives, arrays, plain immutable records, ReactNode composition, or an exact nextjs.client.flight.v19 capability.",
  ],
  [
    "unknown-prop",
    "tests/client-components/negative/client_components_negative/UnknownProps.hx:7: characters 2-24 : [NXHX-SERIALIZABLE-PROP-0001] props.payload is not a supported React boundary value: broad external-boundary values must be decoded before crossing into a Client Component. Found genes.ts.Unknown. Use primitives, arrays, plain immutable records, ReactNode composition, or an exact nextjs.client.flight.v19 capability.",
  ],
  [
    "recursive-prop",
    "tests/client-components/negative/client_components_negative/RecursiveProps.hx:7: characters 2-38 : [NXHX-SERIALIZABLE-PROP-0001] props.root.children[] is not a supported React boundary value: recursive or cyclic value graphs are rejected conservatively. Found client_components_negative.RecursiveNode. Use primitives, arrays, plain immutable records, ReactNode composition, or an exact nextjs.client.flight.v19 capability.",
  ],
  [
    "local-symbol-prop",
    "tests/client-components/negative/client_components_negative/LocalSymbolProps.hx:6: characters 2-29 : [NXHX-SERIALIZABLE-PROP-0001] props.marker is not a supported React boundary value: a raw symbol does not prove global-registry provenance; create FlightGlobalSymbol with FlightGlobalSymbol.forKey(...). Found js.lib.Symbol. Use primitives, arrays, plain immutable records, ReactNode composition, or an exact nextjs.client.flight.v19 capability.",
  ],
  [
    "raw-promise-prop",
    "tests/client-components/negative/client_components_negative/RawPromiseProps.hx:6: characters 2-40 : [NXHX-SERIALIZABLE-PROP-0001] props.resource is not a supported React boundary value: an ordinary Promise does not prove server ownership or stable React identity; use FlightPromise from a reviewed server-owned provider. Found js.lib.Promise<String>. Use primitives, arrays, plain immutable records, ReactNode composition, or an exact nextjs.client.flight.v19 capability.",
  ],
  [
    "unsupported-map-value",
    "tests/client-components/negative/client_components_negative/UnsupportedMapValue.hx:8: characters 2-50 : [NXHX-SERIALIZABLE-PROP-0001] props.sessions.values[] is not a supported React boundary value: class instances and runtime containers do not have a stable plain-value encoding. Found client_components_negative.ClientSession. Use primitives, arrays, plain immutable records, ReactNode composition, or an exact nextjs.client.flight.v19 capability.",
  ],
  [
    "unsupported-set-value",
    "tests/client-components/negative/client_components_negative/UnsupportedSetValue.hx:7: characters 2-42 : [NXHX-SERIALIZABLE-PROP-0001] props.listeners.values[] is not a supported React boundary value: ordinary functions cannot cross the Server-to-Client boundary; use a generated Server Function ref when that feature is intended. Found String -> Void. Use primitives, arrays, plain immutable records, ReactNode composition, or an exact nextjs.client.flight.v19 capability.",
  ],
  [
    "unsupported-promise-result",
    "tests/client-components/negative/client_components_negative/UnsupportedPromiseResult.hx:7: characters 2-30 : [NXHX-SERIALIZABLE-PROP-0001] props.resource.resolved.callback is not a supported React boundary value: ordinary functions cannot cross the Server-to-Client boundary; use a generated Server Function ref when that feature is intended. Found String -> Void. Use primitives, arrays, plain immutable records, ReactNode composition, or an exact nextjs.client.flight.v19 capability.",
  ],
  [
    "unversioned-map-prop",
    "tests/client-components/negative/client_components_negative/UnversionedMapProps.hx:6: characters 2-39 : [NXHX-SERIALIZABLE-PROP-0001] props.values is not a supported React boundary value: class instances and runtime containers do not have a stable plain-value encoding. Found js.lib.Map<String, Int>. Use primitives, arrays, plain immutable records, ReactNode composition, or an exact nextjs.client.flight.v19 capability.",
  ],
  [
    "broad-array-buffer-view-prop",
    "tests/client-components/negative/client_components_negative/BroadArrayBufferViewProps.hx:6: characters 2-37 : [NXHX-SERIALIZABLE-PROP-0001] props.bytes is not a supported React boundary value: class instances and runtime containers do not have a stable plain-value encoding. Found js.lib.ArrayBufferView. Use primitives, arrays, plain immutable records, ReactNode composition, or an exact nextjs.client.flight.v19 capability.",
  ],
  [
    "method-flight-promise",
    'tests/client-components/negative/client_components_negative/MethodFlightPromise.hx:8: characters 26-60 : [NXHX-FLIGHT-PROMISE-0001] FlightResource.promise(...) must initialize one static final field, but it was called inside "create". Create the Promise once on an @:next.serverOnly provider and pass that capability to the Client Component.',
  ],
  [
    "forged-server-function",
    "tests/client-components/negative/client_components_negative/ForgedServerFunction.hx:12: characters 3-80 : (label : String) -> js.lib.Promise<String> should be nextjs.client.flight.v19.FlightServerFunction<String -> js.lib.Promise<String>>",
  ],
  [
    "async-render",
    "tests/client-components/negative/client_components_negative/AsyncRender.hx:12: lines 12-14 : [NXHX-CLIENT-RETURN-0004] Client Component render must synchronously return genes.react.Element; found js.lib.Promise<genes.react.Element>. Client Components cannot be async.",
  ],
  [
    "bad-path",
    "tests/client-components/negative/client_components_negative/BadPath.hx:9: characters 24-41 : [NXHX-CLIENT-PATH-0002] Client Component adapter path \"components/page\" would collide with Next App Router convention file page.tsx. Choose a component-specific filename.",
  ],
  [
    "missing-annotation-ref",
    "tests/client-components/negative/client_components_negative/MissingAnnotationRef.hx:15: characters 21-38 : [NXHX-CLIENT-REF-0006] client_components_negative.MissingAnnotationRef.OrdinaryComponent is not annotated with @:next.clientComponent.",
  ],
  [
    "raw-client-import",
    "tests/client-components/negative/client_components_negative/RawClientPage.hx:11: characters 10-19 : [NXHX-BOUNDARY-IMPORT-0002] server-default module client_components_negative.RawClientPage cannot depend directly on client module client_components_negative.RawClient. Use the generated native boundary ref, or move target-neutral values into an explicit @:next.shared module.",
  ],
  [
    "conditional-hook",
    "tests/client-components/negative/client_components_negative/ConditionalHook.hx:14: characters 4-28 : [NXHX-REACT-HOOK-0002] Reviewed React Hook client_components_negative.HookBindings.ReviewedHooks.useCount is called inside a conditional branch. Call Hooks unconditionally at the top level of the Client Component or custom Hook, before any conditional early return.",
  ],
  [
    "aliased-conditional-hook",
    "tests/client-components/negative/client_components_negative/AliasedConditionalHook.hx:14: characters 4-22 : [NXHX-REACT-HOOK-0002] Reviewed React Hook client_components_negative.HookBindings.ReviewedHooks.useCount is called inside a conditional branch. Call Hooks unconditionally at the top level of the Client Component or custom Hook, before any conditional early return.",
  ],
  [
    "loop-hook",
    "tests/client-components/negative/client_components_negative/LoopHook.hx:15: characters 4-28 : [NXHX-REACT-HOOK-0002] Reviewed React Hook client_components_negative.HookBindings.ReviewedHooks.useCount is called inside a loop. Call Hooks unconditionally at the top level of the Client Component or custom Hook, before any conditional early return.",
  ],
  [
    "nested-hook",
    "tests/client-components/negative/client_components_negative/NestedHook.hx:13: characters 27-51 : [NXHX-REACT-HOOK-0002] Reviewed React Hook client_components_negative.HookBindings.ReviewedHooks.useCount is called inside a nested function or event-handler callback. Call Hooks unconditionally at the top level of the Client Component or custom Hook, before any conditional early return.",
  ],
  [
    "event-handler-hook",
    "tests/client-components/negative/client_components_negative/EventHandlerHook.hx:14: characters 18-42 : [NXHX-REACT-HOOK-0002] Reviewed React Hook client_components_negative.HookBindings.ReviewedHooks.useCount is called inside a nested function or event-handler callback. Call Hooks unconditionally at the top level of the Client Component or custom Hook, before any conditional early return.",
  ],
  [
    "try-hook",
    "tests/client-components/negative/client_components_negative/TryHook.hx:14: characters 4-28 : [NXHX-REACT-HOOK-0002] Reviewed React Hook client_components_negative.HookBindings.ReviewedHooks.useCount is called inside a try/catch block. Call Hooks unconditionally at the top level of the Client Component or custom Hook, before any conditional early return.",
  ],
  [
    "catch-hook",
    "tests/client-components/negative/client_components_negative/CatchHook.hx:16: characters 4-28 : [NXHX-REACT-HOOK-0002] Reviewed React Hook client_components_negative.HookBindings.ReviewedHooks.useCount is called inside a try/catch block. Call Hooks unconditionally at the top level of the Client Component or custom Hook, before any conditional early return.",
  ],
  [
    "after-return-hook",
    "tests/client-components/negative/client_components_negative/AfterReturnHook.hx:16: characters 17-41 : [NXHX-REACT-HOOK-0002] Reviewed React Hook client_components_negative.HookBindings.ReviewedHooks.useCount is called inside code reached after a conditional early return. Call Hooks unconditionally at the top level of the Client Component or custom Hook, before any conditional early return.",
  ],
  [
    "outside-hook",
    "tests/client-components/negative/client_components_negative/OutsideHook.hx:7: characters 10-34 : [NXHX-REACT-HOOK-0001] Reviewed React Hook client_components_negative.HookBindings.ReviewedHooks.useCount may only be called from a @:next.clientComponent render or an @:next.hook function. Mark a genuine custom Hook with @:next.hook; keep ordinary helpers Hook-free.",
  ],
  [
    "ordinary-use-name",
    "tests/client-components/negative/client_components_negative/OrdinaryUseName.hx:17: characters 33-58 : [NXHX-REACT-NAME-0006] Ordinary function client_components_negative.OrdinaryUseName.useFriendlyLabel uses React's reserved use-prefixed spelling inside a Client Component or custom Hook. Haxe does not classify it as a Hook, but official React lint must treat that emitted name as one. Rename the ordinary helper without the use prefix, or mark and structure a genuine Hook with @:next.hook.",
  ],
  [
    "react-use-try",
    "tests/client-components/negative/client_components_negative/ReactUseTry.hx:15: characters 18-59 : [NXHX-REACT-USE-0003] React use binding nextjs.client.React.use cannot be called inside try/catch because React uses throwing to suspend. Use an Error Boundary; conditions and loops remain valid for React use.",
  ],
  [
    "react-use-outside",
    "tests/client-components/negative/client_components_negative/ReactUseOutside.hx:8: characters 10-51 : [NXHX-REACT-USE-0003] React use binding nextjs.client.React.use may only be called from a @:next.clientComponent render or an @:next.hook function.",
  ],
  [
    "uncached-react-use",
    `tests/client-components/negative/client_components_negative/UncachedReactUse.hx:14: characters 17-56 : Could not find a suitable overload, reasons follow
tests/client-components/negative/client_components_negative/UncachedReactUse.hx:14: characters 17-56 : Overload resolution failed for (resource : nextjs.client.CachedPromise<use.T>) -> use.T
tests/client-components/negative/client_components_negative/UncachedReactUse.hx:14: characters 27-55 : js.lib.Promise<String> should be nextjs.client.CachedPromise<Unknown<0>>
tests/client-components/negative/client_components_negative/UncachedReactUse.hx:14: characters 27-55 : ... For function argument 'resource'
tests/client-components/negative/client_components_negative/UncachedReactUse.hx:14: characters 17-56 : Overload resolution failed for (resource : nextjs.raw.react.Context<use.T>) -> use.T
tests/client-components/negative/client_components_negative/UncachedReactUse.hx:14: characters 27-55 : js.lib.Promise<String> should be nextjs.raw.react.Context<Unknown<0>>
tests/client-components/negative/client_components_negative/UncachedReactUse.hx:14: characters 27-55 : ... For function argument 'resource'
tests/client-components/negative/client_components_negative/UncachedReactUse.hx:14: characters 17-56 : Overload resolution failed for (resource : nextjs.client.flight.v19.FlightPromise<use.T>) -> use.T
tests/client-components/negative/client_components_negative/UncachedReactUse.hx:14: characters 27-55 : js.lib.Promise<String> should be nextjs.client.flight.v19.FlightPromise<Unknown<0>>
tests/client-components/negative/client_components_negative/UncachedReactUse.hx:14: characters 27-55 : ... For function argument 'resource'
tests/client-components/negative/client_components_negative/UncachedReactUse.hx:14: characters 17-56 : End of overload failure reasons`,
  ],
  [
    "impure-random",
    "tests/client-components/negative/client_components_negative/ImpureRandom.hx:12: characters 17-30 : [NXHX-REACT-PURITY-0004] React render calls known non-idempotent function Math.random. Pass a stable value, initialize state lazily, or move the call into an event handler or Effect.",
  ],
  [
    "impure-date",
    "tests/client-components/negative/client_components_negative/ImpureDate.hx:12: characters 17-27 : [NXHX-REACT-PURITY-0004] React render calls known non-idempotent function Date.now. Pass a stable value, initialize state lazily, or move the call into an event handler or Effect.",
  ],
  [
    "static-mutation",
    "tests/client-components/negative/client_components_negative/StaticMutation.hx:14: characters 3-12 : [NXHX-REACT-PURITY-0004] React render mutates non-local static field client_components_negative.StaticMutation.renders. Create per-render local data, or update state from an event handler or Effect.",
  ],
  [
    "callable-state",
    "tests/client-components/negative/client_components_negative/CallableState.hx:11: characters 18-25 : [NXHX-REACT-STATE-0001] useState(value) received a value whose static type may be callable. React would interpret that value as a lazy initializer. Use useStateLazy(() -> value) to store function-valued state.",
  ],
  [
    "stored-memo-dependencies",
    "tests/client-components/negative/client_components_negative/StoredMemoDependencies.hx:11: characters 41-47 : [NXHX-REACT-DEPS-0001] Semantic useMemo requires a direct React.deps(...) expression so the emitted dependency list remains inline and constant-length. Use nextjs.raw.react.React.useMemo for a deliberately raw dependency value.",
  ],
  [
    "stored-callback-dependencies",
    "tests/client-components/negative/client_components_negative/StoredCallbackDependencies.hx:10: characters 60-72 : [NXHX-REACT-DEPS-0001] Semantic useCallback requires a direct React.deps(...) expression so the emitted dependency list remains inline and constant-length. Use nextjs.raw.react.React.useCallback for a deliberately raw dependency value.",
  ],
  [
    "standalone-dependencies",
    "tests/client-components/negative/client_components_negative/StandaloneDependencies.hx:9: characters 14-19 : [NXHX-REACT-DEPS-0001] React.deps(...) is compile-time dependency packaging and must appear directly as the second argument of React.useMemo(...) or React.useCallback(...).",
  ],
  [
    "memo-computed-dependency",
    "tests/client-components/negative/client_components_negative/MemoComputedDependency.hx:10: characters 58-69 : [NXHX-REACT-DEPS-0002] Computed memo dependencies need a named scalar shared by the calculation and dependency list. Add one calculation parameter for each dependency, for example React.useMemo((current) -> current * 2, React.deps(state.value)).",
  ],
  [
    "memo-dependency-arity",
    "tests/client-components/negative/client_components_negative/MemoDependencyArity.hx:9: characters 24-59 : [NXHX-REACT-DEPS-0002] Memo calculation declares 2 dependency parameter(s), but React.deps(...) supplies 1. Declare exactly one parameter for each dependency in the same order.",
  ],
  [
    "named-memo-snapshot",
    "tests/client-components/negative/client_components_negative/NamedMemoSnapshot.hx:9: lines 9-11 : [NXHX-REACT-DEPS-0002] Dependency-parameter memo calculations cannot be named functions because relocating their parameters would change recursive calls. Use an anonymous function or arrow calculation.",
  ],
  [
    "rest-memo-snapshot",
    "tests/client-components/negative/client_components_negative/RestMemoSnapshot.hx:9: lines 9-11 : [NXHX-REACT-DEPS-0002] Memo dependency parameter `current` cannot use rest semantics because it represents exactly one dependency scalar.",
  ],
  [
    "wrong-memo-snapshot-type",
    "tests/client-components/negative/client_components_negative/WrongMemoSnapshotType.hx:9: characters 64-69 : [NXHX-REACT-DEPS-0002] Memo dependency parameter `current` expects exactly String, but its dependency has Int.",
  ],
  [
    "wrong-state-replacement",
    `tests/client-components/negative/client_components_negative/WrongStateReplacement.hx:10: characters 13-20 : String should be Int
tests/client-components/negative/client_components_negative/WrongStateReplacement.hx:10: characters 13-20 : ... For function argument 'next'`,
  ],
  [
    "wrong-optimistic-action",
    `tests/client-components/negative/client_components_negative/WrongOptimisticAction.hx:10: characters 15-22 : String should be Int
tests/client-components/negative/client_components_negative/WrongOptimisticAction.hx:10: characters 15-22 : ... For function argument 'action'`,
  ],
  [
    "wrong-optimistic-reducer",
    `tests/client-components/negative/client_components_negative/WrongOptimisticReducer.hx:9: characters 57-70 : String should be Int
tests/client-components/negative/client_components_negative/WrongOptimisticReducer.hx:9: characters 57-70 : ... For function argument 'reducer'`,
  ],
  [
    "unreviewed-hook-export",
    "tests/client-components/negative/client_components_negative/UnreviewedHookExport.hx:5: characters 2-19 : [NXHX-REACT-EXPORT-0002] client_components_negative.UnreviewedHookExport.useLabel must declare exactly one @:next.hook before it can be exported as a React Hook.",
  ],
  [
    "invalid-query-key",
    'tests/client-components/negative/client_components_negative/InvalidQueryKey.hx:10: characters 22-35 : [NXHX-NUQS-KEY-0001] Query key "view=active" must start with an ASCII letter and then use only letters, digits, dot, underscore, tilde, or hyphen. Delimiters such as ?, &, =, and # belong to URL encoding, not the key.',
  ],
  [
    "empty-query-key",
    'tests/client-components/negative/client_components_negative/EmptyQueryKey.hx:10: characters 22-24 : [NXHX-NUQS-KEY-0001] Query key "" must start with an ASCII letter and then use only letters, digits, dot, underscore, tilde, or hyphen. Delimiters such as ?, &, =, and # belong to URL encoding, not the key.',
  ],
  [
    "dynamic-query-key",
    "tests/client-components/negative/client_components_negative/DynamicQueryKey.hx:10: characters 22-25 : [NXHX-NUQS-KEY-0001] Semantic useQueryState requires a compile-time string key so its identity cannot change between renders. Use nextjs.raw.integrations.nuqs.Nuqs.useQueryState for a deliberately runtime key.",
  ],
  [
    "wrong-query-value",
    `tests/client-components/negative/client_components_negative/WrongQueryValue.hx:11: characters 12-17 : String should be Int
tests/client-components/negative/client_components_negative/WrongQueryValue.hx:11: characters 12-17 : ... For function argument 'next'`,
  ],
  [
    "wrong-query-updater",
    `tests/client-components/negative/client_components_negative/WrongQueryUpdater.hx:11: characters 26-43 : String should be nextjs.raw.integrations.nuqs.QueryNext<Int>
tests/client-components/negative/client_components_negative/WrongQueryUpdater.hx:11: characters 26-43 : ... For function argument 'reducer'`,
  ],
  [
    "non-scalar-query-parser",
    "tests/client-components/negative/client_components_negative/NonScalarQueryParser.hx:19: characters 32-56 : [NXHX-NUQS-PARSER-0002] Semantic useQueryState accepts reviewed String, Int, Float, Bool, or scalar-domain parsers. Use nextjs.raw.integrations.nuqs.Nuqs.useQueryState for an arbitrary custom parser.",
  ],
  [
    "nuqs-outside-hook",
    "tests/client-components/negative/client_components_negative/NuqsOutsideHook.hx:9: characters 3-52 : [NXHX-REACT-HOOK-0001] Reviewed React Hook nextjshx.integrations.nuqs.NuqsHookBindings.useQueryState may only be called from a @:next.clientComponent render or an @:next.hook function. Mark a genuine custom Hook with @:next.hook; keep ordinary helpers Hook-free.",
  ],
  [
    "empty-string-literal-values",
    "tests/client-components/negative/client_components_negative/EmptyStringLiteralValues.hx:14: characters 52-54 : [NXHX-NUQS-LITERAL-0003] A semantic string-literal parser requires at least one valid value.",
  ],
  [
    "stored-string-literal-values",
    "tests/client-components/negative/client_components_negative/StoredStringLiteralValues.hx:16: characters 52-58 : [NXHX-NUQS-LITERAL-0003] Semantic string-literal values must be written as an inline Haxe array so the closed URL domain is visible at the call site.",
  ],
  [
    "open-string-literal-domain",
    "tests/client-components/negative/client_components_negative/OpenStringLiteralDomain.hx:10: characters 69-74 : [NXHX-NUQS-LITERAL-0003] Semantic string-literal values must use one String-backed Haxe enum abstract. Use Parsers.string(...) for an open String value or the raw nuqs binding for a deliberately open domain.",
  ],
  [
    "mixed-string-literal-domains",
    "tests/client-components/negative/client_components_negative/MixedStringLiteralDomains.hx:18: characters 77-102 : [NXHX-NUQS-LITERAL-0003] Every valid value and the default must belong to the same closed Haxe string domain; expected client_components_negative.MixedStringLiteralDomains.PrimaryLiteralView<>, received client_components_negative.MixedStringLiteralDomains.SecondaryLiteralView<>.",
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
      rules: {
        "react-hooks/exhaustive-deps": "error",
        "react-hooks/purity": "error",
        "react-hooks/rules-of-hooks": "error",
      },
    },
  ],
});

class ClientComponentFailure extends Error {}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? ROOT,
    encoding: "utf8",
    env: {
      ...process.env,
      CI: "1",
      NEXT_TELEMETRY_DISABLED: "1",
      NO_COLOR: "1",
    },
    maxBuffer: 32 * 1024 * 1024,
  });
  if (result.error !== undefined) {
    throw result.error;
  }
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  const expectedStatus = options.expectedStatus ?? 0;
  if (result.status !== expectedStatus) {
    throw new ClientComponentFailure(
      `${path.basename(command)} ${args.join(" ")} exited ${result.status}; expected ${expectedStatus}:\n${output}`,
    );
  }
  return output;
}

function walk(directory) {
  const result = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const child = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      result.push(...walk(child));
    } else if (entry.isFile()) {
      result.push(child);
    } else {
      throw new ClientComponentFailure(`unexpected link or special file under ${directory}`);
    }
  }
  return result.sort((left, right) => left.localeCompare(right, "en"));
}

function treeDigest(directory) {
  return walk(directory).map((file) => {
    const relative = path.relative(directory, file).replaceAll("\\", "/");
    const digest = crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
    return `${relative}:${digest}`;
  });
}

function normalizeDiagnostic(output) {
  return output
    .replace(ANSI_ESCAPE, "")
    .replaceAll("\\", "/")
    .replaceAll(`${ROOT.replaceAll("\\", "/")}/`, "")
    .trim();
}

function removeEmptyAdapterDirectories() {
  for (const directory of ["app/components"]) {
    try {
      fs.rmdirSync(path.join(NEXT_APP, directory));
    } catch (error) {
      if (error.code !== "ENOENT" && error.code !== "ENOTEMPTY") {
        throw error;
      }
    }
  }
}

function clean() {
  fs.rmSync(path.join(FIXTURE, ".tmp"), { recursive: true, force: true });
  fs.rmSync(path.join(NEXT_APP, "src-gen"), { recursive: true, force: true });
  fs.rmSync(path.join(NEXT_APP, ".nextjshx"), { recursive: true, force: true });
  fs.rmSync(path.join(NEXT_APP, ".next"), { recursive: true, force: true });
  fs.rmSync(path.join(NEXT_APP, "node_modules"), { recursive: true, force: true });
  fs.rmSync(path.join(NEXT_APP, "next-env.d.ts"), { force: true });
  fs.rmSync(path.join(NEXT_APP, "tsconfig.tsbuildinfo"), { force: true });
  for (const relative of [...GENERATED_ADAPTERS, ...LEGACY_GENERATED_ADAPTERS]) {
    fs.rmSync(path.join(NEXT_APP, relative), { force: true });
  }
  fs.rmSync(path.join(NEXT_APP, "app/_nextjshx"), { recursive: true, force: true });
  removeEmptyAdapterDirectories();
}

function linkDependencies() {
  const modules = path.join(NEXT_APP, "node_modules");
  fs.mkdirSync(modules, { recursive: true });
  for (const name of LINKED_PACKAGES) {
    fs.symlinkSync(path.join(ROOT, "node_modules", name), path.join(modules, name), "dir");
  }
  const scope = path.join(modules, "@nextjshx");
  fs.mkdirSync(scope, { recursive: true });
  fs.symlinkSync(path.join(FIXTURE, "hook-package"), path.join(scope, "client-fixture-hook"), "dir");
}

function verifyToolchainAndSources() {
  assert.equal(process.versions.node, "20.19.3");
  assert.equal(run("haxe", ["--version"]).trim(), "4.3.7");
  const packageValue = JSON.parse(fs.readFileSync(path.join(NEXT_APP, "package.json"), "utf8"));
  assert.deepEqual(packageValue.dependencies, {
    next: "16.2.12",
    nuqs: "2.9.1",
    react: "19.2.7",
    "react-dom": "19.2.7",
  });
  assert.deepEqual(packageValue.devDependencies, { typescript: "6.0.2" });
  const hookPackageValue = JSON.parse(
    fs.readFileSync(path.join(FIXTURE, "hook-package/package.json"), "utf8"),
  );
  assert.deepEqual(hookPackageValue.peerDependencies, {
    nuqs: "2.9.1",
    react: "19.2.7",
  });
  const positiveHaxe = walk(path.join(NEXT_APP, "haxe"));
  for (const file of positiveHaxe.filter((entry) => entry.endsWith(".hx"))) {
    const source = fs.readFileSync(file, "utf8");
    assert(!/\b(?:Dynamic|Any|untyped|cast)\b/.test(source), `${file} contains a broad Haxe escape`);
  }
  const hook = fs.readFileSync(path.join(FIXTURE, "hook-package/index.ts"), "utf8");
  assert(!/\b(?:any|unknown)\b|\sas\s|@ts-(?:ignore|nocheck)/.test(hook));
  const haxeHookConsumer = fs.readFileSync(
    path.join(NEXT_APP, "app/haxe-hook-consumer.tsx"),
    "utf8",
  );
  assert(!/\b(?:any|unknown)\b|\sas\s|@ts-(?:ignore|nocheck)/.test(haxeHookConsumer));
}

function verifyPlanAndDeterminism() {
  run("haxe", ["tests/client-components/build-positive.hxml"]);
  const first = treeDigest(DIRECT_OUTPUT);
  run("haxe", ["tests/client-components/build-positive.hxml"]);
  assert.deepEqual(treeDigest(DIRECT_OUTPUT), first, "Client Component Haxe output drifted on rebuild");

  const encoded = fs.readFileSync(PLAN, "utf8");
  assert.equal(encoded, fs.readFileSync(SNAPSHOT, "utf8"), "Client Component adapter plan drifted");
  const schema = JSON.parse(fs.readFileSync(SCHEMA, "utf8"));
  const plan = JSON.parse(encoded);
  const validate = new Ajv2020({ allErrors: true, strict: true }).compile(schema);
  assert(validate(plan), JSON.stringify(validate.errors, null, 2));
  assert.deepEqual(
    plan.intents.map((intent) => [intent.kind, intent.targetPath]),
    [
      ["server-function", "_nextjshx/actions/flight.ts"],
      ["client-component", "_nextjshx/client/15df5be7865a/FlightBoundary.tsx"],
      ["client-component", "_nextjshx/client/608bef9587b3/InteractiveCounter.tsx"],
      ["client-component", "_nextjshx/client/81f1eb774589/QueryPanel.tsx"],
      ["client-component", "_nextjshx/client/a9abe9029f6d/RejectedFlightBoundary.tsx"],
      ["client-component", "_nextjshx/client/c63756482b38/NestedToggle.tsx"],
      ["react-hook", "_nextjshx/hook/4d8dcc73935a/useSemanticCounter.ts"],
      ["react-hook", "_nextjshx/hook/a04911485bc8/useSelection.ts"],
      ["react-hook", "_nextjshx/hook/c82d49c13609/useTodoQuery.ts"],
      ["page", "page.tsx"],
    ],
  );
  const flightAction = plan.intents.find(
    (intent) => intent.source.typeName === "client_components.actions.FlightActions",
  );
  assert(flightAction);
  assert.deepEqual(flightAction.directives, ["use server"]);
  assert.equal(flightAction.exports[0].name, "ping");
  const flightClient = plan.intents.find(
    (intent) => intent.source.typeName === "client_components.client.FlightBoundary",
  );
  assert(flightClient);
  assert.deepEqual(flightClient.directives, ["use client"]);
  const client = plan.intents.find(
    (intent) => intent.source.typeName === "client_components.client.InteractiveCounter",
  );
  assert(client);
  assert.deepEqual(client.directives, ["use client"]);
  assert.equal(
    client.exports[0].signature,
    "ComponentType<Parameters<typeof InteractiveCounter.render>[0]>",
  );
  assert(plan.intents.some((intent) => intent.source.typeName === "client_components.client.QueryPanel"));
  assert(
    plan.intents.some(
      (intent) => intent.source.typeName === "client_components.client.SecondaryBoundary.NestedToggle",
    ),
  );
  const hook = plan.intents.find(
    (intent) => intent.source.typeName === "client_components.client.SemanticHooks",
  );
  assert(hook);
  assert.equal(hook.source.typeName, "client_components.client.SemanticHooks");
  assert.deepEqual(hook.directives, ["use client"]);
  assert.deepEqual(hook.exports, [
    {
      kind: "named",
      name: "useSemanticCounter",
      sourceField: "useSemanticCounter",
      signature: "typeof SemanticHooks.useSemanticCounter",
    },
  ]);
  const genericHook = plan.intents.find(
    (intent) => intent.source.typeName === "client_components.client.GenericHooks",
  );
  assert(genericHook);
  assert.equal(genericHook.source.typeName, "client_components.client.GenericHooks");
  assert.deepEqual(genericHook.directives, ["use client"]);
  assert.equal(genericHook.exports[0].signature, "typeof GenericHooks.useSelection");
  const queryHook = plan.intents.find(
    (intent) => intent.source.typeName === "client_components.client.QueryHooks",
  );
  assert(queryHook);
  assert.equal(queryHook.source.typeName, "client_components.client.QueryHooks");
  assert.deepEqual(queryHook.directives, ["use client"]);
  assert.deepEqual(queryHook.exports, [
    {
      kind: "named",
      name: "useTodoQuery",
      sourceField: "useTodoQuery",
      signature: "typeof QueryHooks.useTodoQuery",
    },
  ]);
  assert(!/\b(?:any|unknown)\b/.test(encoded));

  const page = fs.readFileSync(
    path.join(DIRECT_OUTPUT, "client_components/app/HomePage.tsx"),
    "utf8",
  );
  assert(page.includes("next-app/app/_nextjshx/client/608bef9587b3/InteractiveCounter"));
  assert(page.includes("next-app/app/_nextjshx/client/15df5be7865a/FlightBoundary"));
  assert(page.includes("next-app/app/_nextjshx/client/81f1eb774589/QueryPanel"));
  assert(page.includes('from "../../../../next-app/app/_nextjshx/actions/flight"'));
  assert(page.includes('new Date("2026-07-26T12:00:00.000Z")'));
  assert(page.includes('Symbol.for("nextjshx.flight")'));
  assert(page.includes("new Map()"));
  assert(page.includes("new Set()"));
  assert(page.includes("new ArrayBuffer(8)"));
  assert(page.includes("new Uint8Array(1)"));
  assert(page.includes("Parameters<typeof import("));
  assert(page.includes('from "../server/ServerSummary"'));
  assert(page.includes('from "../shared/SharedStatus"'));
  assert(page.includes('from "../shared/CounterDetails"'));
  assert(page.includes('from "nuqs/adapters/next/app"'));
  assert(page.includes('import {Suspense} from "react"'));
  assert(page.includes('<NuqsAdapter defaultOptions={{"history": "push"}}>'));
  assert(page.includes("<Suspense fallback={queryFallback}>"));
  assert(page.includes("<Suspense fallback={flightFallback}>{Flight_1}</Suspense>"));
  assert(
    page.includes(
      '<Suspense fallback={rejectedFlightFallback}>{RejectedFlight_1}</Suspense>',
    ),
  );
  assert(
    page.includes(
      '<FlightErrorBoundary fallbackLabel="Rejected Flight value reached the Error Boundary">{tmp9}</FlightErrorBoundary>',
    ),
  );
  assert(!page.includes("client_components/client/InteractiveCounter"));
  assert(!page.includes('from "../client/InteractiveCounter"'));
  assert(!page.includes("InteractiveCounterProps"));
  assert(!page.includes("client_components/actions/FlightActions"));

  const flightImplementation = fs.readFileSync(
    path.join(DIRECT_OUTPUT, "client_components/client/FlightBoundary.tsx"),
    "utf8",
  );
  for (const exactType of [
    "capturedAt: Date",
    "readings: Map<string, number>",
    "labels: globalThis.Set<string>",
    "buffer: ArrayBuffer",
    "int8: Int8Array",
    "int16: Int16Array",
    "int32: Int32Array",
    "uint8: Uint8Array",
    "uint8Clamped: Uint8ClampedArray",
    "uint16: Uint16Array",
    "uint32: Uint32Array",
    "float32: Float32Array",
    "float64: Float64Array",
    "symbol: symbol",
    "resource: Promise<FlightResourcePayload>",
    "ping: ((arg0: string) => Promise<string>)",
  ]) {
    assert(flightImplementation.includes(exactType), `missing exact Flight type ${exactType}`);
  }
  assert(flightImplementation.includes("const resource: FlightResourcePayload = use(props.resource)"));
  assert(flightImplementation.includes("String(props.symbol)"));
  assert(!/\b(?:any|unknown)\b|\sas\s|unsafeCast|Flight(?:Promise|ServerFunction)_Impl_/.test(flightImplementation));

  const flightResource = fs.readFileSync(
    path.join(DIRECT_OUTPUT, "client_components/server/FlightResources.tsx"),
    "utf8",
  );
  assert(flightResource.startsWith('import "server-only"'));
  assert(flightResource.includes("declare static payload: Promise<FlightResourcePayload>"));
  assert.equal((flightResource.match(/new Promise/g) ?? []).length, 2);
  assert.equal((flightResource.match(/setTimeout/g) ?? []).length, 2);
  assert(!flightResource.includes("Promise.resolve"));
  assert(!/\b(?:any|unknown)\b|\sas\s|unsafeCast/.test(flightResource));
  const implementation = fs.readFileSync(
    path.join(DIRECT_OUTPUT, "client_components/client/InteractiveCounter.tsx"),
    "utf8",
  );
  assert(implementation.includes('from "next/navigation"'));
  assert(implementation.includes('from "../shared/SharedStatus"'));
  assert(implementation.includes("tone: \"signal\" | \"tide\""));
  assert(implementation.includes("children: import('react').ReactNode"));
  assert(implementation.includes('import type {CounterDetails} from "../shared/CounterDetails"'));
  assert.match(
    implementation,
    /function InteractiveCounterComponent\([^]*?\.useCounterState\(props\.initialCount\)[^]*?export class InteractiveCounter/,
  );
  assert(implementation.includes("InteractiveCounter.render = InteractiveCounterComponent;"));
  const sharedDetails = fs.readFileSync(
    path.join(DIRECT_OUTPUT, "client_components/shared/CounterDetails.tsx"),
    "utf8",
  );
  assert(sharedDetails.includes("status: string | undefined"));

  const customHooks = fs.readFileSync(
    path.join(DIRECT_OUTPUT, "client_components/client/CounterHooks.tsx"),
    "utf8",
  );
  assert(customHooks.includes('from "@nextjshx/client-fixture-hook"'));
  assert(customHooks.includes("static useCounterState("));
  assert(customHooks.includes("return useCounter(initialCount)"));
  assert(customHooks.includes("static friendlyLabel("));

  const specialUse = fs.readFileSync(
    path.join(DIRECT_OUTPUT, "client_components/client/SecondaryBoundary.tsx"),
    "utf8",
  );
  assert(specialUse.includes('import {use} from "react"'));
  assert(specialUse.includes("cachedSecondaryLabels()"));
  assert(specialUse.includes("while (_g < _g1.length)"));
  assert(specialUse.includes("(props.showCached)"));
  assert(specialUse.includes("use(resource)"));

  const semanticHooks = fs.readFileSync(
    path.join(DIRECT_OUTPUT, "client_components/client/SemanticHooks.tsx"),
    "utf8",
  );
  assert(semanticHooks.includes("const count: UseStateResult<number> = useState(initial)"));
  assert(
    semanticHooks.includes('const mode = useState<"active" | "idle">("idle")'),
  );
  assert(semanticHooks.includes("count[1](next)"));
  assert(semanticHooks.includes("count[1](function (previous: number)"));
  assert(semanticHooks.includes("const current: number = count[0]"));
  assert(semanticHooks.includes("}, [current])"));
  assert(semanticHooks.includes("StateRuntime.replaceCallable(formatter[1], next)"));
  assert.match(
    semanticHooks,
    /import \{[^}]*\buseOptimistic\b[^}]*\bstartTransition\b[^}]*\} from "react"/,
  );
  assert(semanticHooks.includes("= useOptimistic(passthrough"));
  assert(semanticHooks.includes("count[1](amount)"));
  assert(semanticHooks.includes("startTransition(function ()"));
  assert(!/\b(?:State|Optimistic)_Impl_\b|\bdeps\s*\(|new (?:State|Optimistic)\b|\sas\s/.test(semanticHooks));

  const rawHooks = fs.readFileSync(
    path.join(DIRECT_OUTPUT, "client_components/client/RawHookContracts.tsx"),
    "utf8",
  );
  assert(rawHooks.includes("const state: UseStateResult<number> = useState<number>(initial)"));
  assert(rawHooks.includes("state[1](3)"));
  assert(rawHooks.includes("state[1](function (previous: number)"));
  assert(rawHooks.includes("static useUndefinedState(): undefined"));
  assert(rawHooks.includes("const state: UseStateResult<undefined> = useState<undefined>()"));
  assert(rawHooks.includes("const dependencies: readonly number[] = [value]"));
  assert(rawHooks.includes("useOptimistic(initial, function (current: number, amount: number)"));
  assert(rawHooks.includes("optimistic[1](2)"));
  assert(rawHooks.includes("useOptimistic(initial)"));
  assert(rawHooks.includes("optimistic[1](3)"));

  const stateResult = fs.readFileSync(
    path.join(DIRECT_OUTPUT, "nextjs/raw/react/UseStateResult.tsx"),
    "utf8",
  );
  assert(stateResult.includes("[State, Dispatch<SetStateAction<State>>]"));
  const optimisticResult = fs.readFileSync(
    path.join(DIRECT_OUTPUT, "nextjs/raw/react/UseOptimisticResult.tsx"),
    "utf8",
  );
  assert(optimisticResult.includes("[State, Dispatch<Action>]"));
  const stateAction = fs.readFileSync(
    path.join(DIRECT_OUTPUT, "nextjs/raw/react/SetStateAction.tsx"),
    "utf8",
  );
  assert(stateAction.includes("State | ((arg0: State) => State)"));

  const dependencyHooks = fs.readFileSync(
    path.join(DIRECT_OUTPUT, "client_components/client/DependencyHooks.tsx"),
    "utf8",
  );
  assert(dependencyHooks.includes("}, [])"));
  assert(dependencyHooks.includes("}, [value, label, enabled])"));
  assert(dependencyHooks.includes("}, [first, second])"));
  assert(dependencyHooks.includes("}, [props.label])"));
  assert(dependencyHooks.includes("const first: number = value"));
  assert(dependencyHooks.includes("const second: number = value"));
  assert(dependencyHooks.includes("const current: string | null = label[0]"));
  assert(dependencyHooks.includes("const number: number = first()"));
  assert(dependencyHooks.includes("const label: string = second()"));
  assert(dependencyHooks.includes("const current: number = firstState[0]"));
  assert(dependencyHooks.includes("const current1: number = secondState[0]"));
  assert(dependencyHooks.includes("}, [current1])"));
  assert(dependencyHooks.includes("static useNullableLabel(): string | null"));
  assert(dependencyHooks.includes("const label = useState<string | null>(null)"));
  assert(
    !/\bdeps\s*\(|\sas\s|\b(?:any|unknown)\b|unsafeCast|Register\.unsafeCast/.test(
      dependencyHooks,
    ),
  );

  const genericHooks = fs.readFileSync(
    path.join(DIRECT_OUTPUT, "client_components/client/GenericHooks.tsx"),
    "utf8",
  );
  assert(genericHooks.includes("static useSelection<Value>(items: Value[]): Selection<Value>"));
  assert(genericHooks.includes("index[1](next)"));

  const queryHooks = fs.readFileSync(
    path.join(DIRECT_OUTPUT, "client_components/client/QueryHooks.tsx"),
    "utf8",
  );
  assert(queryHooks.includes('from "nuqs"'));
  assert(queryHooks.includes('view: "active" | "all" | "done"'));
  assert(
    queryHooks.includes(
      'useQueryState<"active" | "all" | "done">("view", parseAsStringLiteral<"active" | "all" | "done">(["all", "active", "done"]).withDefault("all"))',
    ),
  );
  assert(!queryHooks.includes('useQueryState("view", parseAsString'));
  assert(queryHooks.includes('useQueryState("search", parseAsString)'));
  assert(queryHooks.includes('useQueryState("page", parseAsInteger.withDefault(1))'));
  assert(queryHooks.includes('useQueryState("progress", parseAsFloat.withDefault(0.5))'));
  assert(queryHooks.includes('useQueryState("archived", parseAsBoolean.withDefault(false))'));
  assert(queryHooks.includes('view[1]("active")'));
  assert(queryHooks.includes("search[1](function (current: string | null)"));
  assert(queryHooks.includes("search[1](null)"));
  assert(queryHooks.includes("page[1](function (current: number)"));
  assert(
    !/unsafeCast<null>|\bQueryState_Impl_\b|new QueryState|\bTypeArguments\b|\bExplicitTypeArgumentCallSite\b|\sas\s|\b(?:any|unknown)\b/.test(
      queryHooks,
    ),
  );

  const queryPanel = fs.readFileSync(
    path.join(DIRECT_OUTPUT, "client_components/client/QueryPanel.tsx"),
    "utf8",
  );
  assert(queryPanel.includes('from "@nextjshx/client-fixture-hook"'));
  assert(queryPanel.includes('useNativeQueryLabel("nativeLabel")'));
  assert(queryPanel.includes('<section id="query-panel">'));
  assert(!queryPanel.includes("__genesJsxPropName"));

  const rawNuqs = fs.readFileSync(
    path.join(DIRECT_OUTPUT, "client_components/client/RawNuqsContracts.tsx"),
    "utf8",
  );
  assert(rawNuqs.includes('useQueryState("rawPage", parseAsInteger)'));
  assert(rawNuqs.includes('useQueryState("rawArchived", parseAsBoolean.withDefault(false))'));

  const queryStateResult = fs.readFileSync(
    path.join(DIRECT_OUTPUT, "nextjs/raw/integrations/nuqs/QueryStateResult.tsx"),
    "utf8",
  );
  assert(
    queryStateResult.includes(
      "[Current, (value: null | Value | ((old: Current) => Value | null), options?: import('nuqs').Options) => Promise<URLSearchParams>]",
    ),
  );
  assert(!/\sas\s|unsafeCast<null>|\b(?:any|unknown)\b/.test(queryStateResult));
}

function verifyMemoSnapshotRuntime() {
  fs.rmSync(MEMO_RUNTIME_OUTPUT, { recursive: true, force: true });
  run("tsc6", [
    "--target",
    "ES2020",
    "--module",
    "commonjs",
    "--moduleResolution",
    "node",
    "--ignoreDeprecations",
    "6.0",
    "--jsx",
    "react-jsx",
    "--strict",
    "--skipLibCheck",
    "false",
    "--rootDir",
    DIRECT_OUTPUT,
    "--outDir",
    MEMO_RUNTIME_OUTPUT,
    path.join(DIRECT_OUTPUT, "client_components/client/DependencyHooks.tsx"),
  ]);

  const reactStub = path.join(MEMO_RUNTIME_OUTPUT, "node_modules/react");
  fs.mkdirSync(reactStub, { recursive: true });
  fs.writeFileSync(
    path.join(reactStub, "index.js"),
    [
      '"use strict";',
      "exports.memoDependencies = [];",
      "exports.useMemo = function (calculate, dependencies) {",
      "  exports.memoDependencies.push(dependencies);",
      "  return calculate();",
      "};",
      "exports.useState = function (initial) {",
      '  return [typeof initial === "function" ? initial() : initial, function () {}];',
      "};",
      "",
    ].join("\n"),
  );

  const modulePath = path.join(
    MEMO_RUNTIME_OUTPUT,
    "client_components/client/DependencyHooks.js",
  );
  const runtime = `
const react = require(${JSON.stringify(path.join(reactStub, "index.js"))});
const { DependencyHooks } = require(${JSON.stringify(modulePath)});
const events = [];
let firstCalls = 0;
let secondCalls = 0;
const result = DependencyHooks.useObserved(
  () => { firstCalls += 1; events.push("first"); return 7; },
  () => { secondCalls += 1; events.push("second"); return "ready"; },
);
const repeated = DependencyHooks.useRepeatedSnapshots(2, 3);
process.stdout.write(JSON.stringify({
  result,
  repeated,
  events,
  firstCalls,
  secondCalls,
  dependencies: react.memoDependencies,
}));
`;
  const transcript = JSON.parse(run(process.execPath, ["-e", runtime]));
  assert.deepEqual(transcript, {
    result: "7:ready",
    repeated: 13,
    events: ["first", "second"],
    firstCalls: 1,
    secondCalls: 1,
    dependencies: [[7, "ready"], [2], [3]],
  });
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
  const positiveFiles = [
    path.join(FIXTURE, "hook-package/index.ts"),
    path.join(NEXT_APP, "app/haxe-hook-consumer.tsx"),
    path.join(DIRECT_OUTPUT, "client_components/client/FlightBoundary.tsx"),
    path.join(DIRECT_OUTPUT, "client_components/client/RejectedFlightBoundary.tsx"),
    path.join(DIRECT_OUTPUT, "client_components/client/InteractiveCounter.tsx"),
    path.join(DIRECT_OUTPUT, "client_components/client/QueryPanel.tsx"),
    path.join(DIRECT_OUTPUT, "client_components/client/CounterHooks.tsx"),
    path.join(DIRECT_OUTPUT, "client_components/client/SemanticHooks.tsx"),
    path.join(DIRECT_OUTPUT, "client_components/client/DependencyHooks.tsx"),
    ...GENERATED_ADAPTERS.slice(0, -1).map((relative) => path.join(NEXT_APP, relative)),
  ];
  for (const file of positiveFiles) {
    const results = await REACT_LINTER.lintText(fs.readFileSync(file, "utf8"), { filePath: file });
    assert.equal(
      results.reduce((total, result) => total + result.errorCount, 0),
      0,
      lintFailure(results),
    );
  }

  run("haxe", ["tests/client-components/build-react-lint-negative.hxml"]);
  const generatedResults = await REACT_LINTER.lintText(
    fs.readFileSync(GENERATED_REACT_LINT_NEGATIVE_OUTPUT, "utf8"),
    { filePath: GENERATED_REACT_LINT_NEGATIVE_OUTPUT },
  );
  const generatedRuleIds = new Set(
    generatedResults.flatMap((result) => result.messages.map((message) => message.ruleId)),
  );
  assert(
    generatedRuleIds.has("react-hooks/exhaustive-deps"),
    "official React lint missed the generated Haxe dependency control",
  );
  assert(
    !generatedRuleIds.has("react-hooks/rules-of-hooks"),
    "official React lint misclassified the generated Haxe custom Hook",
  );

  const nativeNegativeControl = `
import { useMemo, useState } from "react";

export function BrokenControl(props: { enabled: boolean }) {
  if (props.enabled) {
    useState(0);
  }
  useMemo(() => props.enabled ? 1 : 0, []);
  const sample = Math.random();
  return <p>{sample}</p>;
}
`;
  const results = await REACT_LINTER.lintText(nativeNegativeControl, {
    filePath: path.join(FIXTURE, ".tmp/react-lint-negative.tsx"),
  });
  const ruleIds = new Set(results.flatMap((result) => result.messages.map((message) => message.ruleId)));
  assert(ruleIds.has("react-hooks/exhaustive-deps"), "official React lint missed its dependency control");
  assert(ruleIds.has("react-hooks/rules-of-hooks"), "official React lint missed its Hook control");
  assert(ruleIds.has("react-hooks/purity"), "official React lint missed its purity control");
}

function verifyNegativeControls() {
  for (const [name, expected] of NEGATIVE_CASES) {
    fs.rmSync(REJECTED_PLAN, { force: true });
    const output = run(
      "haxe",
      [
        "tests/client-components/build-negative.hxml",
        "-D",
        `client_component_case=${name}`,
      ],
      { expectedStatus: 1 },
    );
    assert.equal(normalizeDiagnostic(output), expected, name);
    assert.equal(fs.existsSync(REJECTED_PLAN), false, `${name} emitted a rejected adapter plan`);
  }

  fs.rmSync(REJECTED_PLAN, { force: true });
  fs.rmSync(REJECTED_HXX_OUTPUT, { force: true });
  const hxxOutput = run("haxe", ["tests/client-components/build-negative-hxx.hxml"], {
    expectedStatus: 1,
  });
  assert.equal(
    normalizeDiagnostic(hxxOutput),
    "tests/client-components/negative/client_components_negative/ClientRefWrongProp.hx:24: characters 50-61 : [GTS-HXX-PROP-002] component `Target` property `count` expects `Int` but received `String`.",
  );
  assert.equal(fs.existsSync(REJECTED_HXX_OUTPUT), false, "invalid client-ref HXX emitted TSX");
  assert.equal(fs.existsSync(REJECTED_PLAN), false, "invalid client-ref HXX emitted an adapter plan");

  fs.rmSync(REJECTED_PLAN, { force: true });
  fs.rmSync(REJECTED_NUQS_HXX_OUTPUT, { force: true });
  const nuqsHxxOutput = run("haxe", ["tests/client-components/build-negative-nuqs-hxx.hxml"], {
    expectedStatus: 1,
  });
  assert.equal(
    normalizeDiagnostic(nuqsHxxOutput),
    "tests/client-components/negative/client_components_negative/NuqsAdapterWrongProp.hx:12: characters 23-45 : [GTS-HXX-PROP-002] component `NuqsAdapter` property `defaultOptions` expects `nextjs.raw.integrations.nuqs.QueryOptions` but received `String`.",
  );
  assert.equal(fs.existsSync(REJECTED_NUQS_HXX_OUTPUT), false, "invalid nuqs adapter HXX emitted TSX");
  assert.equal(fs.existsSync(REJECTED_PLAN), false, "invalid nuqs adapter HXX emitted an adapter plan");
}

function generatedProof() {
  const flightAction = fs.readFileSync(
    path.join(NEXT_APP, "app/_nextjshx/actions/flight.ts"),
    "utf8",
  );
  assert.equal(flightAction.split(/\r?\n/)[0], '"use server";');
  assert(
    flightAction.includes(
      "export async function ping(...args: Parameters<typeof FlightActions.ping>): Promise<Awaited<ReturnType<typeof FlightActions.ping>>>",
    ),
  );
  assert(flightAction.includes("return FlightActions.ping(...args);"));
  assert(!/\b(?:any|unknown)\b|\sas\s/.test(flightAction));

  const flightAdapter = fs.readFileSync(
    path.join(NEXT_APP, "app/_nextjshx/client/15df5be7865a/FlightBoundary.tsx"),
    "utf8",
  );
  assert.equal(flightAdapter.split(/\r?\n/)[0], '"use client";');
  assert(
    flightAdapter.includes("ComponentType<Parameters<typeof FlightBoundary.render>[0]>"),
  );
  const rejectedFlightAdapter = fs.readFileSync(
    path.join(NEXT_APP, "app/_nextjshx/client/a9abe9029f6d/RejectedFlightBoundary.tsx"),
    "utf8",
  );
  assert.equal(rejectedFlightAdapter.split(/\r?\n/)[0], '"use client";');

  const adapter = fs.readFileSync(
    path.join(NEXT_APP, "app/_nextjshx/client/608bef9587b3/InteractiveCounter.tsx"),
    "utf8",
  );
  assert.equal(adapter.split(/\r?\n/)[0], '"use client";');
  assert.equal(adapter.split('"use client";').length - 1, 1);
  assert(
    adapter.indexOf('"use client";') < adapter.indexOf("import "),
    "Client directive must precede every import",
  );
  assert(adapter.includes("ComponentType<Parameters<typeof InteractiveCounter.render>[0]>"));

  const queryAdapter = fs.readFileSync(
    path.join(NEXT_APP, "app/_nextjshx/client/81f1eb774589/QueryPanel.tsx"),
    "utf8",
  );
  assert.equal(queryAdapter.split(/\r?\n/)[0], '"use client";');
  assert(queryAdapter.includes("ComponentType<Parameters<typeof QueryPanel.render>[0]>"));

  const hookAdapter = fs.readFileSync(
    path.join(NEXT_APP, "app/_nextjshx/hook/4d8dcc73935a/useSemanticCounter.ts"),
    "utf8",
  );
  assert.equal(hookAdapter.split(/\r?\n/)[0], '"use client";');
  assert(
    hookAdapter.includes(
      "export const useSemanticCounter: typeof SemanticHooks.useSemanticCounter = SemanticHooks.useSemanticCounter;",
    ),
  );
  assert(!hookAdapter.includes("function useSemanticCounter"));
  assert(!/\b(?:any|unknown)\b|\sas\s/.test(hookAdapter));

  const genericHookAdapter = fs.readFileSync(
    path.join(NEXT_APP, "app/_nextjshx/hook/a04911485bc8/useSelection.ts"),
    "utf8",
  );
  assert.equal(genericHookAdapter.split(/\r?\n/)[0], '"use client";');
  assert(
    genericHookAdapter.includes(
      "export const useSelection: typeof GenericHooks.useSelection = GenericHooks.useSelection;",
    ),
  );
  assert(!genericHookAdapter.includes("function useSelection"));

  const queryHookAdapter = fs.readFileSync(
    path.join(NEXT_APP, "app/_nextjshx/hook/c82d49c13609/useTodoQuery.ts"),
    "utf8",
  );
  assert.equal(queryHookAdapter.split(/\r?\n/)[0], '"use client";');
  assert(
    queryHookAdapter.includes(
      "export const useTodoQuery: typeof QueryHooks.useTodoQuery = QueryHooks.useTodoQuery;",
    ),
  );
  assert(!queryHookAdapter.includes("function useTodoQuery"));
  assert(!/\b(?:any|unknown)\b|\sas\s/.test(queryHookAdapter));

  const page = fs.readFileSync(
    path.join(NEXT_APP, "src-gen/client_components/app/HomePage.tsx"),
    "utf8",
  );
  assert(page.includes('from "../../../app/_nextjshx/client/15df5be7865a/FlightBoundary"'));
  assert(page.includes('from "../../../app/_nextjshx/actions/flight"'));
  assert(page.includes('from "../../../app/_nextjshx/client/608bef9587b3/InteractiveCounter"'));
  assert(page.includes('from "../../../app/_nextjshx/client/81f1eb774589/QueryPanel"'));
  assert(page.includes("Parameters<typeof import('../../../app/_nextjshx/client/608bef9587b3/InteractiveCounter').default>[0]"));
  assert(page.includes("Parameters<typeof import('../../../app/_nextjshx/client/81f1eb774589/QueryPanel').default>[0]"));
  assert(page.includes('from "../server/ServerSummary"'));
  assert(page.includes('from "../shared/SharedStatus"'));
  assert(page.includes('from "../shared/CounterDetails"'));
  assert(!page.includes("client_components/client/InteractiveCounter"));
  assert(!page.includes('from "../client/InteractiveCounter"'));
  assert(!page.includes("InteractiveCounterProps"));

  const manifest = JSON.parse(
    fs.readFileSync(path.join(NEXT_APP, ".nextjshx/manifest.json"), "utf8"),
  );
  assert.deepEqual(
    manifest.outputs.map((output) => output.path),
    GENERATED_ADAPTERS,
  );
}

function verifyProductionBuild() {
  run("npm", ["run", "build", "--workspace", "@nextjshx/cli-internal"]);
  linkDependencies();
  const output = run(process.execPath, [CLI, "build", "--", "--turbopack"], {
    cwd: NEXT_APP,
  });
  assert(output.includes("Compiled successfully"));
  assert(output.includes("build: passed"));
  generatedProof();

  const generatedBefore = treeDigest(path.join(NEXT_APP, "src-gen"));
  const adaptersBefore = GENERATED_ADAPTERS.map((relative) =>
    crypto.createHash("sha256").update(fs.readFileSync(path.join(NEXT_APP, relative))).digest("hex"),
  );
  const regenerate = run(process.execPath, [CLI, "generate"], { cwd: NEXT_APP });
  assert(regenerate.includes("unchanged (10)"));
  assert.deepEqual(treeDigest(path.join(NEXT_APP, "src-gen")), generatedBefore);
  assert.deepEqual(
    GENERATED_ADAPTERS.map((relative) =>
      crypto.createHash("sha256").update(fs.readFileSync(path.join(NEXT_APP, relative))).digest("hex"),
    ),
    adaptersBefore,
  );
}

async function reservePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  assert(typeof address === "object" && address !== null);
  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  return address.port;
}

async function browserExecutable() {
  const configured = process.env.NEXTJSHX_CHROME;
  const candidates = [
    configured,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ].filter((candidate) => candidate !== undefined);
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  throw new ClientComponentFailure("no Chrome/Chromium executable found; configure NEXTJSHX_CHROME");
}

async function waitForServer(port) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const ready = await new Promise((resolve) => {
      const socket = net.createConnection({ host: "127.0.0.1", port });
      const finish = (result) => {
        socket.destroy();
        resolve(result);
      };
      socket.once("connect", () => finish(true));
      socket.once("error", () => finish(false));
      socket.setTimeout(500, () => finish(false));
    });
    if (ready) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new ClientComponentFailure("production server did not become ready");
}

async function expectQueryParam(page, key, expected) {
  await page.waitForFunction(
    ({ queryKey, queryValue }) =>
      new URL(window.location.href).searchParams.get(queryKey) === queryValue,
    { queryKey: key, queryValue: expected },
  );
  assert.equal(new URL(page.url()).searchParams.get(key), expected);
}

async function stopServer(child, exitPromise) {
  if (child.exitCode === null && child.signalCode === null) {
    child.kill("SIGTERM");
    await Promise.race([exitPromise, new Promise((resolve) => setTimeout(resolve, 5_000))]);
  }
  if (child.exitCode === null && child.signalCode === null) {
    child.kill("SIGKILL");
    await exitPromise;
  }
}

async function verifyHydration(viewport, verifyAllInteractions) {
  const port = await reservePort();
  const child = spawn(
    process.execPath,
    [NEXT, "start", ".", "-H", "127.0.0.1", "-p", String(port)],
    {
      cwd: NEXT_APP,
      env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let serverOutput = "";
  child.stdout.on("data", (chunk) => {
    serverOutput += chunk;
  });
  child.stderr.on("data", (chunk) => {
    serverOutput += chunk;
  });
  const exitPromise = new Promise((resolve) => child.once("exit", resolve));
  try {
    await waitForServer(port);
    const browser = await chromium.launch({
      executablePath: await browserExecutable(),
      headless: true,
      args: ["--disable-dev-shm-usage", "--no-sandbox"],
    });
    try {
      const page = await browser.newPage({ viewport });
      const pageErrors = [];
      const consoleErrors = [];
      const failedResponses = [];
      page.on("pageerror", (error) => pageErrors.push(error.message));
      page.on("console", (message) => {
        if (message.type() === "error") {
          consoleErrors.push(message.text());
        }
      });
      page.on("response", (response) => {
        if (response.status() >= 400) {
          failedResponses.push(`${response.status()} ${response.url()}`);
        }
      });
      const navigation = page.goto(`http://127.0.0.1:${port}/`, {
        waitUntil: "networkidle",
        timeout: 20_000,
      });
      const flightLoading = page.locator("#flight-loading");
      const rejectionLoading = page.locator("#flight-rejection-loading");
      await Promise.all([
        flightLoading.waitFor({ state: "visible", timeout: 5_000 }),
        rejectionLoading.waitFor({ state: "visible", timeout: 5_000 }),
      ]);
      assert.equal(await page.locator("#flight-promise").count(), 0);
      assert.equal(await page.locator("#flight-rejection").count(), 0);

      await navigation;
      const value = page.locator("#client-counter-value");
      await value.waitFor({ state: "visible" });
      assert.equal(await value.textContent(), "2");
      assert.equal(await page.locator("#client-counter-panel").getAttribute("data-tone"), "tide");
      assert.equal(await page.locator("#client-counter-panel").getAttribute("data-pathname"), "/");
      assert.equal(await page.locator("#server-summary").textContent(), "Ordinary Haxe Server Component");
      assert.equal(await page.locator(".shared-status").count(), 2);
      assert.equal(await page.locator("#client-counter-child").textContent(), "Server-rendered child composition");
      assert.match(await page.locator("#client-counter-panel small").textContent(), /fresh$/);

      const flightPromise = page.locator("#flight-promise");
      await flightPromise.waitFor({ state: "visible" });
      assert.equal(await page.locator("#flight-date").textContent(), "2026-07-26T12:00:00.000Z");
      assert.equal(await page.locator("#flight-map").textContent(), "42");
      assert.equal(await page.locator("#flight-set").textContent(), "typed");
      assert.equal(await page.locator("#flight-buffer").textContent(), "35");
      assert.equal(await page.locator("#flight-symbol").textContent(), "Symbol(nextjshx.flight)");
      assert.equal(await flightPromise.textContent(), "Resolved through React use / 19");
      assert.equal(await flightLoading.count(), 0);
      const flightRejection = page.locator("#flight-rejection");
      await flightRejection.waitFor({ state: "visible" });
      assert.equal(
        await flightRejection.textContent(),
        "Rejected Flight value reached the Error Boundary",
      );
      assert.equal(await rejectionLoading.count(), 0);
      assert.equal(await page.locator("#unexpected-flight-resolution").count(), 0);
      assert.equal(await page.locator("#flight-action-result").textContent(), "not called");
      await page.locator("#flight-action").click();
      await page.waitForFunction(
        () =>
          document.querySelector("#flight-action-result")?.textContent ===
          "Server Function received flight-boundary",
      );

      const queryView = page.locator("#query-view");
      await queryView.waitFor({ state: "visible" });
      assert.equal(await queryView.textContent(), "all");
      assert.equal(await page.locator("#query-search").textContent(), "none");
      assert.equal(await page.locator("#query-page").textContent(), "1");
      assert.equal(await page.locator("#query-progress").textContent(), "0.5");
      assert.equal(await page.locator("#query-archived").textContent(), "no");
      assert.equal(await page.locator("#native-query-label").textContent(), "native");

      if (verifyAllInteractions) {
        await page.locator("#query-active").click();
        await page.waitForFunction(
          () => document.querySelector("#query-view")?.textContent === "active",
        );
        await expectQueryParam(page, "view", "active");

        await page.locator("#query-done").click();
        await page.waitForFunction(
          () => document.querySelector("#query-view")?.textContent === "done",
        );
        await expectQueryParam(page, "view", "done");

        await page.goBack();
        await page.waitForFunction(
          () => document.querySelector("#query-view")?.textContent === "active",
        );
        await expectQueryParam(page, "view", "active");

        await page.goForward();
        await page.waitForFunction(
          () => document.querySelector("#query-view")?.textContent === "done",
        );
        await expectQueryParam(page, "view", "done");

        await page.locator("#query-all").click();
        await page.waitForFunction(
          () => document.querySelector("#query-view")?.textContent === "all",
        );
        await expectQueryParam(page, "view", null);

        await page.locator("#query-search-haxe").click();
        await page.waitForFunction(
          () => document.querySelector("#query-search")?.textContent === "haxe",
        );
        await expectQueryParam(page, "search", "haxe");
        await page.locator("#query-search-clear").click();
        await page.waitForFunction(
          () => document.querySelector("#query-search")?.textContent === "none",
        );
        await expectQueryParam(page, "search", null);

        await page.locator("#query-next-page").click();
        await page.waitForFunction(
          () => document.querySelector("#query-page")?.textContent === "2",
        );
        await expectQueryParam(page, "page", "2");
        await page.locator("#query-increase-progress").click();
        await page.waitForFunction(
          () => document.querySelector("#query-progress")?.textContent === "0.6",
        );
        await expectQueryParam(page, "progress", "0.6");
        await page.locator("#query-toggle-archived").click();
        await page.waitForFunction(
          () => document.querySelector("#query-archived")?.textContent === "yes",
        );
        await expectQueryParam(page, "archived", "true");

        await page.locator("#native-query-change").click();
        await page.waitForFunction(
          () => document.querySelector("#native-query-label")?.textContent === "typed",
        );
        await expectQueryParam(page, "nativeLabel", "typed");
        await page.locator("#native-query-clear").click();
        await page.waitForFunction(
          () => document.querySelector("#native-query-label")?.textContent === "native",
        );
        await expectQueryParam(page, "nativeLabel", null);

        await page.locator("#client-counter-button").click();
        await page.waitForFunction(
          () => document.querySelector("#client-counter-value")?.textContent === "3",
        );
        assert.equal(await value.textContent(), "3");
      }
      assert.deepEqual(pageErrors, []);
      const expectedFlightRejections = consoleErrors.filter((message) =>
        message.includes(
          "An error occurred in the Server Components render. The specific message is omitted in production builds to avoid leaking sensitive details.",
        ),
      );
      assert.equal(
        expectedFlightRejections.length,
        1,
        `expected one sanitized rejected-Flight console report; got ${consoleErrors.join(" | ")}`,
      );
      assert.deepEqual(
        consoleErrors.filter((message) => !expectedFlightRejections.includes(message)),
        [],
        `browser console errors; failed responses: ${failedResponses.join(", ")}`,
      );
      assert.deepEqual(failedResponses, []);
    } finally {
      await browser.close();
    }
  } finally {
    await stopServer(child, exitPromise);
  }
  assert(serverOutput.includes("Ready"));
}

try {
  clean();
  verifyToolchainAndSources();
  verifyPlanAndDeterminism();
  verifyMemoSnapshotRuntime();
  verifyNegativeControls();
  verifyProductionBuild();
  await verifyReactLint();
  await verifyHydration({ width: 1280, height: 800 }, true);
  await verifyHydration({ width: 390, height: 844 }, false);
  console.log(
    `client-components: OK: deterministic Hook-aware output, ${NEGATIVE_CASES.size + 2} exact Haxe failures, generated/native official React lint, scalar snapshot runtime, strict Next production build, streamed Flight replacement, and desktop/mobile hydrated Haxe interaction`,
  );
} catch (error) {
  console.error(`[client-components] ERROR: ${error.stack ?? error.message}`);
  process.exitCode = 1;
} finally {
  clean();
}
