import assert from "node:assert/strict";
import test from "node:test";

import {
  loadManifest,
  selectLanes,
  validateManifestValue,
} from "./test-lanes.mjs";

const manifest = loadManifest();

function idsFor(changedPath) {
  return new Set(
    selectLanes(manifest, [changedPath]).selectedLanes.map(({ lane }) => lane.id),
  );
}

function requireIds(changedPath, expected) {
  const ids = idsFor(changedPath);
  for (const id of expected) {
    assert(ids.has(id), `${changedPath} did not select ${id}`);
  }
  return ids;
}

test("ordinary documentation uses the declared fast path", () => {
  assert.deepEqual(
    [...idsFor("docs/getting-started.md")].sort(),
    ["docs.general", "loop.validate"],
  );
});

test("route semantics select their focused and downstream owners", () => {
  requireIds("src/nextjshx/route/RoutePatternParser.hx", [
    "route.patterns",
    "page.layouts",
    "route.handlers",
    "route.hrefs",
    "fixture.stable.primary",
  ]);
});

test("raw Next bindings select inventory, strict consumers, and the primary fixture", () => {
  requireIds("src/nextjs/raw/Navigation.hx", [
    "next.bindings",
    "next.core.navigation",
    "next.components",
    "next.server",
    "fixture.stable.primary",
  ]);
});

test("Client Component and Hook changes select React and browser owners", () => {
  requireIds("src/nextjshx/client/ReactHooksMacro.hx", [
    "client.components",
    "fixture.stable.primary",
    "example.mixed.full",
    "showcases.all",
    "todo.e2e",
  ]);
});

test("Server Function, cache, and codec changes select focused production evidence", () => {
  requireIds("src/nextjshx/server/ServerFunctionMacro.hx", [
    "server.functions",
    "fixture.stable.primary",
    "todo.e2e",
  ]);
  requireIds("src/nextjshx/cache/CacheFunctionMacro.hx", [
    "cache.boundaries",
    "fixture.stable.primary",
    "todo.e2e",
  ]);
  requireIds("src/nextjs/codec/FormDataDecoder.hx", [
    "codecs",
    "server.functions",
    "route.handlers",
    "todo.e2e",
  ]);
});

test("CLI publication and dev-loop changes expand beyond unit tests", () => {
  requireIds("tools/cli/src/generated-output-publisher.ts", [
    "cli.publication",
    "cli.all",
    "fixture.stable.primary",
    "cli.dev",
  ]);
  requireIds("tools/cli/src/dev.ts", [
    "cli.dev",
    "cli.all",
    "fixture.stable.primary",
  ]);
});

test("one showcase stays selectable and shared UI expands to every consumer", () => {
  requireIds("examples/showcase-blog/haxe/blog/app/HomePage.hx", [
    "showcases.source",
    "showcase.blog",
    "showcases.all",
  ]);
  requireIds("examples/showcase-ui/src/components/ui/button.tsx", [
    "showcase.ui",
    "showcase.landing",
    "showcase.blog",
    "showcase.commerce",
    "showcase.field-atlas",
    "todo.build",
  ]);
});

test("Field Atlas and Todo have maintained owners", () => {
  requireIds("examples/showcase-field-atlas/haxe/field_atlas/app/HomePage.hx", [
    "showcases.source",
    "showcase.field-atlas",
    "showcases.all",
  ]);
  requireIds("examples/todoapp-next/haxe/todoapp/actions/TodoActions.hx", [
    "todo.source",
    "todo.build",
    "todo.smoke",
    "todo.e2e",
  ]);
});

test("shared styled-example development tooling selects every consumer", () => {
  requireIds("scripts/examples/dev-with-styles.mjs", [
    "cli.dev",
    "example.mixed.full",
    "todo.build",
    "todo.smoke",
    "todo.e2e",
    "showcases.all",
  ]);
});

test("workflow, selector, support, and lock changes fail safe to full validation", () => {
  for (const changedPath of [
    ".github/workflows/governance.yml",
    "config/test-lanes.json",
    "support_matrix.json",
    "package-lock.json",
    "tools/cli/package.json",
  ]) {
    const selection = selectLanes(manifest, [changedPath]);
    assert.equal(selection.fullExpansion, true, `${changedPath} did not expand fully`);
    assert.equal(
      selection.selectedLanes.length,
      manifest.lanes.length,
      `${changedPath} omitted a lane during full expansion`,
    );
  }
});

test("unowned paths fail safe instead of selecting nothing", () => {
  const selection = selectLanes(manifest, ["new/unowned-contract.bin"]);
  assert.deepEqual(selection.unmatched, ["new/unowned-contract.bin"]);
  assert.equal(selection.fullExpansion, true);
  assert.equal(selection.selectedLanes.length, manifest.lanes.length);
});

test("manifest validation rejects a stale reverse dependency", () => {
  const invalid = structuredClone(manifest);
  invalid.lanes[0].reverseDependencies.push("missing.lane");
  assert.throws(
    () => validateManifestValue(invalid),
    /references unknown reverse dependency missing\.lane/,
  );
});
