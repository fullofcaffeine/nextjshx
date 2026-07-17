package compiler_gaps;

/** Negative control proving ordinary application DCE remains compact. */
class UnretainedEntry {
	public static function label():String {
		return "must-not-be-emitted";
	}
}
