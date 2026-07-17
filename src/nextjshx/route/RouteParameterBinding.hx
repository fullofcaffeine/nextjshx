package nextjshx.route;

/** One validated Haxe params field and any codec required by its adapter. */
@:structInit
class RouteParameterBinding {
	public final name:String;
	public final kind:RouteParameterKind;
	public final haxeType:String;
	public final codecType:Null<String>;

	public function new(name:String, kind:RouteParameterKind, haxeType:String, ?codecType:String) {
		this.name = name;
		this.kind = kind;
		this.haxeType = haxeType;
		this.codecType = codecType;
	}
}
