package route_fixture;

class NumericIdCodec {
	public static function decode(value:String):NumericId {
		final parsed = Std.parseInt(value);
		return new NumericId(parsed == null ? 0 : parsed);
	}

	public static function encode(value:NumericId):String {
		return Std.string(value);
	}
}
