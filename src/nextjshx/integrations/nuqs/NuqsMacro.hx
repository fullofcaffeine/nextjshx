package nextjshx.integrations.nuqs;

#if macro
import haxe.macro.Context;
import haxe.macro.Expr;
import haxe.macro.Type;

using haxe.macro.TypeTools;
#end

/** Compile-time implementation of the semantic nuqs surface. */
class NuqsMacro {
	#if macro
	static inline final KEY_DIAGNOSTIC = "NXHX-NUQS-KEY-0001";
	static inline final PARSER_DIAGNOSTIC = "NXHX-NUQS-PARSER-0002";
	static inline final LITERAL_DIAGNOSTIC = "NXHX-NUQS-LITERAL-0003";

	static function fail<T>(message:String, position:Position):T {
		return Context.fatalError('[$KEY_DIAGNOSTIC] $message', position);
	}

	static function literalKey(expression:Expr):Null<String> {
		return switch expression.expr {
			case EParenthesis(inner) | EMeta(_, inner) | ECheckType(inner, _): literalKey(inner);
			case EConst(CString(value, _)): value;
			case _: null;
		};
	}

	static function applied(type:Type, parameters:Array<TypeParameter>, arguments:Array<Type>):Type {
		return type.applyTypeParameters(parameters, arguments);
	}

	static function isStringRepresentation(type:Type, depth:Int = 0):Bool {
		if (depth > 32) {
			return false;
		}
		return switch type {
			case TMono(reference): final resolved = reference.get(); resolved != null && isStringRepresentation(resolved, depth + 1);
			case TLazy(resolve): isStringRepresentation(resolve(), depth + 1);
			case TType(reference, arguments):
				final value = reference.get();
				isStringRepresentation(applied(value.type, value.params, arguments), depth + 1);
			case TInst(reference, _): final value = reference.get(); value.module == "String" && value.name == "String";
			case TAbstract(reference, arguments):
				final value = reference.get();
				isStringRepresentation(applied(value.type, value.params, arguments), depth + 1);
			case _:
				false;
		};
	}

	static function nominalAbstractType(value:AbstractType, arguments:Array<Type>, position:Position):ComplexType {
		final parameters:Array<TypeParam> = [];
		for (argument in arguments) {
			final complex = argument.toComplexType();
			if (complex == null) {
				Context.fatalError('[$LITERAL_DIAGNOSTIC] A closed string domain has an unresolved type parameter.', position);
			}
			parameters.push(TPType(complex));
		}
		final moduleParts = value.module.split(".");
		final moduleName = moduleParts[moduleParts.length - 1];
		return TPath({
			pack: value.pack,
			name: moduleName,
			sub: moduleName == value.name ? null : value.name,
			params: parameters
		});
	}

	static function stringLiteralDomain(type:Type, position:Position, depth:Int = 0):{type:Type, complex:ComplexType, identity:String} {
		if (depth > 32) {
			return Context.fatalError('[$LITERAL_DIAGNOSTIC] The closed string domain exceeded the supported alias depth.', position);
		}
		return switch type {
			case TMono(reference):
				final resolved = reference.get();
				if (resolved == null) {
					Context.fatalError('[$LITERAL_DIAGNOSTIC] A semantic string-literal parser requires a resolved closed Haxe domain.', position);
				}
				stringLiteralDomain(resolved, position, depth + 1);
			case TLazy(resolve):
				stringLiteralDomain(resolve(), position, depth + 1);
			case TType(reference, arguments):
				final value = reference.get();
				stringLiteralDomain(applied(value.type, value.params, arguments), position, depth + 1);
			case TAbstract(reference, arguments):
				final value = reference.get();
				if (!value.meta.has(":enum") || !isStringRepresentation(applied(value.type, value.params, arguments))) {
					Context.fatalError('[$LITERAL_DIAGNOSTIC] Semantic string-literal values must use one String-backed Haxe enum abstract. Use Parsers.string(...) for an open String value or the raw nuqs binding for a deliberately open domain.',
						position);
				}
				final complex = nominalAbstractType(value, arguments, position);
				{type: type,
					complex: complex,
					identity: value.module
					+ "."
					+ value.name
					+ "<"
					+ arguments.map(argument -> argument.toString()).join(",")
					+ ">"};
			case _:
				Context.fatalError('[$LITERAL_DIAGNOSTIC] Semantic string-literal values must use one String-backed Haxe enum abstract. Use Parsers.string(...) for an open String value or the raw nuqs binding for a deliberately open domain.',
					position);
		};
	}

