package client_components.client;

import client_components.shared.FlightResourcePayload;
import genes.react.Element;
import genes.react.React.useState;
import nextjs.client.React.use;
import nextjs.client.flight.v19.FlightArrayBuffer;
import nextjs.client.flight.v19.FlightDate;
import nextjs.client.flight.v19.FlightFloat32Array;
import nextjs.client.flight.v19.FlightFloat64Array;
import nextjs.client.flight.v19.FlightGlobalSymbol;
import nextjs.client.flight.v19.FlightInt16Array;
import nextjs.client.flight.v19.FlightInt32Array;
import nextjs.client.flight.v19.FlightInt8Array;
import nextjs.client.flight.v19.FlightMap;
import nextjs.client.flight.v19.FlightPromise;
import nextjs.client.flight.v19.FlightServerFunction;
import nextjs.client.flight.v19.FlightSet;
import nextjs.client.flight.v19.FlightUint16Array;
import nextjs.client.flight.v19.FlightUint32Array;
import nextjs.client.flight.v19.FlightUint8Array;
import nextjs.client.flight.v19.FlightUint8ClampedArray;

typedef FlightBoundaryProps = {
	final capturedAt:FlightDate;
	final readings:FlightMap<String, Int>;
	final labels:FlightSet<String>;
	final buffer:FlightArrayBuffer;
	final int8:FlightInt8Array;
	final int16:FlightInt16Array;
	final int32:FlightInt32Array;
	final uint8:FlightUint8Array;
	final uint8Clamped:FlightUint8ClampedArray;
	final uint16:FlightUint16Array;
	final uint32:FlightUint32Array;
	final float32:FlightFloat32Array;
	final float64:FlightFloat64Array;
	final symbol:FlightGlobalSymbol;
	final resource:FlightPromise<FlightResourcePayload>;
	final ping:FlightServerFunction<String->js.lib.Promise<String>>;
}

/**
 * Hydrated consumer for every precisely admitted React 19 Flight category.
 *
 * The versioned prop types are compile-time evidence: their runtime values
 * remain native Date, Map, Set, buffer, typed-array, symbol, Promise, and
 * Server Function values. This fixture deliberately renders or invokes each
 * value so the browser proves React/Next transport behavior in addition to the
 * earlier Haxe and generated-TypeScript checks.
 */
@:next.clientComponent
class FlightBoundary {
	public static function render(props:FlightBoundaryProps):Element {
		final resource = use(props.resource);
		final response = useState("not called");
		final reading = props.readings.get("harbor").orNull();
		final readingLabel = reading == null ? "missing" : '$reading';
		final invoke = () -> {
			props.ping("flight-boundary").then(value -> response.set(value));
		};
		final byteTotal = props.int8.byteLength + props.int16.byteLength + props.int32.byteLength + props.uint8.byteLength + props.uint8Clamped.byteLength
			+ props.uint16.byteLength + props.uint32.byteLength + props.float32.byteLength + props.float64.byteLength;
		return <section id="flight-boundary">
			<p id="flight-date">{props.capturedAt.toISOString()}</p>
			<p id="flight-map">{readingLabel}</p>
			<p id="flight-set">{props.labels.has("typed") ? "typed" : "missing"}</p>
			<p id="flight-buffer">{props.buffer.byteLength + byteTotal}</p>
			<p id="flight-symbol">{props.symbol.label()}</p>
			<p id="flight-promise">{resource.message + " / " + resource.sequence}</p>
			<p id="flight-action-result">{response.value}</p>
			<button id="flight-action" type="button" onClick={invoke}>Invoke Flight action</button>
		</section>;
	}
}
