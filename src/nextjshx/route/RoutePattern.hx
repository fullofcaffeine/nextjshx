package nextjshx.route;

import haxe.ds.ReadOnlyArray;

/** A validated App Router filesystem path and its derived public topology. */
@:structInit
class RoutePattern {
	public final filesystemPath:String;
	public final publicPath:String;

	/** Every filesystem segment, including URL-elided groups and slots. */
	public final segments:ReadOnlyArray<RouteSegment>;

	/** Only the resolved segments that form the canonical request pathname. */
	public final publicSegments:ReadOnlyArray<RouteSegment>;

	public final parameters:ReadOnlyArray<RouteParameter>;
	public final topology:RouteTopologyKind;

	/** Ordered slot names without their filesystem `@` prefix. */
	public final parallelSlots:ReadOnlyArray<String>;

	public final interception:Null<RouteInterception>;

	public function new(filesystemPath:String, publicPath:String, segments:Array<RouteSegment>, publicSegments:Array<RouteSegment>,
			parameters:Array<RouteParameter>, topology:RouteTopologyKind, parallelSlots:Array<String>, ?interception:RouteInterception) {
		this.filesystemPath = filesystemPath;
		this.publicPath = publicPath;
		this.segments = segments.copy();
		this.publicSegments = publicSegments.copy();
		this.parameters = parameters.copy();
		this.topology = topology;
		this.parallelSlots = parallelSlots.copy();
		this.interception = interception;
	}
}
