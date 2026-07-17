# Adapter-plan contract

The adapter plan is the deterministic boundary between Haxe declaration
typing and later adapter rendering. Build macros register data; they never
write App Router convention files. After typing, the registry validates the
complete request set and emits one JSON document for renderers and tooling.

The machine-readable contract is
[adapter-plan.schema.json](../schemas/adapter-plan.schema.json). Plans identify
that schema with
`https://nextjshx.dev/schemas/adapter-plan.schema.json` and currently require
`schemaVersion: 1`. A consumer must reject an unknown version rather than
guessing how to interpret it.

## Plan contents

Every plan records exact NextJsHx, Haxe, genes-ts, and Next.js identities plus
a canonical array of adapter intents. Each intent contains:

- a closed adapter kind;
- the Haxe source type and field;
- repository-relative, slash-normalized type, field, and metadata ranges;
- the App-Router-root-relative segment and target paths;
- the implementation module and symbol;
- exact imports and ordered directive literals;
- default or named exports with their validated signature strategy; and
- tagged literal config values, never arbitrary TypeScript expressions.

Source lines and characters use Haxe's one-based `PositionTools` locations.
Absolute compiler-host paths are rejected and never serialized.

## Canonicalization

The registry applies these deterministic rules before encoding:

- intents sort by target path, adapter kind, then Haxe source name;
- imports sort by module, symbol, alias, then type-only status;
- default exports precede named exports, whose names sort bytewise;
- config entries sort by name;
- directive and string-array order is preserved because it can be semantic;
- input arrays are copied before they enter the immutable plan model; and
- JSON keys and two-space layout have a fixed encoder order and final newline.

Duplicate imports, directives, export names, config names, or adapter targets
fail with stable `NXHX-PLAN-*` diagnostics. Two intents requesting the same
target fail at the canonical second source's metadata position and name both
declarations. All registrations are canonicalized and collision-checked before
the plan directory or file is written.

## Boundary of authority

A valid plan describes requested bytes; it does not prove ownership of a live
file. It does not render TypeScript, mutate `app/**`, replace native routes, or
authorize cleanup. Rendering and transactional manifest-owned publication are
separate phases governed by ADR 0001 and their dedicated Beads.

The focused evidence command is:

```sh
npm run test:adapter-plan
```

It requires byte-identical plans from opposite registration orders, validates
the JSON Schema and reviewed snapshot, checks portable source ranges, prevents
application output, and proves duplicate-target failure preserves existing
plan bytes.
