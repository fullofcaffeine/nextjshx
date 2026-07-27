package special_files.positive;

import genes.react.Element;
import nextjs.app.ErrorProps;

@:next.error("proof/error")
class ErrorView {
	public static function render(props:ErrorProps):Element {
		return <section id={"haxe-error"}>
      <p id={"haxe-error-message"}>{props.error.message}</p>
      <button id={"haxe-error-reset"} onClick={props.reset}>Reset boundary</button>
    </section>;
	}
}
