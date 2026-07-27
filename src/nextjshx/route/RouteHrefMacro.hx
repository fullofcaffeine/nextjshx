package nextjshx.route;

#if macro
import haxe.macro.Context;
import haxe.macro.Expr;
import haxe.macro.Expr.Position;

private typedef BuiltRouteTemplate = {
	final literal:String;
	final format:String;
	final dynamicCount:Int;
}
#end

/** Internal expansion seam used by generated per-route href companions. */
class RouteHrefMacro {
	#if macro
	static function fail(code:String, message:String, position:Position):Void {
		Context.error('[$code] $message', position);
	}

	static function identifier(name:String, position:Position):Expr {
		return {expr: EConst(CIdent(name)), pos: position};
	}

	static function field(target:Expr, name:String, position:Position):Expr {
		return {expr: EField(target, name), pos: position};
	}

	static function typePath(name:String, position:Position):Expr {
		final parts = name.split(".");
		var expression = identifier(parts.shift(), position);
		for (part in parts) {
			expression = field(expression, part, position);
		}
		return expression;
	}

	static function declaration(name:String, value:Expr, position:Position):Expr {
		return {
			expr: EVars([
				{
					name: name,
					namePos: position,
					expr: value,
					isFinal: true
				}
			]),
			pos: position
		};
	}

	static function freshPrefix():String {
		final locals = Context.getLocalTVars();
		var index = 0;
		while (locals.exists('__nextRoute${index}Params')) {
			index++;
		}
		return '__nextRoute$index';
	}

	static function encodedSingle(binding:RouteParameterBinding, value:Expr, position:Position):Expr {
		final source = switch binding.codecType {
			case null:
				value;
			case codec:
				{
					expr: ECall(field(typePath(codec, position), "encode", position), [value]),
					pos: position
				};
		};
		return macro @:pos(position) StringTools.urlEncode($source);
	}

	static function encodedCatchAll(value:Expr, position:Position):Expr {
		return macro @:pos(position) $value.map(part -> StringTools.urlEncode(part)).join("/");
	}

	static function encoded(binding:RouteParameterBinding, value:Expr, position:Position):Expr {
		return switch binding.kind {
			case RouteParameterKind.Single: encodedSingle(binding, value, position);
			case RouteParameterKind.CatchAll | RouteParameterKind.OptionalCatchAll: encodedCatchAll(value, position);
			case _:
				fail("NXHX-ROUTE-HREF-0001", 'Unsupported route parameter kind ${binding.kind}.', position);
				macro "";
		};
	}

	static function routeTemplate(pattern:RoutePattern, locals:Map<String, String>, includeOptional:Bool):BuiltRouteTemplate {
		if (pattern.segments.length == 0) {
			return {literal: "/", format: "/", dynamicCount: 0};
		}
		var literal = "";
		var format = "";
		var dynamicCount = 0;
		for (segment in pattern.publicSegments) {
			if (segment.kind == RouteSegmentKind.OptionalCatchAll && !includeOptional) {
				continue;
			}
			final source = switch segment.publicSource {
				case null: Context.fatalError("A canonical route segment has no public source.", Context.currentPos());
				case value: value;
			};
			literal += '/$source';
			switch segment.parameter {
				case null:
					format += "/" + source.split("$").join("$$");
				case parameter:
					final local = locals.get(parameter.name);
					if (local == null) {
						return Context.fatalError('No encoded href binding was generated for route parameter "${parameter.name}".', Context.currentPos());
					}
					format += '/$' + '{$local}';
					dynamicCount++;
			}
		}
		if (!includeOptional && literal != "") {
			// Next's generated Route<T> contract spells an absent optional
			// catch-all as an empty final segment, for example `/archive/`.
			literal += "/";
			format += "/";
		}
		return {
			literal: literal == "" ? "/" : literal,
			format: format == "" ? "/" : format,
			dynamicCount: dynamicCount
		};
	}

	static function routeExpression(template:BuiltRouteTemplate, position:Position):Expr {
		if (template.dynamicCount == 0) {
			return {expr: EConst(CString(template.literal, DoubleQuotes)), pos: position};
		}
		final literal:Expr = {expr: EConst(CString(template.format, SingleQuotes)), pos: position};
		return macro @:pos(position) genes.TemplateLiteral.value($literal);
	}

