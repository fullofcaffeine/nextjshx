package todoapp.app;

import genes.react.Element;
import nextjs.app.ErrorProps;
import showcase.ui.Button.ButtonProps;
import showcase.ui.Button.ButtonType;
import showcase.ui.Button.ButtonVariant;
import showcase.ui.Button.UiButton;

/** Typed, Haxe-owned client error boundary with Next's exact reset callback. */
@:next.error("todos")
class TodoError {
	public static function render(props:ErrorProps):Element {
		final reset:ButtonProps = {
			variant: ButtonVariant.Outline,
			type: ButtonType.Button,
			className: "error-reset",
			onClick: _ -> props.reset()
		};
		return <main id="todo-error" className="state-page error-state">
			<p className="state-code">Route fault / contained</p>
			<h2>The ledger held its place.</h2>
			<p id="todo-error-message" role="alert">The record view stopped safely: {props.error.message}</p>
			<UiButton {...reset}>Retry this field note</UiButton>
		</main>;
	}
}
