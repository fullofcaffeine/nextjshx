package nextjshx.route;

/** One validated filesystem segment and its optional dynamic parameter. */
@:structInit
class RouteSegment {
	public final source:String;
	public final kind:RouteSegmentKind;
	public final segmentIndex:Int;
	public final parameter:Null<RouteParameter>;

	public function new(source:String, kind:RouteSegmentKind, segmentIndex:Int, ?parameter:RouteParameter) {
		this.source = source;
		this.kind = kind;
		this.segmentIndex = segmentIndex;
		this.parameter = parameter;
	}
}
