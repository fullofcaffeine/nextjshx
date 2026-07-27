# Moraine blog showcase

Moraine exercises a typed editorial domain, semantic route hrefs, a dynamic
article segment, three generated-static paths, generated metadata, Next-owned
not-found control flow, and a segment-specific Haxe 404. The UI uses the shared
Badge, Button, Card, Separator, and Lucide facades without a CMS or unchecked
payload boundary.

Run the complete three-site contract from the repository root with
`npm run test:showcases`, or run this workspace manually with
`npm run build --workspace @nextjshx/showcase-blog` followed by
`npm start --workspace @nextjshx/showcase-blog -- -p 3000`.

For development, one command rebuilds the internal CLI and initial stylesheet,
then watches Tailwind and Haxe while one native Next process owns Fast Refresh:

```sh
npm run dev --workspace @nextjshx/showcase-blog
```

Pass reviewed Next dev flags after the npm separator, for example
`npm run dev --workspace @nextjshx/showcase-blog -- --webpack -p 3100`.

See the [showcase guide](../../docs/showcases.md) for the route and surface map.
