package nextjshx.route;

#if macro
import haxe.io.Bytes;
import haxe.macro.Context;
import haxe.macro.Expr;
import haxe.macro.Expr.MetadataEntry;
import haxe.macro.Expr.Position;
import haxe.macro.Type;
import haxe.macro.Type.AbstractType;
import haxe.macro.Type.ClassField;
import haxe.macro.Type.ClassType;

using haxe.macro.TypeTools;
using StringTools;

private typedef ResolvedRouteCodec = {
	final type:ClassType;
	final name:String;
	final position:Position;
}
#end

/** Validates the exact Haxe anonymous params shape for a parsed route. */
class RouteParameterValidator {
	#if macro
	static function fail(code:String, message:String, position:Position):Void {
		Context.error('[$code] $message', position);
	}

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

	static function resolveAliases(type:Type):Type {
		return switch type {
			case TMono(reference):
				final value = reference.get();
				value == null ? type : resolveAliases(value);
			case TLazy(resolve):
				resolveAliases(resolve());
			case TType(reference, parameters):
				final definition = reference.get();
				resolveAliases(definition.type.applyTypeParameters(definition.params, parameters));
			case _:
				type;
		};
	}

	static function isString(type:Type):Bool {
		return switch resolveAliases(type) {
			case TInst(reference, parameters): final definition = reference.get(); parameters.length == 0 && definition.pack.length == 0 && definition.name == "String";
			case _:
				false;
		};
	}

	static function isStringArray(type:Type):Bool {
		return switch resolveAliases(type) {
			case TInst(reference, [element]): final definition = reference.get(); definition.pack.length == 0 && definition.name == "Array" && isString(element);
			case _:
				false;
		};
	}

	static function isOptionalStringArray(type:Type):Bool {
		return switch resolveAliases(type) {
			case TAbstract(reference, [value]): final definition = reference.get(); definition.module == "genes.ts.Undefinable" && definition.name == "Undefinable" && isStringArray(value);
			case _:
				false;
		};
	}

	static function abstractIdentity(type:AbstractType):String {
		return '${type.module}.${type.name}';
	}

	static function isStringBacked(type:Type, seen:Map<String, Bool>):Bool {
		final resolved = resolveAliases(type);
		if (isString(resolved)) {
			return true;
		}
		return switch resolved {
			case TAbstract(reference, parameters):
				final definition = reference.get();
				final identity = abstractIdentity(definition);
				if (definition.meta.has(":coreType")
					|| definition.module == "Null"
					|| definition.module == "genes.ts.Undefinable"
					|| seen.exists(identity)) {
					false;
				} else {
					seen.set(identity, true);
					isStringBacked(definition.type.applyTypeParameters(definition.params, parameters), seen);
				}
			case _:
				false;
		};
	}

	static function typeName(type:Type):String {
		return resolveAliases(type).toString();
	}

	static function sameType(left:Type, right:Type):Bool {
		return typeName(left) == typeName(right);
	}

	static function metadataTypePath(expression:Expr, position:Position):String {
		return switch expression.expr {
			case EConst(CIdent(name)):
				name;
			case EField(target, field):
				'${metadataTypePath(target, position)}.$field';
			case EParenthesis(inner):
				metadataTypePath(inner, position);
			case _:
				fail("NXHX-ROUTE-CODEC-0001", "@:next.routeCodec requires one codec class type path.", position);
				"";
		};
	}

	static function fullTypeName(type:ClassType):String {
		final suffix = type.module == type.name || type.module.endsWith('.${type.name}') ? "" : '.${type.name}';
		return type.module + suffix;
	}

