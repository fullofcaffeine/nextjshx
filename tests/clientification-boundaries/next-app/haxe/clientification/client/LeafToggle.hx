package clientification.client;

import genes.react.Element;
import genes.react.React.useState;

typedef LeafToggleProps = {
	final label:String;
}

/** The preferred boundary: only this small interactive control hydrates. */
@:next.clientComponent
class LeafToggle {
	public static function render(props:LeafToggleProps):Element {
		final count = useState(0);
		return <button type="button" onClick={() -> count.update(value -> value + 1)}>
			{props.label + ": " + count.value}
		</button>;
	}
}
