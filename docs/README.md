# NextJsHx documentation

NextJsHx keeps ordinary Next.js architecture and adds a typed Haxe authoring
layer. Choose the shortest path below for the work you are doing.

## Start here

- [Architecture](architecture.md): runtime boundaries, ownership, and the raw
  versus semantic API layers.
- [CLI workflow](cli.md): initialize, generate, watch, build, inspect routes,
  and recover safely.
- [Configuration](configuration.md): the closed project configuration and
  toolchain contract.
- [Compatibility](compatibility.md): exact supported Haxe, genes-ts, Node,
  Next.js, React, and TypeScript versions.
- [Testing strategy](testing-strategy.md): which guarantees come from Haxe,
  generated TypeScript, Next builds, runtime tests, and browser evidence.

## Build an application

- [Pages and layouts](pages-and-layouts.md)
- [Typed route hrefs](route-hrefs.md) and
  [typed query strings](route-queries.md)
- [Client Components](client-components.md) and
  [React Hooks](react-hooks.md)
- [Server Functions](server-functions.md)
- [Route Handlers](route-handlers.md)
- [Closed JSON, form, and query codecs](codecs.md)
- [Cache Components](cache-components.md)
- [Server, client, shared, and environment boundaries](environment-boundaries.md)
- [Metadata and segment config](metadata-and-segment-config.md)
- [Special files](special-files.md)
- [Proxy](proxy.md)
- [MDX and content blocks](mdx-and-content.md)

## Adopt and extend the ecosystem

- [Bindings and bidirectional interop](bindings-and-interop.md)
- [Mixed-language adoption](mixed-language-adoption.md)
- [Reviewed package integrations](package-integrations.md)
- [Radix and shadcn](radix-shadcn.md)
- [dnd-kit](dnd-kit.md), [Recharts](recharts.md),
  [nuqs](nuqs.md), and [cmdk](cmdk.md)

## See complete examples

- [Flagship todo app](todoapp-flagship.md)
- [Maintained showcase sites](showcases.md)
- [Mixed native TypeScript and Haxe application](mixed-language-adoption.md)

## Compiler and generated-output internals

- [Binding policy](binding-policy.md)
- [Adapter plan](adapter-plan.md)
- [Generated-output ownership](generated-output-ownership.md)
- [Transactional publication and recovery](generated-output-publication.md)
- [Compiler gap inventory](compiler-gap-inventory.md)
- [Genes extraction review](genes-extraction-review.md): which reusable
  compiler/tooling mechanisms belong upstream and which Next policy remains
  local.
- [Genes generator-orchestration decision](genes-generator-orchestration-decision.md):
  the reusable crash-recovery, HXML/watch, and Haxe compiler-server kernels,
  plus the framework policy that must remain local.
- [Accepted architecture decisions](adr/README.md)

The repository is pre-release. Treat the
[machine-readable compatibility matrix](../support_matrix.json) and executable
tests as the exact contract when prose and implementation appear to differ.
