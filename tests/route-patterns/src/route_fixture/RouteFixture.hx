package route_fixture;

#if macro
import haxe.Json;
import haxe.io.Bytes;
import haxe.macro.Context;
import haxe.macro.Expr;
import haxe.macro.Expr.Position;
import haxe.macro.Type.ClassType;
import nextjshx.route.RouteParameterBinding;
import nextjshx.route.RouteParameterValidator;
import nextjshx.route.RoutePattern;
import nextjshx.route.RoutePatternMacro;
import sys.io.File;

private typedef PositiveCase = {
	final path:String;
	final paramsType:String;
}

private typedef NegativeCase = {
	final path:String;
	final paramsType:String;
	final marker:String;
}

private typedef SegmentRecord = {
	final source:String;
	final kind:String;
	final segmentIndex:Int;
}

private typedef ParameterRecord = {
	final name:String;
	final kind:String;
	final segmentIndex:Int;
	final haxeType:String;
	final codecType:Null<String>;
}

private typedef RouteRecord = {
	final filesystemPath:String;
	final publicPath:String;
	final segments:Array<SegmentRecord>;
	final parameters:Array<ParameterRecord>;
}

class RouteFixture {
	static function compareString(left:String, right:String):Int {
		final leftBytes = Bytes.ofString(left);
		final rightBytes = Bytes.ofString(right);
		final sharedLength = leftBytes.length < rightBytes.length ? leftBytes.length : rightBytes.length;
		for (index in 0...sharedLength) {
			final difference = leftBytes.get(index) - rightBytes.get(index);
			if (difference != 0) {
				return difference;
			}
		}
		return leftBytes.length - rightBytes.length;
	}

	static function requireClass(typeName:String):ClassType {
		return switch Context.getType(typeName) {
			case TInst(reference, _): reference.get();
			case _:
				Context.fatalError('Route fixture type "$typeName" is not a class.', Context.currentPos());
		};
	}

	static function markerPosition(name:String):Position {
		for (field in requireClass("route_fixture.NegativeDeclarations").statics.get()) {
			if (field.name == name) {
				return field.pos;
			}
		}
		return Context.fatalError('Route fixture marker "$name" is missing.', Context.currentPos());
	}

	static function positiveCases():Array<PositiveCase> {
		return [
			{path: "", paramsType: "route_fixture.StaticParams"},
			{path: "about", paramsType: "route_fixture.StaticParams"},
			{path: "archive/[[...slug]]", paramsType: "route_fixture.OptionalCatchAllParams"},
			{path: "docs/[...slug]", paramsType: "route_fixture.CatchAllParams"},
			{path: "orders/[id]", paramsType: "route_fixture.CodecParams"},
			{path: "teams/[teamId]/members/[memberId]", paramsType: "route_fixture.MultipleParams"},
			{path: "todos/[id]", paramsType: "route_fixture.DynamicParams"}
		];
	}

	static function negativeCase(name:String):NegativeCase {
		return switch name {
			case "absolute": {path: "/todos/[id]", paramsType: "route_fixture.DynamicParams", marker: "absolute"};
			case "traversal": {path: "todos/../[id]", paramsType: "route_fixture.DynamicParams", marker: "traversal"};
			case "reserved": {path: "todos/_private/[id]", paramsType: "route_fixture.DynamicParams", marker: "reserved"};
			case "malformed": {path: "todos/[[id]]", paramsType: "route_fixture.DynamicParams", marker: "malformed"};
			case "group": {path: "(marketing)/todos", paramsType: "route_fixture.StaticParams", marker: "group"};
			case "slot": {path: "todos/@modal/[id]", paramsType: "route_fixture.DynamicParams", marker: "slot"};
			case "interception": {path: "feed/(..)photo/[id]", paramsType: "route_fixture.DynamicParams", marker: "interception"};
			case "duplicate": {path: "teams/[id]/members/[id]", paramsType: "route_fixture.DynamicParams", marker: "duplicate"};
			case "placement": {path: "docs/[...slug]/edit", paramsType: "route_fixture.CatchAllParams", marker: "placement"};
			case "missing": {path: "todos/[id]", paramsType: "route_fixture.NegativeDeclarations.MissingParams", marker: "missing"};
			case "extra": {path: "todos/[id]", paramsType: "route_fixture.NegativeDeclarations.ExtraParams", marker: "extra"};
			case "wrong-scalar": {path: "todos/[id]", paramsType: "route_fixture.NegativeDeclarations.WrongScalarParams", marker: "wrongScalar"};
			case "wrong-catch-all": {path: "docs/[...slug]", paramsType: "route_fixture.NegativeDeclarations.WrongCatchAllParams", marker: "wrongCatchAll"};
			case "wrong-optional-catch-all": {
					path: "archive/[[...slug]]",
					paramsType: "route_fixture.NegativeDeclarations.WrongOptionalCatchAllParams",
					marker: "wrongOptionalCatchAll"
				};
			case "optional-field": {path: "archive/[[...slug]]", paramsType: "route_fixture.NegativeDeclarations.OptionalFieldParams", marker: "optionalField"};
			case "missing-codec": {path: "todos/[id]", paramsType: "route_fixture.NegativeDeclarations.MissingCodecParams", marker: "missingCodec"};
			case "invalid-codec": {path: "todos/[id]", paramsType: "route_fixture.NegativeDeclarations.InvalidCodecParams", marker: "invalidCodec"};
			case "not-anonymous": {path: "todos/[id]", paramsType: "route_fixture.NegativeDeclarations.NotAnonymousParams", marker: "notAnonymous"};
			case _:
				Context.fatalError('Unknown route fixture case "$name".', Context.currentPos());
		};
	}

	static function record(pattern:RoutePattern, bindings:Array<RouteParameterBinding>):RouteRecord {
		return {
			filesystemPath: pattern.filesystemPath,
			publicPath: pattern.publicPath,
			segments: [
				for (segment in pattern.segments)
					{
						source: segment.source,
						kind: segment.kind,
						segmentIndex: segment.segmentIndex
					}
			],
			parameters: [
				for (binding in bindings) {
					final parameter = pattern.parameters.filter(value -> value.name == binding.name)[0];
					{
						name: binding.name,
						kind: binding.kind,
						segmentIndex: parameter.segmentIndex,
						haxeType: binding.haxeType,
						codecType: binding.codecType
					};
				}
			]
		};
	}

	static function validate(path:String, paramsType:String, position:Position):RouteRecord {
		final pattern = RoutePatternMacro.parse(path, position);
		final validation = RouteParameterValidator.validate(pattern, Context.getType(paramsType), position);
		return record(pattern, validation.bindings.copy());
	}

	public static macro function emit(outputPath:String, order:String):Expr {
		final cases = positiveCases();
		if (order == "reverse") {
			cases.reverse();
		} else if (order != "forward") {
			Context.fatalError('Unknown route fixture order "$order".', Context.currentPos());
		}
		final routes = [
			for (entry in cases)
				validate(entry.path, entry.paramsType, Context.currentPos())
		];
		routes.sort((left, right) -> compareString(left.filesystemPath, right.filesystemPath));
		File.saveContent(outputPath, Json.stringify({schemaVersion: 1, routes: routes}));
		return macro null;
	}

	public static macro function reject():Expr {
		final name = Context.definedValue("route_case");
		if (name == null) {
			Context.fatalError("The route_case define is required by the negative route fixture.", Context.currentPos());
		}
		final entry = negativeCase(name);
		validate(entry.path, entry.paramsType, markerPosition(entry.marker));
		return macro null;
	}
}
#end
