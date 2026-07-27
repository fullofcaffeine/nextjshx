package client_components_negative;

import genes.react.Element;

typedef OrdinaryUseNameProps = {
	final enabled:Bool;
}

/** Haxe identity is typed, but generated React tooling reserves `use...`. */
@:next.clientComponent
class OrdinaryUseName {
	public static function useFriendlyLabel(label:String):String {
		return label.toUpperCase();
	}

	public static function render(props:OrdinaryUseNameProps):Element {
		final label = props.enabled ? useFriendlyLabel("ready") : "paused";
		return <p>{label}</p>;
	}
}
