package nextjshx.route;

import haxe.ds.ReadOnlyArray;

/** A validated App Router filesystem path and its derived public URL pattern. */
@:structInit
class RoutePattern {
	public final filesystemPath:String;
	public final publicPath:String;
	public final segments:ReadOnlyArray<RouteSegment>;
	public final parameters:ReadOnlyArray<RouteParameter>;

	public function new(filesystemPath:String, publicPath:String, segments:Array<RouteSegment>, parameters:Array<RouteParameter>) {
		this.filesystemPath = filesystemPath;
		this.publicPath = publicPath;
		this.segments = segments.copy();
		this.parameters = parameters.copy();
	}
}
