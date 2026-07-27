# Special-file declaration fixture

This focused fixture validates Haxe-owned `loading.tsx`, `error.tsx`, and
`not-found.tsx` declarations before publication. The positive plan locks exact
targets, implementation imports, default signatures, and the automatic error
client directive. Strict generated TypeScript proves `ErrorProps` remains
`Error & { digest?: string }` plus a zero-argument reset callback.

The negative matrix rejects missing or argument-bearing server components,
structural error props with an incompatible reset callback, asynchronous client
errors, a direct one-argument reset call, and non-element results. Every failure
produces one exact source diagnostic and no rejected plan.

Run it with:

```sh
npm run test:special-files
```
