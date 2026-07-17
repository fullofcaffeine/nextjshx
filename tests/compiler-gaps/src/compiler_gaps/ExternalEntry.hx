package compiler_gaps;

/**
 * Models a value whose only real caller lives in authored JavaScript or TS.
 *
 * `@:keep` is the existing generic application policy for that invisible DCE
 * edge. Reusable package roots should use `@:genes.library` instead.
 */
@:keep
class ExternalEntry {
	public static function label():String {
		return "external-entry";
	}
}
