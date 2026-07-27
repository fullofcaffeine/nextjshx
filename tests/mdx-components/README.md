# Typed MDX component registry fixture

This fixture proves that trusted, repository-owned MDX can use Haxe-authored
components without turning the component registry into an open string map.

The positive declaration is intentionally small:

```haxe
@:next.mdxComponents
class AtlasMdxComponents {
	public static function components() {
		return {
			SignalPlot: SignalPlot.client()
		};
	}
}
```

Haxe infers the exact `SignalPlot` field and its props. NextJsHx then publishes
the ordinary root `mdx-components.tsx` convention file as a `typeof` const
alias. Keeping the closed Haxe type is more precise than widening the registry
to the ambient `MDXComponents` string map. The registry has no runtime wrapper,
assertion, compatibility type shim, or alternate MDX runtime.

Negative controls prove that an empty registry, a lowercase JSX name, a
non-component value, or a registry function with arguments fails before
TypeScript output is accepted. The CLI controls separately reject malformed
plans and refuse to overwrite an application-owned native registry.

This bridge is only for trusted local MDX, which is executable source code.
Untrusted CMS or network content must use the separate portable content-block
decoder; it must never be evaluated as MDX or JSX.
