package client_components_negative;

import genes.react.Element;
import nextjs.client.flight.v19.FlightMap;
import client_components_negative.ClassProps.ClientSession;

typedef UnsupportedMapValueProps = {
	final sessions:FlightMap<String, ClientSession>;
}

/** Flight containers retain the complete path to unsupported members. */
@:next.clientComponent
class UnsupportedMapValue {
	public static function render(_props:UnsupportedMapValueProps):Element {
		return <div>never emitted</div>;
	}
}
