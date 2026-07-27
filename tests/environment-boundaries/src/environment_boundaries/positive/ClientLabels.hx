package environment_boundaries.positive;

/** Client-only value imported by a native Client Component. */
@:next.clientOnly
class ClientLabels {
	public static function label():String {
		return "client-only-helper";
	}
}
