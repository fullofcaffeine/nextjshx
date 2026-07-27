package nextjshx.route;

/** Canonical meaning derived from one validated intercepting filesystem segment. */
@:structInit
class RouteInterception {
	public final marker:RouteInterceptionMarker;
	public final segmentIndex:Int;
	public final interceptingPath:String;
	public final interceptedPath:String;

	public function new(marker:RouteInterceptionMarker, segmentIndex:Int, interceptingPath:String, interceptedPath:String) {
		this.marker = marker;
		this.segmentIndex = segmentIndex;
		this.interceptingPath = interceptingPath;
		this.interceptedPath = interceptedPath;
	}
}
