package client_components_negative;

import genes.react.Element;
import nextjs.client.flight.v19.FlightSet;

typedef UnsupportedSetValueProps = {
	final listeners:FlightSet<String->Void>;
}

/** Function elements remain unsupported inside an otherwise valid Flight set. */
@:next.clientComponent
class UnsupportedSetValue {
	public static function render(_props:UnsupportedSetValueProps):Element {
		return <div>never emitted</div>;
	}
}