	static function routeCodec(abstractType:AbstractType):Null<ResolvedRouteCodec> {
		final matches:Array<MetadataEntry> = [];
		for (entry in abstractType.meta.get()) {
			if (entry.name == ":next.routeCodec") {
				matches.push(entry);
			}
		}
		if (matches.length == 0) {
			return null;
		}
		if (matches.length != 1) {
			fail("NXHX-ROUTE-CODEC-0001", 'Domain abstract ${abstractIdentity(abstractType)} must declare at most one @:next.routeCodec.', matches[1].pos);
		}
		final entry = matches[0];
		if (entry.params.length != 1) {
			fail("NXHX-ROUTE-CODEC-0001", '@:next.routeCodec on ${abstractIdentity(abstractType)} requires exactly one codec class type path.', entry.pos);
		}
		final requested = metadataTypePath(entry.params[0], entry.pos);
		final qualified = requested.indexOf(".") == -1 ? abstractType.pack.concat([requested]).join(".") : requested;
		final codecType = resolveAliases(Context.getType(qualified));
		return switch codecType {
			case TInst(reference, parameters):
				final definition = reference.get();
				if (parameters.length != 0 || definition.params.length != 0) {
					fail("NXHX-ROUTE-CODEC-0001", 'Route codec "$qualified" must be a non-generic class.', entry.pos);
				}
				{type: definition, name: fullTypeName(definition), position: entry.pos};
			case _:
				fail("NXHX-ROUTE-CODEC-0001", '@:next.routeCodec target "$qualified" must be a class.', entry.pos);
				null;
		};
	}

	static function codecMethod(codec:ResolvedRouteCodec, name:String):ClassField {
		for (field in codec.type.statics.get()) {
			if (field.name == name) {
				if (!field.isPublic || field.params.length != 0) {
					fail("NXHX-ROUTE-CODEC-0001", 'Route codec "${codec.name}" method "$name" must be public static and non-generic.', field.pos);
				}
				return field;
			}
		}
		fail("NXHX-ROUTE-CODEC-0001", 'Route codec "${codec.name}" is missing public static method "$name".', codec.position);
		return codec.type.statics.get()[0];
	}

	static function validateCodec(codec:ResolvedRouteCodec, valueType:Type):Void {
		final valueName = typeName(valueType);
		final decode = codecMethod(codec, "decode");
		switch resolveAliases(decode.type) {
			case TFun([{opt: false, t: argument}], result) if (isString(argument) && sameType(result, valueType)):
			case _:
				fail("NXHX-ROUTE-CODEC-0001", 'Route codec "${codec.name}" decode must have exact signature decode(value:String):$valueName.', decode.pos);
		}
		final encode = codecMethod(codec, "encode");
		switch resolveAliases(encode.type) {
			case TFun([{opt: false, t: argument}], result) if (sameType(argument, valueType) && isString(result)):
			case _:
				fail("NXHX-ROUTE-CODEC-0001", 'Route codec "${codec.name}" encode must have exact signature encode(value:$valueName):String.', encode.pos);
		}
	}

	static function validateSingle(parameter:RouteParameter, field:ClassField):RouteParameterBinding {
		final fieldType = resolveAliases(field.type);
		if (isString(fieldType)) {
			return new RouteParameterBinding(parameter.name, parameter.kind, typeName(fieldType));
		}
		return switch fieldType {
			case TAbstract(reference, _):
				final definition = reference.get();
				final codec = routeCodec(definition);
				if (codec != null) {
					validateCodec(codec, fieldType);
					new RouteParameterBinding(parameter.name, parameter.kind, typeName(fieldType), codec.name);
				} else if (isStringBacked(fieldType, new Map<String, Bool>())) {
					new RouteParameterBinding(parameter.name, parameter.kind, typeName(fieldType));
				} else {
					fail("NXHX-ROUTE-PARAM-TYPE-0001",
						'Route parameter "${parameter.name}" must be String, a transitively string-backed abstract, or a domain abstract with a validated @:next.routeCodec; found ${typeName(fieldType)}.',
						field.pos);
					new RouteParameterBinding(parameter.name, parameter.kind, typeName(fieldType));
				}
			case _:
				fail("NXHX-ROUTE-PARAM-TYPE-0001",
					'Route parameter "${parameter.name}" must be String, a transitively string-backed abstract, or a domain abstract with a validated @:next.routeCodec; found ${typeName(fieldType)}.',
					field.pos);
				new RouteParameterBinding(parameter.name, parameter.kind, typeName(fieldType));
		};
	}

