package nextjs.env;

import genes.ts.Undefinable;
import haxe.DynamicAccess;
import js.lib.Error;

/**
 * Named access to server process environment without exposing the whole map.
 *
 * The module carries Next's native `server-only` poisoning import. Client code
 * receives an early Haxe diagnostic when the edge is visible, while `next
 * build` remains the final transitive-graph check.
 */
@:next.serverOnly
class ServerEnvironment {
	/** Reads one named server value while preserving JavaScript `undefined`. */
	public static function get(name:String):Undefinable<String> {
		return Undefinable.fromNullable(NodeProcess.env.get(name));
	}

	/** Requires one named value without copying other environment entries. */
	public static function require(name:String):String {
		final value:Null<String> = NodeProcess.env.get(name);
		if (value == null) {
			throw new Error('Required server environment value "$name" is missing.');
		}
		return value;
	}
}

/** Exact Node process seam kept private to the server-only semantic module. */
@:jsRequire("node:process")
private extern class NodeProcess {
	static final env:DynamicAccess<String>;
}
