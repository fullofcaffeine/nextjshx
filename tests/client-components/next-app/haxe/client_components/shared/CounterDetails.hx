package client_components.shared;

import genes.ts.Undefinable;

/** Plain serializable model intentionally shared across the server/client graph. */
typedef CounterDetails = {
	final ratio:Float;
	final enabled:Bool;
	final hints:Array<String>;
	final note:Null<String>;
	final status:Undefinable<String>;
}
