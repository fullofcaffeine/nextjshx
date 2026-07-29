package clientification.client;

import clientification.shared.FeatureCatalogue;
import genes.react.Element;
import genes.react.React.useState;

typedef HighDashboardProps = {
	final label:String;
}

/**
 * Deliberate negative control: placing the boundary here sends the substantial
 * shared catalogue to the browser even though only the button is interactive.
 */
@:next.clientComponent
class HighDashboard {
	public static function render(props:HighDashboardProps):Element {
		final count = useState(0);
		return <main>
			{FeatureCatalogue.render()}
			<button type="button" onClick={() -> count.update(value -> value + 1)}>
				{props.label + ": " + count.value}
			</button>
		</main>;
	}
}