	/** Builds a checked, never-emitted expression whose result retains `type`. */
	static function typedWitness(expression:Expr, type:ComplexType):Expr {
		final body:Expr = {expr: EReturn(expression), pos: expression.pos};
		final factory:Expr = {
			expr: EFunction(FAnonymous, {
				args: [],
				ret: type,
				expr: body
			}),
			pos: expression.pos
		};
		return {expr: ECall(factory, []), pos: expression.pos};
	}

	static function isScalar(type:Type, depth:Int = 0):Bool {
		if (depth > 32) {
			return false;
		}
		return switch type {
			case TMono(reference): final resolved = reference.get(); resolved != null && isScalar(resolved, depth + 1);
			case TLazy(resolve): isScalar(resolve(), depth + 1);
			case TType(reference, arguments):
				final value = reference.get();
				isScalar(applied(value.type, value.params, arguments), depth + 1);
			case TInst(reference, _): final value = reference.get(); value.module == "String" && value.name == "String";
			case TAbstract(reference, arguments): final value = reference.get(); (value.module == "StdTypes"
					&& ["Int", "Float", "Bool"].contains(value.name)) || (value.module != "StdTypes"
					&& isScalar(applied(value.type, value.params, arguments), depth + 1));
			case _:
				false;
		};
	}

	static function parserValue(type:Type, depth:Int = 0):Null<Type> {
		if (depth > 32) {
			return null;
		}
		return switch type {
			case TMono(reference):
				final resolved = reference.get();
				resolved == null ? null : parserValue(resolved, depth + 1);
			case TLazy(resolve): parserValue(resolve(), depth + 1);
			case TType(reference, arguments):
				final value = reference.get();
				parserValue(applied(value.type, value.params, arguments), depth + 1);
			case TInst(reference, [value]): final parser = reference.get(); parser.module == "nextjs.raw.integrations.nuqs.QueryParser" && (parser.name == "QueryParser"
					|| parser.name == "DefaultQueryParser") ? value : null;
			case _:
				null;
		};
	}

	static function validateParser(expression:Expr):Type {
		final value = parserValue(Context.typeof(expression));
		if (value == null || !isScalar(value)) {
			Context.fatalError('[$PARSER_DIAGNOSTIC] Semantic useQueryState accepts reviewed String, Int, Float, Bool, or scalar-domain parsers. Use nextjs.raw.integrations.nuqs.Nuqs.useQueryState for an arbitrary custom parser.',
				expression.pos);
		}
		return value;
	}

	static function needsExplicitTypeArgument(type:Type, depth:Int = 0):Bool {
		if (depth > 32) {
			return false;
		}
		return switch type {
			case TMono(reference): final resolved = reference.get(); resolved != null && needsExplicitTypeArgument(resolved, depth + 1);
			case TLazy(resolve): needsExplicitTypeArgument(resolve(), depth + 1);
			case TType(reference, arguments):
				final value = reference.get();
				needsExplicitTypeArgument(applied(value.type, value.params, arguments), depth + 1);
			case TAbstract(reference, _): reference.get().meta.has(":enum");
			case _:
				false;
		};
	}

	static function enumAbstractComplexType(type:Type, position:Position, depth:Int = 0):ComplexType {
		if (depth > 32) {
			return Context.fatalError('[$PARSER_DIAGNOSTIC] The parser value type exceeded the supported alias depth.', position);
		}
		return switch type {
			case TMono(reference):
				final resolved = reference.get();
				resolved == null ? Context.fatalError('[$PARSER_DIAGNOSTIC] The parser value type is unresolved.',
					position) : enumAbstractComplexType(resolved, position, depth + 1);
			case TLazy(resolve): enumAbstractComplexType(resolve(), position, depth + 1);
			case TType(reference, arguments):
				final value = reference.get();
				enumAbstractComplexType(applied(value.type, value.params, arguments), position, depth + 1);
			case TAbstract(reference, arguments):
				final value = reference.get();
				value.meta.has(":enum") ? nominalAbstractType(value, arguments,
					position) : Context.fatalError('[$PARSER_DIAGNOSTIC] The parser value is not a closed Haxe enum abstract.', position);
			case _:
				Context.fatalError('[$PARSER_DIAGNOSTIC] The parser value is not a closed Haxe enum abstract.', position);
		};
	}

	static function validateKey(expression:Expr):Void {
		final key = literalKey(expression);
		if (key == null) {
			fail("Semantic useQueryState requires a compile-time string key so its identity cannot change between renders. Use nextjs.raw.integrations.nuqs.Nuqs.useQueryState for a deliberately runtime key.",
				expression.pos);
		}
		if (!~/^[A-Za-z][A-Za-z0-9._~-]*$/.match(key)) {
			fail('Query key "$key" must start with an ASCII letter and then use only letters, digits, dot, underscore, tilde, or hyphen. Delimiters such as ?, &, =, and # belong to URL encoding, not the key.',
				expression.pos);
		}
	}

