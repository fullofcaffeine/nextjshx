# Environment-boundary fixture

This fixture proves explicit Haxe environment markers without replacing
Next.js's final module-graph validation.

The positive compilation retains `@:next.serverOnly` and `@:next.clientOnly`
owners under full DCE, emits exact binding-free imports in genes-ts TypeScript
and classic ESM, and passes strict TypeScript. A real Next 16.2.12 build reads
one named server value and proves its key and sentinel are absent from browser
chunks.

Four isolated Haxe compilations reject known request access, client-to-server,
server-to-client, and conflicting module-owner edges. The runner then copies a
tracked native negative control beneath `app/`, requires Next's production
build to reject the client import of `server-only`, and removes every generated
or temporary artifact in `finally` cleanup.

Run:

```sh
npm run test:environment-boundaries
```

See [the environment-boundary reference](../../docs/environment-boundaries.md)
for the authoring contract, examples, diagnostics, and security limits.
