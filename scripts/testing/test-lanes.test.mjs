import assert from "node:assert/strict";
import test from "node:test";

import {
  loadManifest,
  planValue,
  printPlan,
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

test("selection explains independent product surfaces", () => {
  const selection = selectLanes(manifest, ["src/nextjshx/route/RoutePatternParser.hx"]);
  const plan = planValue(manifest, selection);
  const route = plan.selected.find((lane) => lane.id === "route.patterns");
  assert.deepEqual(route.productSurfaces, ["haxe-generation"]);
  const fixture = plan.selected.find((lane) => lane.id === "fixture.stable.primary");
  assert(fixture.productSurfaces.includes("haxe-generation"));
  assert(fixture.productSurfaces.includes("package-cli"));
  assert(fixture.productSurfaces.includes("next-runtime"));
  assert(fixture.productSurfaces.includes("react-next-semantics"));
  assert(fixture.productSurfaces.includes("compatibility-matrices"));
});

test("human explanation includes surfaces for selected and omitted lanes", () => {
  const selection = selectLanes(manifest, ["docs/getting-started.md"]);
  const plan = planValue(manifest, selection);
  const lines = [];
  const original = console.log;
  console.log = (line) => lines.push(line);
  try {
    printPlan(plan);
  } finally {
    console.log = original;
  }
  const output = lines.join("\n");
  assert.match(output, /docs\.general[\s\S]*surfaces: repository-governance/);
  assert.match(output, /haxe\.positive: no changed path[\s\S]*surfaces: haxe-generation/);
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

test("surface scorecards cannot borrow an unknown lane", () => {
  const invalid = structuredClone(manifest);
  invalid.productSurfaces[0].laneIds.push("missing.surface.owner");
  assert.throws(
    () => validateManifestValue(invalid),
    /repository-governance references unknown lane missing\.surface\.owner/,
  );
});

test("surface scorecards cannot borrow a valid lane owned by another surface", () => {
  const invalid = structuredClone(manifest);
  invalid.productSurfaces.find((surface) => surface.id === "package-cli").laneIds.push("todo.e2e");
  assert.throws(
    () => validateManifestValue(invalid),
    /package-cli borrows todo\.e2e, but that lane does not name the surface as an owner/,
  );
});

test("example claims cannot exceed the evidence their declared lanes execute", () => {
  const invalid = structuredClone(manifest);
  invalid.examples.find((example) => example.id === "showcase-ui").advertisedEvidence.push("browser");
  assert.throws(
    () => validateManifestValue(invalid),
    /showcase-ui evidence owners must match exactly/,
  );
});

test("examples cannot borrow a valid lane owned by another application", () => {
  const invalid = structuredClone(manifest);
  invalid.examples.find((example) => example.id === "showcase-ui").laneIds.push("todo.e2e");
  assert.throws(
    () => validateManifestValue(invalid),
    /showcase-ui borrows todo\.e2e, but that lane does not name the example as an owner/,
  );
});

test("surface scorecards cannot require evidence their lanes do not provide", () => {
  const invalid = structuredClone(manifest);
  invalid.productSurfaces
    .find((surface) => surface.id === "repository-governance")
    .requiredEvidence.push("browser");
  assert.throws(
    () => validateManifestValue(invalid),
    /repository-governance evidence owners must match exactly/,
  );
});

test("schema v1 manifests are rejected after scorecards became required", () => {
  const invalid = structuredClone(manifest);
  invalid.schemaVersion = 1;
  assert.throws(
    () => validateManifestValue(invalid),
    /test-lane manifest violates its schema: \/schemaVersion must be equal to constant/,
  );
});

test("tested profiles require a real lane and support-cell owner", () => {
  const invalid = structuredClone(manifest);
  const surface = invalid.productSurfaces.find((candidate) => candidate.id === "package-cli");
  surface.supportedProfiles.push("invented/profile");
  surface.testedProfiles.push("invented/profile");
  surface.profileOwners.push({profile: "invented/profile", laneIds: ["cli.all"]});
  assert.throws(
    () => validateManifestValue(invalid),
    /package-cli assigns profile invented\/profile to cli\.all, which does not execute that cell/,
  );
});

test("last clean proof is null or a closed content-addressed receipt", () => {
  const invalid = structuredClone(manifest);
  invalid.productSurfaces[0].lastCleanProof = {green: true, claim: "trust me"};
  assert.throws(
    () => validateManifestValue(invalid),
    /test-lane manifest violates its schema/,
  );
});

test("every maintained workspace has one declared example tier", () => {
  const invalid = structuredClone(manifest);
  invalid.examples = invalid.examples.filter((example) => example.id !== "showcase-blog");
  for (const lane of invalid.lanes) {
    lane.exampleIds = lane.exampleIds.filter((exampleId) => exampleId !== "showcase-blog");
  }
  assert.throws(
    () => validateManifestValue(invalid),
    /maintained workspace examples\/showcase-blog has no declared example tier/,
  );
});

test("compile-only examples cannot borrow build or browser claims", () => {
  const invalid = structuredClone(manifest);
  invalid.examples.find((example) => example.id === "showcase-landing").tier =
    "compile-only-snippet";
  assert.throws(
    () => validateManifestValue(invalid),
    /showcase-landing compile-only tier cannot advertise runtime evidence/,
  );
});