	static function typedRouteHref(value:Expr, position:Position, handler:Bool):Expr {
		return
			handler ? macro @:pos(position) @:privateAccess nextjs.route.RouteHandlerHref.fromValidatedString($value) : macro @:pos(position) @:privateAccess nextjs.route.RouteHref.fromValidatedString($value);
	}

	static function expand(filesystemPath:String, params:Null<Expr>, handler:Bool):Expr {
		final position = Context.currentPos();
		final pattern = RoutePatternMacro.parse(filesystemPath, position);
		final providedParams = switch params {
			case null: null;
			case {expr: EConst(CIdent("null"))}: null;
			case value: value;
		};
		if (pattern.parameters.length == 0) {
			if (providedParams != null) {
				fail("NXHX-ROUTE-HREF-PARAMS-0001", 'Static route "$filesystemPath" does not accept href params.', providedParams.pos);
			}
			return typedRouteHref(routeExpression(routeTemplate(pattern, new Map<String, String>(), true), position), position, handler);
		}
		if (providedParams == null) {
			fail("NXHX-ROUTE-HREF-PARAMS-0001", 'Dynamic route "$filesystemPath" requires one exact href params value.', position);
			return macro "";
		}

		final validation = RouteParameterValidator.validate(pattern, Context.typeof(providedParams), providedParams.pos);
		final prefix = freshPrefix();
		final paramsName = '${prefix}Params';
		final locals = new Map<String, String>();
		for (index in 0...validation.bindings.length) {
			locals.set(validation.bindings[index].name, '${prefix}Encoded$index');
		}

		final expressions:Array<Expr> = [declaration(paramsName, providedParams, providedParams.pos)];
		final paramsExpression = identifier(paramsName, providedParams.pos);
		var optionalBinding:Null<RouteParameterBinding> = null;
		var optionalValue:Null<Expr> = null;
		for (index in 0...validation.bindings.length) {
			final binding = validation.bindings[index];
			final value = field(paramsExpression, binding.name, providedParams.pos);
			if (binding.kind == RouteParameterKind.OptionalCatchAll) {
				optionalBinding = binding;
				final optionalName = '${prefix}Optional';
				expressions.push(declaration(optionalName, value, providedParams.pos));
				optionalValue = identifier(optionalName, providedParams.pos);
			} else {
				expressions.push(declaration(locals.get(binding.name), encoded(binding, value, providedParams.pos), providedParams.pos));
			}
		}

		if (optionalBinding == null || optionalValue == null) {
			expressions.push(routeExpression(routeTemplate(pattern, locals, true), position));
			return typedRouteHref({expr: EBlock(expressions), pos: position}, position, handler);
		}

		final presentValue = macro @:pos(providedParams.pos) $optionalValue.assumePresent();
		final presentEncoded = encoded(optionalBinding, presentValue, providedParams.pos);
		final presentDeclaration = declaration(locals.get(optionalBinding.name), presentEncoded, providedParams.pos);
		final presentRoute = routeExpression(routeTemplate(pattern, locals, true), position);
		final presentBlock:Expr = {
			expr: EBlock([presentDeclaration, typedRouteHref(presentRoute, position, handler)]),
			pos: position
		};
		final absentRoute = routeExpression(routeTemplate(pattern, locals, false), position);
		final isAbsent = macro @:pos(providedParams.pos) genes.ts.Undefinable.isAbsent($optionalValue);
		expressions.push({expr: EIf(isAbsent, typedRouteHref(absentRoute, position, handler), presentBlock), pos: position});
		return {expr: EBlock(expressions), pos: position};
	}
	#end

	/** Expands one generated page companion after validating its caller params. */
	public static macro function build(filesystemPath:String, ?params:Expr):Expr {
		return expand(filesystemPath, params, false);
	}

	/** Expands one generated Route Handler companion without page-link identity. */
	public static macro function buildHandler(filesystemPath:String, ?params:Expr):Expr {
		return expand(filesystemPath, params, true);
	}
}
