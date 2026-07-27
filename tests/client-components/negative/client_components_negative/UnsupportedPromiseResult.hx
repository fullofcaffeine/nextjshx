package client_components_negative;

import genes.react.Element;
import nextjs.client.flight.v19.FlightPromise;

typedef UnsafeResolvedValue = {
	final callback:String->Void;
}

typedef UnsupportedPromiseResultProps = {
	final resource:FlightPromise<UnsafeResolvedValue>;
}

/** A reviewed Promise cannot hide an unsupported resolved value. */
@:next.clientComponent
class UnsupportedPromiseResult {
	public static function render(_props:UnsupportedPromiseResultProps):Element {
		return <div>never emitted</div>;
	}
}
