# Environment boundaries and server environment access

This reference describes the implemented `server-only`/`client-only` module
markers, the Haxe-visible import audit, and named server environment access.
The normative graph model is
[ADR 0003](adr/0003-boundary-classification-and-import-graph-enforcement.md).

## Why this layer was needed

While developing the Haxe App Router pages, client error boundary, Route
Handlers, and production fixtures, a gap appeared between three valid but
different views of the program:

1. Haxe can inspect typed Haxe dependencies and report an error at the original
   `.hx` expression.
2. genes-ts emits one ECMAScript module for one Haxe module and must retain a
   boundary marker even under full DCE.
3. Next.js sees the complete graph, including generated adapters, native
   TypeScript, packages, and browser/server transforms.

A Haxe type alone cannot tell Next that a module contains private server code.
Conversely, waiting for every error to surface during a production Next build
would discard Haxe's better source positions and knowledge of semantic
metadata. The implementation therefore adds an early Haxe guard and emits
Next's ordinary poisoning imports. It does not introduce a new runtime,
environment loader, or client/server protocol.

## Authoring contract

Use an explicit marker for a helper whose implementation belongs to only one
environment:

```haxe
@:next.serverOnly
class PrivateCatalog {
	public static function endpoint():String {
		return ServerEnvironment.require("CATALOG_ENDPOINT");
	}
}

@:next.clientOnly
class BrowserLabels {
	public static function loading():String {
		return "Loading catalog";
	}
}
```

The boundary pass emits one binding-free `import "server-only"` or
`import "client-only"` in the owning generated module. Authors do not call
`genes.ts.Imports.sideEffect` themselves, invent a fake import binding, or add
TypeScript marker files by hand. The marker survives full DCE through targeted
retention of the annotated owner.

One `.hx` module has one primary boundary. Two top-level classes in the same
file cannot claim different markers. Put them in separate modules so the Haxe
model remains truthful about the emitted ECMAScript module.

The same audit recognizes the server-default App Router metadata, client
boundaries, Server Function modules, and explicit `@:next.shared` modules.
Known invalid direct Haxe edges fail early. Unannotated helpers inherit the
graph of their importer; they are not implicitly advertised as safe for both
environments.

## Positive: named server environment access

`nextjs.env.ServerEnvironment` exposes only one name at a time:

```haxe
import genes.ts.Undefinable;
import nextjs.env.ServerEnvironment;

@:next.serverOnly
class ServerSecrets {
	public static inline final KEY:String = "CATALOG_TOKEN";

	public static function configured():Bool {
		final value = ServerEnvironment.get(KEY);
		final absent:Bool = Undefinable.isAbsent(value);
		return !absent;
	}

	public static function token():String {
		return ServerEnvironment.require(KEY);
	}
}
```

- `ServerEnvironment.get(name)` returns `Undefinable<String>` and preserves
  JavaScript `undefined`.
- `ServerEnvironment.require(name)` returns an exact `String` or throws an
  error naming the missing key.
- The private Node seam reads `process.env[name]`; no API returns, copies, or
  serializes the complete environment object.
- The helper module itself carries `@:next.serverOnly`, so any transitive
  native client import is poisoned as well.

An ordinary Server Component can import `ServerSecrets`. The positive fixture
builds with a sentinel value, proves the rendered server result observed that
value, and then scans every emitted browser JavaScript chunk. Neither the key
nor the sentinel value may appear there.

This is containment evidence for the tested graph, not automatic data-loss
prevention. Returning a secret from a Server Function, placing it in component
props, or writing it to HTML is still an application security bug.

## Negative: a Client Component reaches server-only code

When both sides are visible to Haxe, the invalid edge fails at the call:

```haxe
import nextjs.raw.Headers;

@:next.clientOnly
class BrowserRequestState {
	public static function read() {
		return Headers.headers();
	}
}
```

The compiler reports `NXHX-BOUNDARY-REQUEST-0003` and directs the author to
move request access into a server-only service. A direct client-only call to an
`@:next.serverOnly` class similarly reports `NXHX-BOUNDARY-IMPORT-0002`.

Native TypeScript can create an edge Haxe never sees:

```tsx
"use client";

import { ServerSecrets } from "../generated/ServerSecrets";

export default function InvalidClient() {
  return <p>{ServerSecrets.configured() ? "configured" : "missing"}</p>;
}
```

The emitted `import "server-only"` makes the pinned production build fail with
`'server-only' cannot be imported from a Client Component module`. Without the
marker, the Haxe-only audit could not reject this native edge and Next would
have no explicit poison contract on the generated implementation module.

## Diagnostics

| Code | Meaning | Resolution |
| --- | --- | --- |
| `NXHX-BOUNDARY-METADATA-0001` | One owner has competing boundary metadata, two owners share one Haxe module, or an explicit marker has no concrete module owner | Keep one boundary owner per `.hx` module |
| `NXHX-BOUNDARY-IMPORT-0002` | A visible Haxe implementation edge crosses incompatible server/client/shared classifications | Use the generated native boundary ref or move neutral values into `@:next.shared` code |
| `NXHX-BOUNDARY-REQUEST-0003` | Client or shared code directly uses a known server request/cache API | Read it on the server and pass only a validated, serializable value |
| `NXHX-BOUNDARY-INIT-0004` | An existing boundary-owned `__init__` cannot safely receive the marker | Keep `__init__` static, non-generic, argument-free, and directly block-shaped |

These diagnostics cover only dependencies present in the typed Haxe
expression graph. Next remains the final graph oracle for native source,
third-party packages, conditional exports, and framework transforms. A green
Haxe compile never authorizes skipping strict TypeScript or `next build`.

## Executable evidence

Run the focused gate with the repository's pinned Node 20.19.3 toolchain:

```sh
npm run test:environment-boundaries
```

The gate requires:

- byte-identical repeated genes-ts emission in TypeScript and classic ESM;
- six exact binding-free marker imports across both profiles;
- four exact Haxe failures for request access, both import directions, and
  conflicting module owners;
- strict TypeScript 6.0.2 with `skipLibCheck: false`;
- a successful Next 16.2.12 production build whose browser chunks contain the
  client helper but neither the server key nor sentinel value; and
- a separate native Client Component violation for which `next build` must
  return a non-zero status.

The fixture is in `tests/environment-boundaries/`; its generated trees, Next
artifacts, and temporary negative route are deleted even when an assertion
fails.
