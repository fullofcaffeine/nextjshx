package client_components.client;

import nextjs.raw.react.ReactNode;

typedef FlightErrorBoundaryProps = {
	final fallbackLabel:String;
	final children:ReactNode;
}

/** Precise native React Error Boundary consumed by the Haxe server page. */
@:jsRequire("@nextjshx/client-fixture-hook", "FlightErrorBoundary")
@:genes.jsxComponentProps("client_components.client.FlightErrorBoundary.FlightErrorBoundaryProps")
extern class FlightErrorBoundary {}
