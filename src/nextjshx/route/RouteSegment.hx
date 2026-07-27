package nextjshx.route;

/** One validated filesystem segment and its canonical URL projection. */
@:structInit
class RouteSegment {
	/** Exact spelling used by the App Router directory. */
	public final source:String;

	/** URL spelling, or null when a group/slot is erased from the URL. */
	public final publicSource:Null<String>;

	public final kind:RouteSegmentKind;
	public final segmentIndex:Int;
	public final parameter:Null<RouteParameter>;
	public final interception:Null<RouteInterceptionMarker>;

	public function new(source:String, publicSource:Null<String>, kind:RouteSegmentKind, segmentIndex:Int, ?parameter:RouteParameter,
			?interception:RouteInterceptionMarker) {
		this.source = source;
		this.publicSource = publicSource;
		this.kind = kind;
		this.segmentIndex = segmentIndex;
		this.parameter = parameter;
		this.interception = interception;
	}
}
