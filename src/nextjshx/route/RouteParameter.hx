package nextjshx.route;

/** One ordered dynamic parameter derived from an App Router path. */
@:structInit
class RouteParameter {
	public final name:String;
	public final kind:RouteParameterKind;
	public final segmentIndex:Int;

	public function new(name:String, kind:RouteParameterKind, segmentIndex:Int) {
		this.name = name;
		this.kind = kind;
		this.segmentIndex = segmentIndex;
	}
}
