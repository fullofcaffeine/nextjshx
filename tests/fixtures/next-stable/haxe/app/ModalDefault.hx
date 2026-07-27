package app;

import genes.react.Element;

/** Explicit Next 16 hard-navigation fallback for the root `@modal` slot. */
@:next.default("@modal")
class ModalDefault {
	public static function render():Element {
		return <span id="modal-default">No active modal</span>;
	}
}
