package mixed_adoption.client;

import genes.react.Element;
import mixed_adoption.native.NativeSignal.NativeSignalBand;
import mixed_adoption.native.NativeSignal.NativeSignalCard;
import mixed_adoption.native.NativeSignal.NativeSignalChannel;
import mixed_adoption.native.NativeSignal.NativeSignalFormat;
import mixed_adoption.native.NativeSignal.NativeSignalHook;
import mixed_adoption.native.NativeSignal.NativeSignalUnit;
import showcase.ui.Button.ButtonSize;
import showcase.ui.Button.ButtonType;
import showcase.ui.Button.ButtonVariant;
import showcase.ui.Button.UiButton;

enum abstract PatchAccent(String) to String {
	final Vermilion = "vermilion";
	final Signal = "signal";
}

typedef HaxePatchConsoleProps = {
	final label:String;
	final initialLevel:Int;
	final accent:PatchAccent;
}

@:next.clientComponent
class HaxePatchConsole {
	public static function render(props:HaxePatchConsoleProps):Element {
		final reading = NativeSignalHook.use(props.initialLevel);
		final formatted = NativeSignalFormat.formatSignal(reading.value, NativeSignalUnit.Db);
		final band:NativeSignalBand = NativeSignalFormat.signalBand(reading.value);
		return <section className="haxe-console" data-accent={props.accent}>
			<div className="console-owner"><span>HX</span><p>{props.label}</p></div>
			<div className="console-reading" aria-live="polite">
				<span>{reading.mode}</span>
				<strong>{formatted}</strong>
				<small>{band} / closed native module result</small>
			</div>
			<div className="console-actions">
				<UiButton type={ButtonType.Button} size={ButtonSize.Small} variant={ButtonVariant.Outline} onClick={_ -> reading.lower()}>− 04</UiButton>
				<UiButton type={ButtonType.Button} size={ButtonSize.Small} onClick={_ -> reading.raise()}>+ 04</UiButton>
				<UiButton type={ButtonType.Button} size={ButtonSize.Small} variant={ButtonVariant.Ghost} onClick={_ -> reading.toggleMode()}>switch mode</UiButton>
			</div>
			<NativeSignalCard channel={NativeSignalChannel.Alpha} label="Native component inside Haxe HXX" reading={formatted} band={band} onCalibrate={reading.raise}>
				<p className="interop-caption">Typed Haxe children cross into source-owned TSX.</p>
			</NativeSignalCard>
		</section>;
	}
}
