# Common Ground commerce showcase

Common Ground exercises typed products and money, semantic catalogue/product
hrefs, three generated-static product paths, generated metadata, optimized Next
images, a Haxe-owned Client Component, semantic typed React filtering/cart state,
and the shared shadcn Sheet as a responsive cart. The cart itself is a
Haxe-authored custom Hook using `State.value`, `State.set`, `State.update`, and
explicit `React.deps(...)`. Its computed quantity state becomes one typed
lint-visible scalar shared by the generated memo callback and dependency list;
a generated directive-first typed alias publishes the Hook as an ordinary
`useShopCart` TypeScript export without a wrapper call.
Quantity changes and totals are verified in real production Chrome at desktop
and mobile sizes.

Run the complete three-site contract from the repository root with
`npm run test:showcases`, or run this workspace manually with
`npm run build --workspace @nextjshx/showcase-commerce` followed by
`npm start --workspace @nextjshx/showcase-commerce -- -p 3000`.

For development, one command rebuilds the internal CLI and initial stylesheet,
then watches Tailwind and Haxe while one native Next process owns Fast Refresh:

```sh
npm run dev --workspace @nextjshx/showcase-commerce
```

Pass reviewed Next dev flags after the npm separator, for example
`npm run dev --workspace @nextjshx/showcase-commerce -- --webpack -p 3100`.

See the [showcase guide](../../docs/showcases.md) for the route and surface map.
