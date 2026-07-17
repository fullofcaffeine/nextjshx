# Route-pattern fixture

This focused macro fixture proves the closed P0 route grammar and exact Haxe
params contract without generating or executing application JavaScript.

Run it from the repository root:

```sh
npm run test:routes
```

The Node runner:

1. requires Haxe 4.3.7 and discovers the installed `genes-ts` source classpath;
2. compiles the same seven positive declarations in forward and reverse order
   with `--no-output`;
3. compares the canonical result with
   `tests/snapshots/route-patterns-v1.json`;
4. proves no host path or `application.js` escaped the compile-time boundary;
5. compiles 18 isolated negative cases and compares each diagnostic file,
   line, range, code, and message exactly.

`build-forward.hxml`, `build-reverse.hxml`, and `build-negative.hxml` depend on
the classpath supplied by the runner so they use the real
`genes.ts.Undefinable` definition without enabling genes-ts generation. Do not
treat a direct HXML invocation as the supported test command.

The `.tmp/` directory is ignored and disposable. Change the reviewed snapshot
only when the route grammar or binding contract changes intentionally, and
inspect both registration orders plus the exact negative matrix before
accepting that change.
