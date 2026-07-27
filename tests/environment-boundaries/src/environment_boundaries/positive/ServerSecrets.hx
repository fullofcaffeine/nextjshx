package environment_boundaries.positive;

import genes.ts.Undefinable;
import nextjs.env.ServerEnvironment;

/** Server-only named environment access used by the real Next build. */
@:next.serverOnly
class ServerSecrets {
	public static inline final KEY:String = "NXHX_TEST_SERVER_SECRET";
	static var initialized:Bool = false;

	static function __init__():Void {
		initialized = true;
	}

	public static function configured():Bool {
		if (!initialized) {
			return false;
		}
		final value = ServerEnvironment.get(KEY);
		final absent:Bool = Undefinable.isAbsent(value);
		return !absent;
	}
}
