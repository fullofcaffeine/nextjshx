# Route Handler declaration fixture

This fixture proves the Haxe-native `@:next.route` surface before any file is
published into an application tree. The positive compilation registers GET,
POST, and DELETE named exports with Promise-shaped, path-validated params and
precise response signatures. Focused negative compilations lock diagnostics
for duplicate exports, unsupported HTTP methods, a structural context that
bypasses `RouteContext`, mismatched dynamic params, and a non-Response return.

Run it from the repository root:

```sh
npm run test:route-handlers
```
