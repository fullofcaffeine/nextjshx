# Common Ground: typed commerce storefront

Common Ground is a responsive product catalogue with static product pages,
optimized images, filtering, and a client-side cart. It is the compact example
for Haxe-authored React state and custom Hooks.

## Why write this in Haxe?

Products, slugs, money, filters, cart actions, routes, and component props are
closed types. The semantic Hook API separates replacement (`set`) from
functional updates (`update`) and keeps dependencies explicit. Haxe publishes
the custom Hook back to TypeScript as ordinary `useShopCart` without a wrapper
call.

## Architecture

| Haxe source | Vanilla Next.js equivalent | Runs in |
| --- | --- | --- |
| `commerce/app/StorePage.hx` | `app/page.tsx` | server |
| `commerce/app/ProductPage.hx` | `app/products/[slug]/page.tsx` | server |
| `commerce/client/ShopClient.hx` | `"use client"` storefront | browser |
| `commerce/client/CartHook.hx` | typed custom React Hook | browser |
| `commerce/domain/` | product, slug, and money types | shared |

Next still owns App Router rendering, image optimization, hydration, CSS, and
production deployment. The shadcn Sheet is normal source TSX consumed through
a checked Haxe surface.

## The same Hook in vanilla React/Next.js

An idiomatic TypeScript Hook also uses module functions and functional updates:

```tsx
export function useShopCart(products: readonly Product[]): CartModel {
  const [filter, setFilter] = useState<CatalogFilter>("all")
  const [quantities, setQuantities] = useState<readonly CartQuantity[]>([])
  const lines = useMemo(
    () => buildLines(products, quantities),
    [products, quantities],
  )
  const add = (slug: ProductSlug) =>
    setQuantities(current => adjustQuantity(current, slug, 1))
  return { filter, lines, add, showAll: () => setFilter("all") }
}
```

That remains the generated runtime shape. Haxe adds a named `ProductSlug`,
closed filter/category values, separate `.set` and `.update` operations, and
source-positioned Hook/dependency diagnostics while preserving React's native
Hook identity and lint-visible dependency array.

The corresponding Haxe uses the same React operations, but names the update
mode and dependency list:

```haxe
final filter = React.useState(CatalogFilter.All);
final quantities = React.useState(new Array<CartQuantity>());
final lines = React.useMemo(
	(products, current) -> buildLines(products, current),
	React.deps(products, quantities.value)
);

final add = slug -> quantities.update(
	current -> adjustQuantity(current, slug, 1)
);
final showAll = () -> filter.set(CatalogFilter.All);
```

`React.deps(...)` is erased into the ordinary dependency array; it exists so
Haxe can contextually type the callback and so the generated function remains
visible to React's official lint.

## Run it

```sh
npm run dev --workspace @nextjshx/showcase-commerce
npm run build --workspace @nextjshx/showcase-commerce
```

## Gotchas

- `React.deps(...)` must stay directly inside semantic `useMemo`; this preserves
  an inline dependency array visible to React lint.
- Use `useStateLazy` for function-valued state so React does not mistake the
  stored function for an initializer.
- `ProductCatalog` is a module. `CartHook` retains a temporary documented
  static shell only for the current analyzer/export bridge; direct module Hook
  authoring is a framework-neutral genes-ts capability in progress.
- Cart state is intentionally client-local; this example does not pretend to
  provide checkout, inventory, authentication, or server persistence.

See the first-use source comments and the
[showcase guide](../../docs/showcases.md) for the generated Hook boundary.
