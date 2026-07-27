package mdx_components;

import mdx_components.client.SignalPlot;

using nextjs.client.ClientComponent;

/**
 * Closed component registry used by trusted, repository-owned MDX.
 *
 * Every value is a typed generated Client Component reference. The macro
 * rejects misspelled registry names and non-component values before emitting
 * Next's root `mdx-components.tsx` convention module.
 */
@:next.mdxComponents
class AtlasMdxComponents {
	public static function components() {
		return {
			SignalPlot: SignalPlot.client()
		};
	}
}
