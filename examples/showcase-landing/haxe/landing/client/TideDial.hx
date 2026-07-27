package landing.client;

import genes.react.Element;
import showcase.ui.Button.ButtonProps;
import showcase.ui.Button.ButtonSize;
import showcase.ui.Button.ButtonType;
import showcase.ui.Button.ButtonVariant;
import showcase.ui.Button.UiButton;
import showcase.ui.Icons.ArrowDownRight;
import showcase.ui.Icons.ArrowUpRight;
import showcase.ui.Icons.IconProps;

typedef TideDialProps = {
	final station:String;
	final initialLevel:Int;
	final updated:String;
}

/** Hydrated ocean reading with all state and event behavior authored in Haxe. */
@:next.clientComponent
class TideDial {
	public static function render(props:TideDialProps):Element {
		final reading = TideHook.useTideReading(props.initialLevel);
		final circumference = 289.0;
		final offset = circumference - circumference * reading.level / 100;
		final decrease:ButtonProps = {
			variant: ButtonVariant.Ghost,
			size: ButtonSize.Icon,
			type: ButtonType.Button,
			className: "dial-control",
			ariaLabel: "Lower simulated tide reading",
			onClick: _ -> reading.lower()
		};
		final increase:ButtonProps = {
			variant: ButtonVariant.Ghost,
			size: ButtonSize.Icon,
			type: ButtonType.Button,
			className: "dial-control",
			ariaLabel: "Raise simulated tide reading",
			onClick: _ -> reading.raise()
		};
		final icon:IconProps = {size: 18, strokeWidth: 1.7};
		return <section id="live-tide-dial" className="tide-console" aria-label="Interactive tide station reading">
			<div className="console-topline">
				<span>Station {props.station}</span>
				<span className="signal-dot">live</span>
			</div>
			<div className="dial-stage">
				<svg className="dial-svg" viewBox="0 0 120 120" role="img" aria-label={"Tide level " + reading.level + " percent"}>
					<circle className="dial-track" cx={60} cy={60} r={46} />
					<circle className="dial-reading" cx={60} cy={60} r={46} strokeDasharray={circumference} strokeDashoffset={offset} />
					<path className="dial-tick" d="M60 4v8 M60 108v8 M4 60h8 M108 60h8" />
				</svg>
				<div className="dial-value" aria-live="polite">
					<strong id="tide-level">{reading.level}</strong><span>%</span>
					<small>{reading.direction}</small>
				</div>
			</div>
			<div className="console-controls">
				<UiButton {...decrease}><ArrowDownRight {...icon} /></UiButton>
				<div><span>last packet</span><strong>{props.updated}</strong></div>
				<UiButton {...increase}><ArrowUpRight {...icon} /></UiButton>
			</div>
		</section>;
	}
}
