package route_fixture;

import genes.ts.Undefinable;

class NegativeDeclarations {
	@:routeCase public static final absolute = 0;
	@:routeCase public static final traversal = 0;
	@:routeCase public static final reserved = 0;
	@:routeCase public static final malformed = 0;
	@:routeCase public static final group = 0;
	@:routeCase public static final slot = 0;
	@:routeCase public static final interception = 0;
	@:routeCase public static final duplicate = 0;
	@:routeCase public static final placement = 0;
	@:routeCase public static final missing = 0;
	@:routeCase public static final extra = 0;
	@:routeCase public static final wrongScalar = 0;
	@:routeCase public static final wrongCatchAll = 0;
	@:routeCase public static final wrongOptionalCatchAll = 0;
	@:routeCase public static final optionalField = 0;
	@:routeCase public static final missingCodec = 0;
	@:routeCase public static final invalidCodec = 0;
	@:routeCase public static final notAnonymous = 0;
}

typedef MissingParams = {
	final slug:String;
}

typedef ExtraParams = {
	final id:String;
	final extra:String;
}

typedef WrongScalarParams = {
	final id:Int;
}

typedef WrongCatchAllParams = {
	final slug:String;
}

typedef WrongOptionalCatchAllParams = {
	final slug:Null<Array<String>>;
}

typedef OptionalFieldParams = {
	final ?slug:Undefinable<Array<String>>;
}

abstract MissingCodecId(Int) {}

typedef MissingCodecParams = {
	final id:MissingCodecId;
}

@:next.routeCodec(route_fixture.NegativeDeclarations.BadNumericIdCodec)
abstract BadNumericId(Int) {
	public inline function new(value:Int) {
		this = value;
	}
}

class BadNumericIdCodec {
	public static function decode(value:String):BadNumericId {
		final parsed = Std.parseInt(value);
		return new BadNumericId(parsed == null ? 0 : parsed);
	}

	public static function encode(value:String):String {
		return value;
	}
}

typedef InvalidCodecParams = {
	final id:BadNumericId;
}

typedef NotAnonymousParams = String;
