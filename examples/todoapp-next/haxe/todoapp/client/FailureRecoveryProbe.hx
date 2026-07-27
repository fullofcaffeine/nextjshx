package todoapp.client;

import genes.react.Element;
import showcase.ui.Button.ButtonProps;
import showcase.ui.Button.ButtonType;
import showcase.ui.Button.ButtonVariant;
import showcase.ui.Button.UiButton;

typedef FailureRecoveryProbeProps = {
	final recordTitle:String;
}

/** Haxe-owned client drill that lets E2E prove Next's typed error reset contract. */
@:next.clientComponent
class FailureRecoveryProbe {
	public static function render(props:FailureRecoveryProbeProps):Element {
		final recovery = FailureRecoveryHook.useFailureRecovery();
		final trigger:ButtonProps = {
			variant: ButtonVariant.Outline,
			type: ButtonType.Button,
			className: "failure-proof-trigger",
			onClick: _ -> recovery.trigger()
		};
		return <aside className="failure-proof" aria-labelledby="failure-proof-title">
			<p className="eyebrow">Recovery drill / opt-in</p>
			<h3 id="failure-proof-title">Test this route's safety net.</h3>
			<p>Trigger one deliberate render fault for “{props.recordTitle}”. The Haxe error view will keep the route recoverable through Next's native reset callback.</p>
			<UiButton {...trigger}>Trigger recoverable fault</UiButton>
		</aside>;
	}
}
