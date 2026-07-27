package field_atlas.content;

import field_atlas.client.SignalPlot;

using nextjs.client.ClientComponent;

/**
 * `@:next.mdxComponents` publishes the root `mdx-components.tsx` registry that
 * Next's MDX loader requires. The returned closed map is checked in Haxe and
 * emitted as a zero-wrapper typed alias; it does not make untrusted MDX safe.
 */
@:next.mdxComponents
class AtlasMdxComponents {
	public static function components() {
		return {
			SignalPlot: SignalPlot.client()
		};
	}
}
