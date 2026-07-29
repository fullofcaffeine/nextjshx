package client_components.client;

import client_components.shared.FlightResourcePayload;
import genes.react.Element;
import nextjs.client.React.use;
import nextjs.client.flight.v19.FlightPromise;

typedef RejectedFlightBoundaryProps = {
	final resource:FlightPromise<FlightResourcePayload>;
}

/** Rejected resource control rendered below Suspense and an Error Boundary. */
@:next.clientComponent
class RejectedFlightBoundary {
	public static function render(props:RejectedFlightBoundaryProps):Element {
		final resource = use(props.resource);
		return <p id="unexpected-flight-resolution">{resource.message}</p>;
	}
}
