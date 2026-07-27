package mdx_components_negative;

import mdx_components_negative.client.SignalPlot;

using nextjs.client.ClientComponent;

#if mdx_negative_empty
@:next.mdxComponents
class InvalidRegistry {
	public static function components() {
		return {};
	}
}
#elseif mdx_negative_lowercase
@:next.mdxComponents
class InvalidRegistry {
	public static function components() {
		return {
			signalPlot: SignalPlot.client()
		};
	}
}
#elseif mdx_negative_value
@:next.mdxComponents
class InvalidRegistry {
	public static function components() {
		return {
			SignalPlot: "not a component"
		};
	}
}
#elseif mdx_negative_argument
@:next.mdxComponents
class InvalidRegistry {
	public static function components(locale:String) {
		return {
			SignalPlot: SignalPlot.client()
		};
	}
}
#end