	static function validateField(parameter:RouteParameter, field:ClassField):RouteParameterBinding {
		if (field.meta.has(":optional")) {
			fail("NXHX-ROUTE-PARAM-TYPE-0001",
				'Route parameter field "${parameter.name}" must be required; optional catch-all absence is represented by genes.ts.Undefinable<Array<String>>.',
				field.pos);
		}
		return switch parameter.kind {
			case RouteParameterKind.Single:
				validateSingle(parameter, field);
			case RouteParameterKind.CatchAll:
				if (!isStringArray(field.type)) {
					fail("NXHX-ROUTE-PARAM-TYPE-0001", 'Catch-all route parameter "${parameter.name}" must be Array<String>; found ${typeName(field.type)}.',
						field.pos);
				}
				new RouteParameterBinding(parameter.name, parameter.kind, typeName(field.type));
			case RouteParameterKind.OptionalCatchAll:
				if (!isOptionalStringArray(field.type)) {
					fail("NXHX-ROUTE-PARAM-TYPE-0001",
						'Optional catch-all route parameter "${parameter.name}" must be genes.ts.Undefinable<Array<String>>; found ${typeName(field.type)}.',
						field.pos);
				}
				new RouteParameterBinding(parameter.name, parameter.kind, typeName(field.type));
			case _:
				fail("NXHX-ROUTE-PARAM-TYPE-0001", 'Unsupported route parameter kind ${parameter.kind}.', field.pos);
				new RouteParameterBinding(parameter.name, parameter.kind, typeName(field.type));
		};
	}

	/** Validates and returns the exact route bindings needed by later phases. */
	public static function validate(pattern:RoutePattern, paramsType:Type, position:Position):RouteParameterValidation {
		final fields = switch resolveAliases(paramsType) {
			case TAnonymous(reference): reference.get().fields.copy();
			case TInst(reference, parameters):
				final definition = reference.get();
				if (parameters.length == 0 && definition.params.length == 0 && definition.meta.has(":structInit")) {
					definition.fields.get().filter(field -> switch field.kind {
						case FVar(_, _): true;
						case _: false;
					});
				} else {
					fail("NXHX-ROUTE-PARAMS-0001",
						'Params for route "${pattern.filesystemPath}" must be an anonymous typedef or non-generic @:structInit class with exactly its dynamic fields; found ${typeName(paramsType)}.',
						position);
					[];
				}
			case _:
				fail("NXHX-ROUTE-PARAMS-0001",
					'Params for route "${pattern.filesystemPath}" must be an anonymous typedef or non-generic @:structInit class with exactly its dynamic fields; found ${typeName(paramsType)}.',
					position);
				[];
		};
		final byName = new Map<String, ClassField>();
		for (field in fields) {
			byName.set(field.name, field);
		}
		final bindings:Array<RouteParameterBinding> = [];
		final expected = new Map<String, Bool>();
		for (parameter in pattern.parameters) {
			expected.set(parameter.name, true);
			final field = byName.get(parameter.name);
			if (field == null) {
				fail("NXHX-ROUTE-PARAM-MISSING-0001",
					'Params for route "${pattern.filesystemPath}" are missing required field "${parameter.name}" for segment ${parameter.segmentIndex}.',
					position);
			} else {
				bindings.push(validateField(parameter, field));
			}
		}
		final extras = fields.filter(field -> !expected.exists(field.name));
		extras.sort((left, right) -> compareString(left.name, right.name));
		if (extras.length > 0) {
			final extra = extras[0];
			fail("NXHX-ROUTE-PARAM-EXTRA-0001",
				'Params for route "${pattern.filesystemPath}" contain extra field "${extra.name}" that no dynamic segment supplies.', extra.pos);
		}
		return new RouteParameterValidation(bindings);
	}
	#end
}
