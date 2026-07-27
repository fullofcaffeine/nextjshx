package special_file_fixture;

import genes.react.Element;
import nextjs.app.ErrorProps;

/** Typed Haxe error boundary; the macro owns its required client directive. */
@:next.error("special/error")
class ErrorView {
	public static function render(props:ErrorProps):Element {
		return <main id={"haxe-error-boundary"}>
      <p id={"haxe-error-message"}>{props.error.message}</p>
      <button id={"haxe-error-reset"} onClick={props.reset}>Reset from Haxe</button>
    </main>;
	}
}
