package compiler_gaps;

/**
 * Reduces a module-directive requirement to framework-neutral Haxe.
 *
 * genes-ts interprets the generic literal metadata without knowing any
 * framework directive vocabulary. The fixture retains the import edge so both
 * output profiles prove that the directive remains ahead of every import.
 */
@:keep
@:genes.moduleDirective("generic-mode")
class DirectiveBoundary {
	public static function label():String {
		return Dependency.label();
	}
}
