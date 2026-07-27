package environment_boundaries.negative;

import environment_boundaries.positive.ClientLabels;

/** Must fail for a visible server-only to client-only dependency. */
@:next.serverOnly
class ServerClientOnly {
	public static function label():String {
		return ClientLabels.label();
	}
}
