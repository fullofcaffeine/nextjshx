package nextjs.client.flight.v19;

import genes.ts.Undefinable;

/**
 * Exact React 19 Flight view of a native JavaScript `Map`.
 *
 * Haxe 4.3.7's standard `js.lib.Map.get` declares a missing value as
 * `Null<V>`, but JavaScript and TypeScript use `undefined`. This extern keeps
 * the runtime as a genuine `Map` while preserving that distinction through
 * `Undefinable<V>` and exposing only the reviewed operations needed by the
 * semantic boundary.
 */
@:native("Map")
extern class FlightMap<K, V> {
	final size:Int;

	function new():Void;

	function has(key:K):Bool;

	function get(key:K):Undefinable<V>;

	function set(key:K, value:V):FlightMap<K, V>;

	function delete(key:K):Bool;

	function clear():Void;
}
