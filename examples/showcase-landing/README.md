# Pelagic Signal landing showcase

Pelagic Signal is the smallest maintained site: a static Haxe-authored App
Router page and layout with semantic Next navigation, shared shadcn UI, and a
hydrated tide instrument declared as a Haxe Client Component. Its semantic
Haxe Hook owns the React state transition while still emitting ordinary React
`useState`; Haxe also owns the props, event callbacks, markup, and generated
client boundary.

Run the complete three-site contract from the repository root with
`npm run test:showcases`, or run this workspace manually with
`npm run build --workspace @nextjshx/showcase-landing` followed by
`npm start --workspace @nextjshx/showcase-landing -- -p 3000`.

For development, one command rebuilds the internal CLI and initial stylesheet,
then watches Tailwind and Haxe while one native Next process owns Fast Refresh:

```sh
npm run dev --workspace @nextjshx/showcase-landing
```

Pass reviewed Next dev flags after the npm separator, for example
`npm run dev --workspace @nextjshx/showcase-landing -- --webpack -p 3100`.

See the [showcase guide](../../docs/showcases.md) for ownership and evidence.
