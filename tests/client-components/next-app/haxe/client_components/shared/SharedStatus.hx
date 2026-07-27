package client_components.shared;

import genes.react.Element;

/** Deliberately target-neutral component used in both server and client graphs. */
@:next.shared
class SharedStatus {
	public static function render(label:String):Element {
		return <span className={"shared-status"}>{label}</span>;
	}
}
