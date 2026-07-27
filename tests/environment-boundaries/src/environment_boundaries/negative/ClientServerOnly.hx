package environment_boundaries.negative;

import environment_boundaries.positive.ServerSecrets;

/** Must fail for a visible client-only to server-only dependency. */
@:next.clientOnly
class ClientServerOnly {
	public static function configured():Bool {
		return ServerSecrets.configured();
	}
}
