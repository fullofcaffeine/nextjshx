package mdx_components_negative.client;

import genes.react.Element;

typedef SignalPlotProps = {
	final label:String;
}

@:next.clientComponent
class SignalPlot {
	public static function render(props:SignalPlotProps):Element {
		return <output>{props.label}</output>;
	}
}
