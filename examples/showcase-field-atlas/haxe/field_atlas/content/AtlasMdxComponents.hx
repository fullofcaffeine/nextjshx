package field_atlas.content;

import field_atlas.client.SignalPlot;

using nextjs.client.ClientComponent;

/** Exact component vocabulary available to trusted local MDX dispatches. */
@:next.mdxComponents
class AtlasMdxComponents {
	public static function components() {
		return {
			SignalPlot: SignalPlot.client()
		};
	}
}
