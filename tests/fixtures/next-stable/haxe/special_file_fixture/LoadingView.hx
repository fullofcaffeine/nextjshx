package special_file_fixture;

import genes.react.Element;

/** Haxe-owned streamed fallback for the native loading proof page. */
@:next.loading("special/loading")
class LoadingView {
	public static function render():Element {
		return <main id={"haxe-loading"}>HAXE-LOADING-FALLBACK</main>;
	}
}
