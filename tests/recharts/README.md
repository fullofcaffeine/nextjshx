# Recharts integration fixture

This fixture proves the reviewed Recharts subset before the Todo showcase uses
it. Haxe checks the exact chart row, series key, axis key, and prop types; the
generated TSX then passes strict TypeScript against the installed Recharts
declarations.

Run it with:

```bash
npm run test:recharts
```

The positive output must remain ordinary named Recharts imports and direct JSX.
The negative controls must fail in Haxe before rejected TSX is written.