	public static function parser(field:String, arguments:Array<Expr>):Expr {
		if (arguments.length > 1) {
			return
				Context.fatalError('[$PARSER_DIAGNOSTIC] A semantic scalar parser accepts zero arguments for nullable state or one default value for non-null state.',
				arguments[1].pos);
		}
		final owner = macro nextjs.raw.integrations.nuqs.Nuqs;
		final parser:Expr = {expr: EField(owner, field), pos: Context.currentPos()};
		return arguments.length == 0 ? parser : macro @:pos(arguments[0].pos) $parser.withDefault(${arguments[0]});
	}

	public static function stringLiteralParser(validValues:Expr, defaultValue:Expr):Expr {
		final position = Context.currentPos();
		final values = switch validValues.expr {
			case EArrayDecl(values) if (values.length > 0): values;
			case EArrayDecl(_):
				return Context.fatalError('[$LITERAL_DIAGNOSTIC] A semantic string-literal parser requires at least one valid value.', validValues.pos);
			case _:
				return
					Context.fatalError('[$LITERAL_DIAGNOSTIC] Semantic string-literal values must be written as an inline Haxe array so the closed URL domain is visible at the call site.',
					validValues.pos);
		};
		final domain = stringLiteralDomain(Context.typeof(defaultValue), defaultValue.pos);
		for (value in values) {
			final member = stringLiteralDomain(Context.typeof(value), value.pos);
			if (member.identity != domain.identity) {
				Context.fatalError('[$LITERAL_DIAGNOSTIC] Every valid value and the default must belong to the same closed Haxe string domain; expected ${domain.identity}, received ${member.identity}.',
					value.pos);
			}
		}

		/*
		 * Haxe has already checked the enum abstract, but generic extern inference
		 * otherwise erases it to String before TypeScript emission. The genes-ts
		 * witness records that exact pre-erasure type and is then discarded. The
		 * direct extern callee receives the complete semantic call's source span;
		 * genes-ts additionally carries its exact target identity so the fluent
		 * `.withDefault(...)` call cannot claim the inner generic registration when
		 * Haxe relocates both typed expressions to the same macro invocation span.
		 */
		final template = macro nextjs.raw.integrations.nuqs.Nuqs.parseAsStringLiteral($validValues);
		final directCall:Expr = switch template.expr {
			case ECall(callee, arguments):
				{expr: ECall({expr: callee.expr, pos: position}, arguments), pos: position};
			case _:
				return Context.fatalError('[$LITERAL_DIAGNOSTIC] Internal string-literal parser expansion did not produce a direct nuqs call.',
					validValues.pos);
		};
		final parserWitness = typedWitness(defaultValue, domain.complex);
		final specialized = macro @:pos(position) genes.ts.TypeArguments.call($directCall, $parserWitness);
		final defaulted = macro @:pos(defaultValue.pos) $specialized.withDefault($defaultValue);
		final parserType:ComplexType = TPath({
			pack: ["nextjs", "raw", "integrations", "nuqs"],
			name: "QueryParser",
			sub: "DefaultQueryParser",
			params: [TPType(domain.complex)]
		});
		return {expr: ECheckType(defaulted, parserType), pos: defaultValue.pos};
	}

	public static function useQueryState(key:Expr, parser:Expr):Expr {
		validateKey(key);
		final valueType = validateParser(parser);
		final position = Context.currentPos();
		if (!needsExplicitTypeArgument(valueType)) {
			return macro @:pos(position) nextjshx.integrations.nuqs.NuqsHookBindings.useQueryState($key, $parser);
		}

		/*
		 * Reading the checked parser's default supplies the exact Value witness.
		 * genes-ts types that expression but never emits or evaluates it, and binds
		 * the registration to this direct Hook target rather than a surrounding
		 * fluent parser call. The parser remains one ordinary argument to one
		 * ordinary nuqs Hook call.
		 */
		final complex = enumAbstractComplexType(valueType, parser.pos);
		final parserDefault = macro @:pos(parser.pos) $parser.defaultValue;
		final witness = typedWitness(parserDefault, complex);
		final template = macro nextjshx.integrations.nuqs.NuqsHookBindings.useQueryStateContextual($key, $parser);
		final directCall:Expr = switch template.expr {
			case ECall(callee, arguments):
				{expr: ECall({expr: callee.expr, pos: position}, arguments), pos: position};
			case _:
				return Context.fatalError('[$PARSER_DIAGNOSTIC] Internal query-state expansion did not produce a direct nuqs Hook call.', position);
		};
		return macro @:pos(position) genes.ts.TypeArguments.call($directCall, $witness);
	}
	#end
}
