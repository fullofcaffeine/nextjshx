package nextjshx.route;

#if macro
import haxe.io.Bytes;
import haxe.macro.Context;
import haxe.macro.Expr;
import haxe.macro.Type;
import haxe.macro.Type.AbstractType;
import haxe.macro.Type.ClassField;
import haxe.macro.Type.ClassType;
import nextjshx.route.QueryFieldBinding.QueryFieldCardinality;
import nextjshx.route.QueryFieldBinding.QuerySchemaValidation;
import nextjshx.route.QueryFieldBinding.QueryValueEncoding;

using StringTools;
using haxe.macro.TypeTools;

private typedef ResolvedQueryCodec = {
	final type:ClassType;
	final name:String;
	final position:Position;
}
#end

/** Validates the closed named query records consumed by generated hrefs. */
class QuerySchemaValidator {
	#if macro
	static function fail<T>(code:String, message:String, position:Position):T {
		return Context.fatalError('[$code] $message', position);
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
			case TLazy(resolve): resolveAliases(resolve());
			case TType(reference, parameters):
				final definition = reference.get();
				resolveAliases(definition.type.applyTypeParameters(definition.params, parameters));
			case _: type;
		};
	}

	static function typeName(type:Type):String {
		return resolveAliases(type).toString();
	}

	static function sameType(left:Type, right:Type):Bool {
		return typeName(left) == typeName(right);
	}

	static function isString(type:Type):Bool {
		return switch resolveAliases(type) {
			case TInst(reference, parameters): final definition = reference.get(); parameters.length == 0 && definition.pack.length == 0 && definition.name == "String";
			case _: false;
		};
	}

	static function isStdAbstract(type:Type, name:String):Bool {
		return switch resolveAliases(type) {
			case TAbstract(reference, parameters): final definition = reference.get(); parameters.length == 0 && definition.module == "StdTypes" && definition.name == name;
			case _: false;
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
			case _: false;
		};
	}

	static function metadataTypePath(expression:Expr, code:String, label:String):String {
		return switch expression.expr {
			case EConst(CIdent(name)): name;
			case EField(target, field): '${metadataTypePath(target, code, label)}.$field';
			case EParenthesis(inner): metadataTypePath(inner, code, label);
			case _:
				fail(code, '$label requires one class type path.', expression.pos);
				"";
		};
	}

	static function fullTypeName(type:ClassType):String {
		final suffix = type.module == type.name || type.module.endsWith('.${type.name}') ? "" : '.${type.name}';
		return type.module + suffix;
	}

	static function queryCodec(abstractType:AbstractType):Null<ResolvedQueryCodec> {
		final matches = abstractType.meta.get().filter(entry -> entry.name == ":next.queryCodec");
		if (matches.length == 0) {
			return null;
		}
		if (matches.length != 1) {
			return fail("NXHX-ROUTE-QUERY-CODEC-0003", 'Domain abstract ${abstractIdentity(abstractType)} must declare at most one @:next.queryCodec.',
				matches[1].pos);
		}
		final entry = matches[0];
		if (entry.params.length != 1) {
			return fail("NXHX-ROUTE-QUERY-CODEC-0003", '@:next.queryCodec on ${abstractIdentity(abstractType)} requires exactly one codec class type path.',
				entry.pos);
		}
		final requested = metadataTypePath(entry.params[0], "NXHX-ROUTE-QUERY-CODEC-0003", "@:next.queryCodec");
		final qualified = requested.indexOf(".") == -1 ? abstractType.pack.concat([requested]).join(".") : requested;
		return switch resolveAliases(Context.getType(qualified)) {
			case TInst(reference, parameters):
				final definition = reference.get();
				if (parameters.length != 0 || definition.params.length != 0) {
					fail("NXHX-ROUTE-QUERY-CODEC-0003", 'Query codec "$qualified" must be a non-generic class.', entry.pos);
				}
				{type: definition, name: fullTypeName(definition), position: entry.pos};
			case _:
				fail("NXHX-ROUTE-QUERY-CODEC-0003", '@:next.queryCodec target "$qualified" must be a class.', entry.pos);
				null;
		};
	}

	static function validateCodec(codec:ResolvedQueryCodec, valueType:Type):Void {
		final fields = codec.type.statics.get().filter(field -> field.name == "encode");
		if (fields.length != 1) {
			fail("NXHX-ROUTE-QUERY-CODEC-0003", 'Query codec "${codec.name}" must expose exactly one public static encode method.', codec.position);
		}
		final encode = fields[0];
		if (!encode.isPublic || encode.params.length != 0) {
			fail("NXHX-ROUTE-QUERY-CODEC-0003", 'Query codec "${codec.name}" encode must be public static and non-generic.', encode.pos);
		}
		final valueName = typeName(valueType);
		switch resolveAliases(encode.type) {
			case TFun([{opt: false, t: argument}], result) if (sameType(argument, valueType) && isString(result)):
			case _:
				fail("NXHX-ROUTE-QUERY-CODEC-0003", 'Query codec "${codec.name}" encode must have exact signature encode(value:$valueName):String.',
					encode.pos);
		}
	}

	static function scalarEncoding(type:Type, position:Position):QueryValueEncoding {
		if (isString(type)) {
			return QueryValueEncoding.Text;
		}
		if (isStdAbstract(type, "Int")) {
			return QueryValueEncoding.Int32;
		}
		if (isStdAbstract(type, "Bool")) {
			return QueryValueEncoding.Boolean;
		}
		return switch resolveAliases(type) {
			case TAbstract(reference, _):
				final definition = reference.get();
				final codec = queryCodec(definition);
				if (codec != null) {
					validateCodec(codec, type);
					QueryValueEncoding.Custom(codec.name);
				} else if (isStringBacked(type, new Map<String, Bool>())) {
					QueryValueEncoding.Text;
				} else {
					fail("NXHX-ROUTE-QUERY-FIELD-0002",
						'Query values support String, Int, Bool, transitively string-backed abstracts, or domain abstracts with @:next.queryCodec; found ${typeName(type)}.',
						position);
					QueryValueEncoding.Text;
				}
			case _:
				fail("NXHX-ROUTE-QUERY-FIELD-0002",
					'Query values support String, Int, Bool, transitively string-backed abstracts, or domain abstracts with @:next.queryCodec; found ${typeName(type)}.',
					position);
				QueryValueEncoding.Text;
		};
	}

	static function cardinality(field:ClassField):{final cardinality:QueryFieldCardinality; final encoding:QueryValueEncoding;} {
		if (field.meta.has(":optional")) {
			return fail("NXHX-ROUTE-QUERY-FIELD-0002",
				'Query field "${field.name}" must be present in the Haxe shape; optional wire values use genes.ts.Undefinable<T>.', field.pos);
		}
		return switch resolveAliases(field.type) {
			case TAbstract(reference, [value]) if (reference.get().module == "genes.ts.Undefinable"
				&& reference.get().name == "Undefinable"):
				{cardinality: QueryFieldCardinality.Optional, encoding: scalarEncoding(value, field.pos)};
			case TInst(reference, [value]) if (reference.get().module == "Array" && reference.get().name == "Array"):
				{cardinality: QueryFieldCardinality.Repeated, encoding: scalarEncoding(value, field.pos)};
			case _:
				{cardinality: QueryFieldCardinality.Required, encoding: scalarEncoding(field.type, field.pos)};
		};
	}

	static function queryName(field:ClassField):String {
		final matches = field.meta.get().filter(entry -> entry.name == ":next.queryName");
		if (matches.length > 1) {
			return fail("NXHX-ROUTE-QUERY-FIELD-0002", 'Query field "${field.name}" may declare @:next.queryName at most once.', matches[1].pos);
		}
		final result = if (matches.length == 0) {
			field.name;
		} else {
			final entry = matches[0];
			if (entry.params.length != 1) {
				return fail("NXHX-ROUTE-QUERY-FIELD-0002", '@:next.queryName on field "${field.name}" requires one string literal.', entry.pos);
			}
			switch entry.params[0].expr {
				case EConst(CString(value, _)): value;
				case _: fail("NXHX-ROUTE-QUERY-FIELD-0002", '@:next.queryName on field "${field.name}" requires a compile-time string literal.',
						entry.params[0].pos);
			}
		};
		if (!~/^[A-Za-z][A-Za-z0-9._-]{0,127}$/.match(result)) {
			return fail("NXHX-ROUTE-QUERY-FIELD-0002",
				'Query name "$result" must begin with an ASCII letter and contain at most 128 letters, digits, dots, underscores, or hyphens.', field.pos);
		}
		return result;
	}

	static function schemaFields(queryType:Type, position:Position):Array<ClassField> {
		return switch resolveAliases(queryType) {
			case TAnonymous(reference): reference.get().fields.copy();
			case TInst(reference, parameters):
				final definition = reference.get();
				if (parameters.length != 0 || definition.params.length != 0 || !definition.meta.has(":structInit")) {
					fail("NXHX-ROUTE-QUERY-SCHEMA-0001",
						'Query schema must be an anonymous typedef or non-generic @:structInit class; found ${typeName(queryType)}.', position);
				}
				definition.fields.get().filter(field -> switch field.kind {
					case FVar(_, _): true;
					case _: false;
				});
			case _:
				fail("NXHX-ROUTE-QUERY-SCHEMA-0001",
					'Query schema must be an anonymous typedef or non-generic @:structInit class; found ${typeName(queryType)}.', position);
				[];
		};
	}

	/** Resolves the one type path supplied by a page-level `@:next.query`. */
	public static function fromMetadata(owner:ClassType, entry:MetadataEntry):QuerySchemaValidation {
		if (entry.params.length != 1) {
			return fail("NXHX-ROUTE-QUERY-SCHEMA-0001", '@:next.query on ${fullTypeName(owner)} requires exactly one query-schema type path.', entry.pos);
		}
		final requested = metadataTypePath(entry.params[0], "NXHX-ROUTE-QUERY-SCHEMA-0001", "@:next.query");
		final qualified = requested.indexOf(".") == -1 ? owner.pack.concat([requested]).join(".") : requested;
		return validate(Context.getType(qualified), entry.pos);
	}

	/** Validates one named query type and returns bindings in canonical key order. */
	public static function validate(queryType:Type, position:Position):QuerySchemaValidation {
		final fields = schemaFields(queryType, position);
		if (fields.length == 0 || fields.length > 128) {
			return fail("NXHX-ROUTE-QUERY-SCHEMA-0001", 'Query schema ${typeName(queryType)} must expose between one and 128 fields.', position);
		}
		final bindings:Array<QueryFieldBinding> = [];
		final names = new Map<String, ClassField>();
		for (field in fields) {
			if (!field.isPublic || !field.isFinal) {
				return fail("NXHX-ROUTE-QUERY-FIELD-0002", 'Query field "${field.name}" must be public and read-only.', field.pos);
			}
			final name = queryName(field);
			final previous = names.get(name);
			if (previous != null) {
				return fail("NXHX-ROUTE-QUERY-FIELD-0002", 'Query name "$name" is assigned by both "${previous.name}" and "${field.name}".', field.pos);
			}
			names.set(name, field);
			final value = cardinality(field);
			bindings.push(new QueryFieldBinding(field.name, name, value.cardinality, value.encoding, field.pos));
		}
		bindings.sort((left, right) -> compareString(left.queryName, right.queryName));
		return new QuerySchemaValidation(queryType, bindings);
	}
	#end
}
