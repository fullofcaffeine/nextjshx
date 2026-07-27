package nextjshx.route;

#if macro
import haxe.crypto.Sha256;
import haxe.macro.Context;
import haxe.macro.Expr;
import nextjshx.route.QueryFieldBinding.QueryFieldCardinality;
import nextjshx.route.QueryFieldBinding.QueryValueEncoding;
#end

/** Internal expansion seam for one parser-validated pathname and closed query schema. */
class RouteQueryMacro {
	#if macro
	static final routePathMarkers = new Map<String, ComplexType>();

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

	static function declaration(name:String, value:Expr, position:Position, ?type:ComplexType):Expr {
		return {
			expr: EVars([
				{
					name: name,
					namePos: position,
					type: type,
					expr: value,
					isFinal: true
				}
			]),
			pos: position
		};
	}

	static function routePathType(pattern:RoutePattern, position:Position):ComplexType {
		final typeValue = RoutePatternType.typeScript(pattern);
		final existing = routePathMarkers.get(typeValue);
		if (existing != null) {
			return existing;
		}
		final markerName = 'NextJsHxQueryPath_${Sha256.encode(typeValue).substr(0, 16)}';
		final markerPack = ["nextjshx", "generated", "query"];
		Context.defineType({
			pack: markerPack,
			name: markerName,
			pos: position,
			meta: [
				{name: ":ts.type", params: [{expr: EConst(CString(typeValue, DoubleQuotes)), pos: position}], pos: position},
				{name: ":noCompletion", params: [], pos: position}
			],
			params: [],
			isExtern: true,
			kind: TDClass(),
			fields: []
		});
		final marker:ComplexType = TPath({pack: markerPack, name: markerName});
		routePathMarkers.set(typeValue, marker);
		return TPath({
			pack: ["nextjs", "route"],
			name: "RouteHref",
			sub: "RoutePath",
			params: [TPType(marker)]
		});
	}

	static function freshPrefix():String {
		final locals = Context.getLocalTVars();
		var index = 0;
		while (locals.exists('__nextQuery${index}Href')) {
			index++;
		}
		return '__nextQuery$index';
	}

	static function encoded(encoding:QueryValueEncoding, value:Expr, position:Position):Expr {
		return switch encoding {
			case QueryValueEncoding.Text:
				macro @:pos(position) Std.string($value);
			case QueryValueEncoding.Int32:
				macro @:pos(position) Std.string($value);
			case QueryValueEncoding.Boolean:
				macro @:pos(position) $value ? "true" : "false";
			case QueryValueEncoding.Custom(codecType):
				{expr: ECall(field(typePath(codecType, position), "encode", position), [value]), pos: position};
		};
	}

	static function append(params:Expr, name:String, value:Expr, position:Position):Expr {
		return {
			expr: ECall(field(params, "append", position), [{expr: EConst(CString(name, DoubleQuotes)), pos: position}, value]),
			pos: position
		};
	}

	static function template(hrefName:String, queryName:String, position:Position):Expr {
		final format = '$' + '{' + hrefName + '}?$' + '{' + queryName + '}';
		final literal:Expr = {expr: EConst(CString(format, SingleQuotes)), pos: position};
		return macro @:pos(position) genes.TemplateLiteral.value($literal);
	}

	static function typedQueryHref(value:Expr, position:Position):Expr {
		return macro @:pos(position) @:privateAccess nextjs.route.RouteHrefWithQuery.fromValidatedString($value);
	}

	static function patternString(value:Expr, position:Position):Expr {
		return macro @:pos(position) @:privateAccess nextjs.route.RouteHref.toPatternString($value);
	}
	#end

