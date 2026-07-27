package mdx_components.client;

import genes.react.Element;

typedef SignalPlotProps = {
	final label:String;
	final values:Array<Int>;
}

/** Typed interactive island available to repository-owned MDX documents. */
@:next.clientComponent
class SignalPlot {
	public static function render(props:SignalPlotProps):Element {
		final points = props.values.join(" · ");
		return <figure className="signal-plot" aria-label={props.label}>
			<figcaption>{props.label}</figcaption>
			<output>{points}</output>
		</figure>;
	}
}
