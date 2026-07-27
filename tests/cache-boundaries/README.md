# Cache boundary fixture

This fixture proves the semantic Cache Components surface against the pinned
Next.js runtime. Haxe owns cached-function declarations, a module-cached page,
typed `cacheLife`/`cacheTag` calls, and tag invalidation. Generated adapters keep
Next's native directives and runtime behavior; there is no NextJsHx cache store.

The positive runtime reads the request query outside the ordinary cached scope
and passes one decoded string into `CacheFunction.ref(CachedCounter.read)`. The
negative control calls `next/headers` from that ordinary scope and must fail
with `NXHX-CACHE-REQUEST-0006` before an adapter plan is published.
A second boundary negative calls the cached implementation directly and must
fail with `NXHX-BOUNDARY-IMPORT-0002`, proving that consumers cannot bypass the
generated directive wrapper.

Two segment-config negatives reproduce Next 16.2.12's late Cache Components
build failures for explicit `dynamicParams` and `revalidate` exports. The Haxe
surface moves both to `NXHX-SEGMENT-CACHE-COMPONENTS-0002` source diagnostics,
before publication, strict TypeScript, or Turbopack.

Run the complete proof with:

```bash
npm run test:cache-boundaries
```
