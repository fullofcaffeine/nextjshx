# ADR 0003: Boundary classification and import-graph enforcement

- Status: Accepted
- Date: 2026-07-17
- Decision owners: project owner and NextJsHx maintainers
- Related Beads: `nxhx-f34.5.1` (`NXHX-C01`), `nxhx-f34.5.2` (`NXHX-C02`),
  `nxhx-f34.5.3` (`NXHX-C03`), `nxhx-f34.5.5` (`NXHX-C05`)
- Related PRD sections: 12.1–12.6, 16.2, 17.2, 19.1–19.3

> Component-authoring amendment: ADR 0004 preserves this graph model and
> generated client edge while selecting zero-argument client metadata plus the
> caller-sensitive `Component.client()` extension as the primary Haxe API.
> Explicit paths and `ClientComponent.ref(Type)` remain compatibility forms.

## Context

In an App Router application, a module's environment is not merely a Haxe or
TypeScript type detail. It determines whether code enters the React Server
Component graph, the browser bundle, a Server Function entry, or a cached
execution scope. Next.js interprets directives and complete transitive imports;
Haxe initially sees only the Haxe modules that were typed for one compiler run.

The relevant native contracts are:

- pages, layouts, and ordinary App Router components are Server Components by
  default;
- [`"use client"`](https://nextjs.org/docs/app/api-reference/directives/use-client)
  declares an entry into the client graph, and all runtime imports below that
  entry become client-bundle dependencies;
- [`"use server"`](https://nextjs.org/docs/app/api-reference/directives/use-server)
  marks a module whose exported async functions are callable Server Functions;
- [`"use cache"`](https://nextjs.org/docs/app/api-reference/directives/use-cache)
  changes execution and serialization rules at an exact module or function
  prologue;
- `server-only` and `client-only` are binding-free side-effect imports that let
  Next reject a module reached from the wrong graph; and
- strict TypeScript and `next build` see generated adapters, native TypeScript,
  third-party packages, conditional exports, and framework transforms that a
  Haxe macro cannot completely reconstruct.

### Why this decision was needed

While implementing the stable Haxe error boundary, Route Handler, codec layer,
and production fixtures, three distinct graphs became observable:

1. Haxe DCE sees Haxe reachability, but not a caller that exists only in a
   generated TypeScript adapter.
2. genes-ts emits one ECMAScript module per Haxe module and permits one owner
   for its generic `@:genes.moduleDirective` plan. Multiple top-level Haxe
   declarations in the same module cannot truthfully claim different runtime
   boundaries.
3. Next applies client/server rules to the final transitive JavaScript module
   graph. A locally type-correct Haxe import can therefore be an invalid or
   secret-leaking Next import.

Without a locked policy, the client-component, Server Function, environment,
serializability, and cache Beads could each invent a different meaning for
"boundary." That would create late Next failures, over-retained Haxe output, or
worse, a false claim that a macro had proved a graph it could not see.

The policy must improve Haxe authoring ergonomics with early, source-positioned
errors while preserving Next's native runtime and independent build checks. It
must not add a parallel component graph, RPC protocol, cache runtime, or secret
transport.

## Decision

### Classification model

Every repository-supported application module has one primary graph
classification. Cache intent is an additional execution boundary with stricter
compatibility rules, not a third client/server universe.

| Classification | Haxe authoring signal | Generated/runtime effect | Valid direct dependencies |
| --- | --- | --- | --- |
| Server default | Implicit for `@:next.page`, `layout`, `loading`, `notFound`, and `route`; ordinary server roots inherit it | No client/server directive; ordinary Next server behavior | server-default services, shared-pure modules, explicit server-only modules, and generated boundary refs |
| Client boundary | `@:next.clientComponent(path)` | Adapter starts with exactly `"use client"`; its runtime dependency closure enters the client graph | client modules, shared-pure modules, explicit client-only modules, and generated Server Function refs |
| Server Function module | `@:next.serverFunctions(path)` | Adapter starts with exactly `"use server"` and exports only validated async functions | server services, shared-pure modules, and explicit server-only modules |
| Shared pure | `@:next.shared` when an application wants an explicit reusable contract | No directive or environment import; the same module may be reached by server and client graphs | other shared-pure modules only, plus target-neutral value/type dependencies |
| Explicit server-only | `@:next.serverOnly` | Runtime module contains a binding-free `import "server-only"` before application statements | server-default, server-only, and shared-pure modules |
| Explicit client-only | `@:next.clientOnly` | Runtime module contains a binding-free `import "client-only"` before application statements | client, client-only, and shared-pure modules |
| Cache boundary | `@:next.cache`, `@:next.cachePrivate`, or `@:next.cacheRemote` on a standalone function owner or page/layout | Exact reviewed cache directive at module or function scope plus direct public Next cache calls | the underlying eligible server graph, subject to cache serialization and request-API restrictions |

The specialized `@:next.*` signals are semantic authoring metadata. They
produce a closed internal enum and adapter/analysis intent; they do not emit a
runtime `Boundary` object. Cache metadata maps to the `Cache` classification
defined here rather than creating another graph model.

Unannotated helper code is not automatically advertised as shared. It inherits
the graph of its runtime importer. A module intended for both graphs uses
`@:next.shared` and must satisfy the shared-pure checks. This makes the safe
cross-graph promise explicit without burdening ordinary server-local helpers
with boilerplate.

### One Haxe module, one boundary

A Haxe source module is the smallest classification unit. All top-level
classes, enums, typedefs, module functions, static initialization, and runtime
imports emitted from one `.hx` module share one classification.

Therefore:

- one Haxe module may have at most one primary boundary metadata owner;
- a client component and Server Function cannot be declared in the same Haxe
  module, even when they are separate classes;
- a shared or explicit environment marker cannot coexist with an incompatible
  boundary annotation in the same module;
- a module-level cache directive cannot coexist with `"use client"` or
  module-level `"use server"` unless a future, version-pinned Next fixture
  demonstrates and explicitly admits that combination; and
- application code splits conflicting declarations into separate `.hx` files.

This is an ergonomic alignment with both Haxe and ECMAScript semantics, not an
arbitrary style rule. genes-ts already rejects multiple generic directive
owners in one emitted module. Next interprets directives at module scope, so
allowing per-class contradictions would promise isolation that does not exist.

### Import and reference policy

A direct Haxe runtime import means the imported implementation participates in
the importer's emitted dependency graph. Generated references are used only
for the two native cross-boundary edges that Next supports.

| Importer | Target | Decision |
| --- | --- | --- |
| Server default | Client boundary | Use the generated typed component ref/adapter; do not import the raw Haxe implementation value |
| Client boundary | Server Function | Use the generated typed function ref/adapter; do not import the raw server implementation value |
| Client boundary | Client or client-only | Direct runtime import is allowed once the importer is already inside the client graph |
| Server default or Server Function | Server-only service | Direct runtime import is allowed |
| Any matching graph | Shared pure | Direct runtime import is allowed |
| Shared pure | Any environment-specific module/API | Rejected; reclassify or move the dependency behind a boundary |
| Client/client-only | Server-default, server-only, request APIs, private environment access | Rejected |
| Server/server-only | Client-only implementation | Rejected; a Server Component may render only the generated client entry |
| Any module | Raw implementation of another boundary solely to obtain a route, component, or action handle | Rejected; use the generated semantic companion/ref |

Server Components may pass rendered server content as children or another
supported slot to a Client Component. That is a serialized React composition
edge, not a client module importing the Server Component implementation.

A Server Function implementation that contains reusable business logic should
delegate to a separate server-only service. Other server code imports that
service, not the action implementation. This avoids accidentally bypassing the
Server Function entry semantics and gives authentication/authorization one
visible boundary.

### Positive example: explicit native boundary refs

The intended Haxe shape keeps implementation imports on their owning sides:

```haxe
@:next.clientComponent("todos/_components/TodoToggle")
class TodoToggle {
  public static function render(props:TodoToggleProps):Element {
    return <button>{props.label}</button>;
  }
}

@:next.serverFunctions("todos/actions")
class TodoActions {
  @:next.action
  @:async
  public static function toggle(id:TodoId):Promise<ActionResult> {
    return Todos.toggleAuthorized(id);
  }
}

@:next.page("todos")
class TodoPage {
  public static function render(props:PageProps<NoParams, SearchParams>):Element {
    final Toggle = ClientComponent.ref(TodoToggle);
    final toggle = ServerFunction.ref(TodoActions.toggle);
    return <Toggle label={"Toggle"} action={toggle} />;
  }
}
```

The exact `ClientComponent.ref` and `ServerFunction.ref` implementations belong
to their dependent Beads. Their required semantics are fixed here:

- the server output imports the generated client adapter, not
  `TodoToggle`'s raw genes implementation;
- the client output imports the generated `"use server"` action export, not
  `TodoActions`' raw implementation;
- props/arguments/results retain precise Haxe and emitted TypeScript types;
- cross-boundary values pass the conservative serializability checker; and
- no broad component/function cast or custom invocation envelope is emitted.

### Negative examples: fail before publication

Importing a raw client implementation from a server page is invalid:

```haxe
import app.client.TodoToggle;

@:next.page("todos")
class TodoPage {
  public static function render(props):Element {
    return TodoToggle.render({label: "unsafe direct edge"});
  }
}
```

NextJsHx must report the raw implementation edge at the Haxe source position
and direct the author to the generated component ref. No adapter plan is
published.

Conflicting declarations in one source module are also invalid:

```haxe
@:next.clientComponent("counter")
class Counter {}

@:next.serverFunctions("actions")
class Actions {}
```

Splitting the declarations into two files is the fix. Moving both directives
onto one owner is not: `"use client"` and `"use server"` describe incompatible
module entry semantics.

An explicitly shared module cannot read server request state:

```haxe
@:next.shared
class SharedLabels {
  public static function current():Promise<String> {
    return Headers.headers().then(value -> value.get("x-label"));
  }
}
```

Known direct use fails the Haxe boundary audit. A hidden native TypeScript or
third-party transitive edge remains a mandatory Next build failure; it is never
declared safe merely because Haxe could not inspect it.

### Directive and side-effect ownership

NextJsHx owns directives on generated convention adapters:

- client adapters contain exactly one first-position `"use client"`;
- Server Function adapters contain exactly one first-position `"use server"`;
- cache adapters/functions contain only the version-approved cache directive;
- ordinary server and shared adapters contain no client/server directive.

The renderer validates the directive vocabulary for each adapter kind and
places directives before imports. Application code does not repeat a
TypeScript-only directive string when semantic metadata already owns it.

For a Haxe implementation module that genuinely emits directly as the
boundary, genes-ts's generalized `@:genes.moduleDirective("literal")` is the
only compiler primitive. It captures intent before DCE, deduplicates exact
literals, rejects computed/empty/conflicting owners, and emits before imports
in both TypeScript and classic ESM. Next-specific vocabulary stays in
NextJsHx. Direct implementation emission remains subject to ADR 0001's
admission criteria; it is not the default shortcut around adapters.

`@:next.serverOnly` and `@:next.clientOnly` use the generic binding-free
side-effect import capability equivalent to
`genes.ts.Imports.sideEffect("server-only")` or `"client-only"`. The marker is
not represented as a fake default/namespace value and does not survive as a
runtime helper call. C05 implements the exact metadata injection, named
server-environment seam, Haxe-visible import diagnostics, browser-chunk
containment proof, and negative Next fixture documented in
[the environment-boundary reference](../environment-boundaries.md).

C02 and C03 implement the client entry described by this decision. A validated
`@:next.clientComponent` class produces a directive-first adapter, while
`ClientComponent.ref` gives a server module an exact component import without a
raw implementation edge. The conservative recursive prop allowlist, exact
rejections, DCE retention, strict build, and hydration evidence are documented
in [the Client Component reference](../client-components.md).

### DCE and external adapter callers

An adapter's TypeScript import is invisible to Haxe DCE. Boundary discovery
must therefore happen during typing, before DCE, and apply targeted retention
only to the declaration/exports named by validated adapter intent.

The policy is:

1. annotation discovery causes the source module to be typed through the
   configured application include/discovery path;
2. the owning macro validates the declaration and records boundary intent;
3. the macro adds targeted `@:keep` retention for implementation values whose
   only caller is the generated adapter;
4. the generated output proves those exact values exist and remain precisely
   typed; and
5. an unmarked negative control proves unrelated application types still
   disappear under full DCE.

Fake Haxe calls, global `--macro keep(...)`, and application-wide `@:keep` are
not permitted substitutes. For reusable published Haxe libraries,
`@:genes.library` with the compiler's library profile remains the separate
package-root policy; an application-local boundary does not pretend to be a
library.

### Enforcement ownership

No single phase claims the entire graph. Each phase fails on the facts it can
authoritatively observe.

| Phase | Required checks | Explicitly not trusted to prove |
| --- | --- | --- |
| Haxe boundary macros | unique metadata owner; declaration/signature shape; known Haxe implementation edges; closed boundary refs; direct known environment/cache API misuse; conservative serializability; source-positioned diagnostics | native TS imports, package conditional exports, bundler transforms, or all transitive runtime behavior |
| Adapter plan and renderer | closed boundary enum; canonical target; exact directives and side-effect imports; only approved implementation/ref imports; no broad types or casts; targeted DCE owner | whether a third-party dependency is truly browser/server safe |
| Generated-source audit | emitted import graph agrees with boundary manifest; boundary implementation exists; no raw cross-boundary import, private Next import, secret path, suppression, broad type, or unchecked cast | React/Next transform semantics |
| `next typegen` and strict TypeScript | exact Next route/component/action signatures and public declaration compatibility | complete runtime graph validity or secret containment |
| `next build` | final Server/Client graph, directive semantics, React Server Component and Server Function restrictions, environment poisoning markers, cache/request constraints, framework transforms | application authentication, authorization, input validation, or deployment policy |
| Runtime/browser evidence | hydration, action invocation, cache visibility/invalidation, error behavior, and absence of client console/secret leakage in the supported build | unsupported environments or versions outside the support matrix |

A Haxe error is an earlier ergonomic guard. It never disables, patches, or
replaces Next's corresponding check. Conversely, a limitation in Haxe's graph
visibility is documented as a required Next negative fixture, not papered over
with a cast.

### Cache interaction

Cache classification remains server-side and version-gated. Its implementation
preserves these rules:

- ordinary `"use cache"` scopes are async and cannot directly read request-time
  cookies, headers, or search params;
- the preferred shape reads request values outside the cached scope and passes
  decoded, serializable values as arguments;
- direct known request API calls inside an ordinary cache scope receive an
  early Haxe diagnostic;
- native/transitive violations remain blocking Next build fixtures;
- `"use cache: private"` and `"use cache: remote"` are separate capabilities,
  never aliases silently selected by the semantic layer; and
- a cache marker cannot make client code, secrets, opaque handles, or
  non-serializable values safe.

### Environment and security boundary

Explicit `server-only`/`client-only` markers complement types; they do not
sanitize a value. A server-only module may still return a secret accidentally,
and a Server Function remains a remotely invokable security boundary.

Therefore:

- generated client helpers never expose the whole environment object;
- only explicitly public environment values may enter client output;
- non-public environment access is placed in an explicit server-only module;
- client/server props, action arguments/results, request bodies, form fields,
  query values, headers, and cookies are decoded/serialized at their actual
  boundary;
- sensitive Server Functions authenticate and authorize inside the server
  boundary and read auth context from server APIs rather than accepting a
  caller-supplied token; and
- NextJsHx does not treat Next's replacement of non-public client environment
  variables with empty strings as a containment strategy.

## Consequences

Positive consequences:

- Haxe authors use named semantic metadata and generated typed refs instead of
  manually spelling directives, adapter paths, or stringly module imports.
- Obvious cross-boundary mistakes fail at the Haxe source position before
  publication while Next remains the final graph oracle.
- One-module-per-boundary matches genes-ts emission and prevents a class-level
  abstraction from lying about module-level runtime semantics.
- DCE retention is narrow, testable, and does not pull unrelated server code
  into browser output.
- Existing generic genes-ts directive and side-effect support is reused; no
  framework-specific compiler change is needed.
- Native TypeScript and gradual-adoption code remain first-class because the
  policy explicitly assigns their validation to strict TypeScript and Next.

Costs and limitations:

- Conflicting client/server declarations require separate Haxe files.
- Cross-boundary rendering/calls use generated refs even when a direct Haxe
  import would appear shorter.
- Shared-pure is a real promise and therefore more restrictive than an
  unannotated helper used on one side only.
- Some transitive or framework-specific errors necessarily appear only during
  `next build`; the project must maintain those negative fixtures.
- Downstream C02–C06 work must add exact syntax, diagnostics, and runtime
  evidence within this policy instead of redefining the graph.

## Rejected alternatives

### Rely only on Next build diagnostics

Rejected because Haxe knows declaration identity, source positions, raw versus
generated refs, and application types early. Deferring an obvious raw client
implementation import or conflicting module marker loses useful Haxe
ergonomics and allows invalid adapter plans to reach the filesystem. Next build
remains mandatory for the graph facts Haxe cannot see.

### Enforce the complete graph exclusively in Haxe

Rejected because Haxe cannot authoritatively inspect native TypeScript,
third-party conditional exports, Next transforms, React serialization, or the
final bundled graph. Claiming complete enforcement would create false security
and couple NextJsHx to private compiler details.

### Infer boundaries only from imported APIs

Rejected because type-only imports, wrapper modules, third-party components,
conditional calls, and environment helpers make inference incomplete and
unstable. Explicit boundary entry metadata plus audited dependencies is more
predictable. Known invalid API use may still improve a diagnostic.

### Put every directive directly on genes-ts implementation modules

Rejected as the default because Next still requires exact convention
filenames, default/named exports, and independently typed adapters. It would
also force authors to repeat framework strings and make mixed declarations in
one Haxe module ambiguous. Generic direct emission remains possible only under
ADR 0001's evidence-based admission criteria.

### Retain implementations with fake calls or broad DCE roots

Rejected because fake calls alter runtime graphs and broad retention can pull
private/server code into output. Targeted macro-owned retention plus exact
generated import evidence is sufficient.

### Add a custom client/server runtime or RPC envelope

Rejected because Next and React already own component transport, Server
Function invocation, cache behavior, and deployment integration. A parallel
runtime would change semantics, complicate security, and undermine native
interop.
