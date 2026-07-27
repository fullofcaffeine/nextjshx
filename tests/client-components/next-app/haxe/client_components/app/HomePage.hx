package client_components.app;

import client_components.actions.FlightActions;
import client_components.client.FlightBoundary;
import client_components.client.FlightErrorBoundary;
import client_components.client.InteractiveCounter;
import client_components.client.InteractiveCounter.CounterTone;
import client_components.client.QueryPanel;
import client_components.client.RejectedFlightBoundary;
import client_components.server.ServerSummary;
import client_components.server.FlightResources;
import client_components.shared.CounterDetails;
import client_components.shared.SharedStatus;
import genes.js.Async.await;
import genes.react.Element;
import js.lib.Promise;
import nextjs.app.PageProps;
import nextjs.raw.Server;
import nextjs.route.NoParams;
import nextjs.route.SearchParams;
import nextjs.raw.integrations.nuqs.NuqsAdapter;
import nextjs.raw.integrations.nuqs.QueryOptions.QueryHistory;
import nextjs.raw.react.Suspense;
import nextjs.client.flight.v19.FlightArrayBuffer;
import nextjs.client.flight.v19.FlightDate;
import nextjs.client.flight.v19.FlightFloat32Array;
import nextjs.client.flight.v19.FlightFloat64Array;
import nextjs.client.flight.v19.FlightGlobalSymbol;
import nextjs.client.flight.v19.FlightInt16Array;
import nextjs.client.flight.v19.FlightInt32Array;
import nextjs.client.flight.v19.FlightInt8Array;
import nextjs.client.flight.v19.FlightMap;
import nextjs.client.flight.v19.FlightSet;
import nextjs.client.flight.v19.FlightUint16Array;
import nextjs.client.flight.v19.FlightUint32Array;
import nextjs.client.flight.v19.FlightUint8Array;
import nextjs.client.flight.v19.FlightUint8ClampedArray;
import nextjs.server.ServerFunction;

using nextjs.client.ClientComponent;

/** Server page importing only the generated client boundary through its ref. */
@:next.page("")
class HomePage {
	@:async
	public static function render(props:PageProps<NoParams, SearchParams>):Promise<Element> {
		await(Server.connection());
		final Counter = InteractiveCounter.client();
		final Flight = FlightBoundary.client();
		final RejectedFlight = RejectedFlightBoundary.client();
		final Query = QueryPanel.client();
		final details:CounterDetails = {
			ratio: 1.25,
			enabled: true,
			hints: ["typed", "hydrated"],
			note: null,
			status: "fresh"
		};
		final queryFallback = <p id="query-loading">Loading URL filters...</p>;
		final flightFallback = <p id="flight-loading">Streaming Flight values...</p>;
		final rejectedFlightFallback = <p id="flight-rejection-loading">Waiting for rejected Flight value...</p>;
		final readings = new FlightMap<String, Int>();
		readings.set("harbor", 42);
		final labels:FlightSet<String> = new js.lib.Set();
		labels.add("typed");
		final int8:FlightInt8Array = new js.lib.Int8Array(1);
		final int16:FlightInt16Array = new js.lib.Int16Array(1);
		final int32:FlightInt32Array = new js.lib.Int32Array(1);
		final uint8:FlightUint8Array = new js.lib.Uint8Array(1);
		final uint8Clamped:FlightUint8ClampedArray = new js.lib.Uint8ClampedArray(1);
		final uint16:FlightUint16Array = new js.lib.Uint16Array(1);
		final uint32:FlightUint32Array = new js.lib.Uint32Array(1);
		final float32:FlightFloat32Array = new js.lib.Float32Array(1);
		final float64:FlightFloat64Array = new js.lib.Float64Array(1);
		final ping = ServerFunction.boundary(FlightActions.ping);
		return <main>
			{ServerSummary.render("Ordinary Haxe Server Component")}
			{SharedStatus.render("Shared from the server graph")}
			<Counter label="Live harbor reading" initialCount={2} tone={CounterTone.Tide} details={details}>
				<span>Server-rendered child composition</span>
			</Counter>
			<Suspense fallback={flightFallback}>
				<Flight
					capturedAt={new js.lib.Date("2026-07-26T12:00:00.000Z")}
					readings={readings}
					labels={labels}
					buffer={new js.lib.ArrayBuffer(8)}
					int8={int8}
					int16={int16}
					int32={int32}
					uint8={uint8}
					uint8Clamped={uint8Clamped}
					uint16={uint16}
					uint32={uint32}
					float32={float32}
					float64={float64}
					symbol={FlightGlobalSymbol.forKey("nextjshx.flight")}
					resource={FlightResources.payload}
					ping={ping}
				/>
			</Suspense>
			<FlightErrorBoundary fallbackLabel="Rejected Flight value reached the Error Boundary">
				<Suspense fallback={rejectedFlightFallback}>
					<RejectedFlight resource={FlightResources.rejected} />
				</Suspense>
			</FlightErrorBoundary>
			<Suspense fallback={queryFallback}>
				<NuqsAdapter defaultOptions={{history: QueryHistory.Push}}>
					<Query />
				</NuqsAdapter>
			</Suspense>
		</main>;
	}
}
