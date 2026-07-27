package mixed_adoption.native;

import nextjs.raw.react.ReactNode;

enum abstract NativeSignalMode(String) to String {
	final Receive = "receive";
	final Transmit = "transmit";
}

enum abstract NativeSignalChannel(String) to String {
	final Alpha = "alpha";
	final Beta = "beta";
}

enum abstract NativeSignalBand(String) to String {
	final Quiet = "quiet";
	final Nominal = "nominal";
	final Hot = "hot";
}

enum abstract NativeSignalUnit(String) to String {
	final Db = "db";
	final Hz = "hz";
}

typedef NativeSignalReading = {
	final value:Int;
	final mode:NativeSignalMode;
	final raise:Void->Void;
	final lower:Void->Void;
	final toggleMode:Void->Void;
}

typedef NativeSignalCardProps = {
	final channel:NativeSignalChannel;
	final label:String;
	final reading:String;
	final band:NativeSignalBand;
	final onCalibrate:Void->Void;
	@:ts.optional
	final ?children:ReactNode;
}

extern class NativeSignalHook {
	/**
	 * On an extern, `@:next.hook` records that the reviewed native export is a
	 * React Hook, so Haxe call sites receive the same placement diagnostics.
	 * `@:jsRequire` is a zero-runtime declaration of the existing ESM export.
	 */
	@:next.hook
	@:jsRequire("@nextjshx/mixed-adoption/native-hook", "useNativeSignal")
	static function use(initialValue:Int):NativeSignalReading;
}

@:jsRequire("@nextjshx/mixed-adoption/native-module")
extern class NativeSignalFormat {
	static function formatSignal(value:Int, unit:NativeSignalUnit):String;
	static function signalBand(value:Int):NativeSignalBand;
}

@:jsRequire("@nextjshx/mixed-adoption/native-component", "NativeSignalCard")
@:genes.jsxComponentProps("mixed_adoption.native.NativeSignal.NativeSignalCardProps")
extern class NativeSignalCard {}
