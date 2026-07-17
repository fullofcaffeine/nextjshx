package nextjshx.route;

/** A stable parser failure that a macro can attach to a Haxe source range. */
@:structInit
class RouteParseDiagnostic {
	public final code:String;
	public final message:String;
	public final segmentIndex:Null<Int>;

	public function new(code:String, message:String, ?segmentIndex:Int) {
		this.code = code;
		this.message = message;
		this.segmentIndex = segmentIndex;
	}
}
