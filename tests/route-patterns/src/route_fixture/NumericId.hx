package route_fixture;

@:next.routeCodec(route_fixture.NumericIdCodec)
abstract NumericId(Int) {
	public inline function new(value:Int) {
		this = value;
	}
}