	/** Builds one pathname and appends a validated query without accepting a separate href. */
	public static macro function build(filesystemPath:String, paramsOrQuery:Expr, ?query:Expr):Expr {
		final position = Context.currentPos();
		final pattern = RoutePatternMacro.parse(filesystemPath, position);
		final providedQuery = switch query {
			case null: null;
			case {expr: EConst(CIdent("null"))}: null;
			case value: value;
		};
		final input:{final href:Expr; final queryValue:Expr;} = if (pattern.parameters.length == 0) {
			if (providedQuery != null) {
				fail("NXHX-ROUTE-QUERY-HREF-0004", 'Static query route "$filesystemPath" accepts the query value only.', providedQuery.pos);
				return macro "";
			}
			{
				href: macro nextjshx.route.RouteHrefMacro.build($v{pattern.filesystemPath}),
				queryValue: paramsOrQuery
			};
		} else {
			if (providedQuery == null) {
				fail("NXHX-ROUTE-QUERY-HREF-0004", 'Dynamic query route "$filesystemPath" requires exact params followed by the query value.',
					paramsOrQuery.pos);
				return macro "";
			}
			{
				href: macro nextjshx.route.RouteHrefMacro.build($v{pattern.filesystemPath}, $paramsOrQuery),
				queryValue: providedQuery
			};
		};
		final href = input.href;
		final queryValue = input.queryValue;
		final schema = QuerySchemaValidator.validate(Context.typeof(queryValue), queryValue.pos);
		final prefix = freshPrefix();
		final hrefName = '${prefix}Href';
		final queryName = '${prefix}Value';
		final paramsName = '${prefix}Params';
		final encodedName = '${prefix}Encoded';
		final expressions:Array<Expr> = [
			declaration(hrefName, patternString(href, href.pos), href.pos, routePathType(pattern, href.pos)),
			declaration(queryName, queryValue, queryValue.pos),
			declaration(paramsName, macro @:pos(position) new nextjs.raw.server.WebSearchParams(), position)
		];
		final queryExpression = identifier(queryName, queryValue.pos);
		final paramsValue = identifier(paramsName, position);
		for (index in 0...schema.bindings.length) {
			final binding = schema.bindings[index];
			final value = field(queryExpression, binding.fieldName, binding.position);
			switch binding.cardinality {
				case QueryFieldCardinality.Required:
					expressions.push(append(paramsValue, binding.queryName, encoded(binding.encoding, value, binding.position), binding.position));
				case QueryFieldCardinality.Optional:
					final optionalName = '${prefix}Optional$index';
					final absentName = '${prefix}Absent$index';
					expressions.push(declaration(optionalName, value, binding.position));
					final optionalValue = identifier(optionalName, binding.position);
					final present = macro @:pos(binding.position) $optionalValue.assumePresent();
					final appendPresent = append(paramsValue, binding.queryName, encoded(binding.encoding, present, binding.position), binding.position);
					final isAbsent = macro @:pos(binding.position) genes.ts.Undefinable.isAbsent($optionalValue);
					expressions.push(declaration(absentName, isAbsent, binding.position));
					final noOp = macro @:pos(binding.position) {};
					expressions.push({expr: EIf(identifier(absentName, binding.position), noOp, appendPresent), pos: binding.position});
				case QueryFieldCardinality.Repeated:
					final itemName = '${prefix}Item$index';
					final item = identifier(itemName, binding.position);
					final iterator:Expr = {expr: EBinop(OpIn, item, value), pos: binding.position};
					final body = append(paramsValue, binding.queryName, encoded(binding.encoding, item, binding.position), binding.position);
					expressions.push({expr: EFor(iterator, body), pos: binding.position});
			}
		}
		expressions.push(declaration(encodedName, macro @:pos(position) $paramsValue.toString(), position));
		final hrefValue = identifier(hrefName, href.pos);
		final encodedValue = identifier(encodedName, position);
		final noQuery = macro @:pos(position) $encodedValue == "";
		final appended = typedQueryHref(template(hrefName, encodedName, position), position);
		expressions.push({expr: EIf(noQuery, typedQueryHref(hrefValue, position), appended), pos: position});
		return {expr: EBlock(expressions), pos: position};
	}
}
