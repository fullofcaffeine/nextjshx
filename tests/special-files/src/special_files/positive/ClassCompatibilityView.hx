package special_files.positive;

import genes.react.Element;

/**
 * Protects the older class-shaped authoring form for applications that still
 * use it. New code normally places the annotation on a module-level `render`.
 */
@:next.loading("proof/class-compat")
class ClassCompatibilityView {
	public static function render():Element {
		return <p id="haxe-class-compatibility">CLASS-COMPATIBILITY</p>;
	}
}
