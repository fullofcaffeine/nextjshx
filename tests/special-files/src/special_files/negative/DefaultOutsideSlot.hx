package special_files.negative;

import genes.react.Element;

@:next.default("negative/default-outside-slot")
class DefaultOutsideSlot {
	public static function render():Element {
		return <aside>invalid</aside>;
	}
}
