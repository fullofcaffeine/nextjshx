package client_components.client;

import client_components.shared.SharedStatus;
import client_components.shared.CounterDetails;
import genes.react.Element;
import nextjs.raw.Navigation;
import nextjs.raw.react.ReactNode;
import client_components.client.CounterHooks.useCounterState as useFixtureCounter;

enum abstract CounterTone(String) to String {
	final Tide = "tide";
	final Signal = "signal";
}

typedef InteractiveCounterProps = {
	final label:String;
	final initialCount:Int;
	final tone:CounterTone;
	final details:CounterDetails;
	final children:ReactNode;
}

/** Haxe-owned hydrated component reached only through its generated adapter. */
@:next.clientComponent
class InteractiveCounter {
	public static function render(props:InteractiveCounterProps):Element {
		final state = useFixtureCounter(props.initialCount);
		final pathname = Navigation.usePathname();
		final status = props.details.enabled ? CounterHooks.friendlyLabel("ready") : "paused";
		final optionalStatus = props.details.status.orNull();
		final statusLabel = optionalStatus == null ? "unset" : optionalStatus;
		final panelStyle = {
			padding: "2rem",
			maxWidth: "34rem",
			margin: "5rem auto",
			background: "white",
			borderRadius: "2rem"
		};
		return <section id="client-counter-panel" data-tone={props.tone} data-status={status} data-pathname={pathname} style={panelStyle}>
			<p>{props.label}</p>
			<strong id="client-counter-value">{state.count}</strong>
			<button id="client-counter-button" type="button" onClick={state.increment}>Raise the tide</button>
			<small>{props.details.hints.join(" · ") + " / " + props.details.ratio + " / " + statusLabel}</small>
			{SharedStatus.render("Shared from the client graph")}
			<div id="client-counter-child">{props.children}</div>
		</section>;
	}
}
