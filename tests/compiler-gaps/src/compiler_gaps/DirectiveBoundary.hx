package compiler_gaps;

/**
 * Reduces a module-directive requirement to framework-neutral Haxe.
 *
 * The metadata is intentionally inert in genes-ts 1.32.0. G02 owns the final
 * generic API, validation, ordering, deduplication, and dual-output behavior.
 */
@:keep
@:genes.moduleDirective("generic-mode")
class DirectiveBoundary {
	public static function label():String {
		return Dependency.label();
	}
}
