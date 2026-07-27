package nextjshx.app;

#if macro
import haxe.macro.Context;
import haxe.macro.Expr;
import nextjshx.adapter.AdapterConfig;
import nextjshx.adapter.AdapterConfig.AdapterConfigValue;
import nextjshx.cache.CacheDirectiveMacro;

using StringTools;

/** Parses the compile-time-only `SegmentConfig.create({...})` declaration. */
class SegmentConfigMacro {
	static final SUPPORTED_FIELDS = ["runtime", "preferredRegion", "dynamicParams", "revalidate", "maxDuration"];

	static function fail<T>(message:String, position:Position):T {
		return Context.fatalError('[NXHX-SEGMENT-CONFIG-0001] $message', position);
	}

	static function expressionPath(value:Expr):Null<Array<String>> {
		return switch value.expr {
			case EConst(CIdent(name)): [name];
			case EField(target, name):
				final prefix = expressionPath(target);
				prefix == null ? null : prefix.concat([name]);
			case EParenthesis(inner): expressionPath(inner);
			case EMeta(_, inner): expressionPath(inner);
			case _: null;
		};
	}

	static function isCreateCall(value:Expr):Null<Expr> {
		return switch value.expr {
			case ECall(callee, [options]):
				final path = expressionPath(callee);
				final qualified = path == null ? "" : path.join(".");
				if (qualified == "SegmentConfig.create" || qualified == "nextjs.app.SegmentConfig.create") {
					options;
				} else {
					null;
				}
			case EParenthesis(inner): isCreateCall(inner);
			case EMeta(_, inner): isCreateCall(inner);
			case _: null;
		};
	}

	static function stringLiteral(value:Expr, label:String):String {
		final result = switch value.expr {
			case EConst(CString(text, _)): text;
			case _: return fail('$label must be a compile-time string literal.', value.pos);
		};
		if (result.length == 0 || result.length > 128 || result != result.trim()) {
			return fail('$label must be a non-empty, trimmed string of at most 128 characters.', value.pos);
		}
		for (index in 0...result.length) {
			final code = StringTools.fastCodeAt(result, index);
			if (code < 32 || code == 127) {
				return fail('$label must not contain control characters.', value.pos);
			}
		}
		return result;
	}

	static function integerLiteral(value:Expr, label:String):Int {
		final encoded = switch value.expr {
			case EConst(CInt(text, _)): text;
			case _: return fail('$label must be a compile-time decimal integer literal.', value.pos);
		};
		if (!~/^[0-9](?:[0-9_]*[0-9])?$/.match(encoded)) {
			return fail('$label must be a compile-time decimal integer literal.', value.pos);
		}
		final parsed = Std.parseInt(encoded.split("_").join(""));
		return parsed == null ? fail('$label is outside Haxe Int range.', value.pos) : parsed;
	}

	static function booleanLiteral(value:Expr, label:String):Bool {
		return switch value.expr {
			case EConst(CIdent("true")): true;
			case EConst(CIdent("false")): false;
			case _: fail('$label must be the compile-time literal true or false.', value.pos);
		};
	}

	static function runtimeValue(value:Expr):AdapterConfigValue {
		final runtime = switch value.expr {
			case EConst(CString(text, _)): text;
			case _:
				final path = expressionPath(value);
				final qualified = path == null ? "" : path.join(".");
				switch qualified {
					case "SegmentRuntime.NodeJs" | "nextjs.app.SegmentRuntime.NodeJs": "nodejs";
					case "SegmentRuntime.Edge" | "nextjs.app.SegmentRuntime.Edge": "edge";
					case _: return fail('segment.runtime must be SegmentRuntime.NodeJs, SegmentRuntime.Edge, "nodejs", or "edge".', value.pos);
				}
		};
		return switch runtime {
			case "nodejs" | "edge": StringValue(runtime);
			case _:
				fail('segment.runtime "$runtime" is not stable in Next 16.2.12; use "nodejs" or "edge".', value.pos);
		};
	}

	static function regionValue(value:Expr):AdapterConfigValue {
		return switch value.expr {
			case EArrayDecl(entries):
				if (entries.length == 0) {
					return fail("segment.preferredRegion must not be an empty array.", value.pos);
				}
				final regions:Array<String> = [];
				final seen = new Map<String, Bool>();
				for (entry in entries) {
					final region = stringLiteral(entry, "Each segment.preferredRegion entry");
					if (seen.exists(region)) {
						return fail('segment.preferredRegion repeats region "$region".', entry.pos);
					}
					seen.set(region, true);
					regions.push(region);
				}
				StringArrayValue(regions);
			case _:
				StringValue(stringLiteral(value, "segment.preferredRegion"));
		};
	}

	static function revalidateValue(value:Expr):AdapterConfigValue {
		return switch value.expr {
			case EConst(CIdent("false")): BooleanValue(false);
			case EConst(CIdent("true")):
				fail("segment.revalidate accepts false or a non-negative integer number of seconds; true has no Next.js meaning.", value.pos);
			case _:
				final seconds = integerLiteral(value, "segment.revalidate");
				if (seconds < 0) {
					return fail("segment.revalidate must be false or a non-negative integer number of seconds.", value.pos);
				}
				IntegerValue(seconds);
		};
	}

	static function configValue(name:String, value:Expr):AdapterConfigValue {
		if (Context.defined(CacheDirectiveMacro.CACHE_COMPONENTS_DEFINE)) {
			switch name {
				case "dynamicParams":
					return
						Context.fatalError("[NXHX-SEGMENT-CACHE-COMPONENTS-0002] segment.dynamicParams is not compatible with Cache Components in Next 16.2.12. Remove it; Cache Components owns dynamic route behavior and Next retains normal dynamic-parameter behavior without this export.",
						value.pos);
				case "revalidate":
					return
						Context.fatalError("[NXHX-SEGMENT-CACHE-COMPONENTS-0002] segment.revalidate is not compatible with Cache Components in Next 16.2.12. Remove it; use cacheLife inside cached scopes and native tag or path invalidation at mutation boundaries.",
						value.pos);
				case _:
			}
		}
		return switch name {
			case "runtime": runtimeValue(value);
			case "preferredRegion": regionValue(value);
			case "dynamicParams": BooleanValue(booleanLiteral(value, "segment.dynamicParams"));
			case "revalidate": revalidateValue(value);
			case "maxDuration":
				final seconds = integerLiteral(value, "segment.maxDuration");
				if (seconds <= 0) {
					return fail("segment.maxDuration must be a positive integer number of seconds.", value.pos);
				}
				IntegerValue(seconds);
			case _:
				fail('Unsupported segment config field "$name"; supported stable Next 16.2.12 fields are ${SUPPORTED_FIELDS.join(", ")}.', value.pos);
		};
	}

	/** Validates one declaration field and returns literal-only adapter config. */
	public static function parse(field:Field, owner:String):Array<AdapterConfig> {
		if (field.access == null
			|| !field.access.contains(APublic)
			|| !field.access.contains(AStatic)
			|| !field.access.contains(AFinal)) {
			return fail('$owner.segment must be public static final so the compile-time config cannot be mutated or instantiated.', field.pos);
		}
		final initializer = switch field.kind {
			case FVar(_, value) if (value != null): value;
			case _:
				return fail('$owner.segment must be a field initialized directly with SegmentConfig.create({...}).', field.pos);
		};
		final options = isCreateCall(initializer);
		if (options == null) {
			return fail('$owner.segment must be initialized directly with SegmentConfig.create({...}); expressions and runtime builders are not evaluated.',
				initializer.pos);
		}
		final entries = switch options.expr {
			case EObjectDecl(values): values;
			case _: return fail("SegmentConfig.create requires one inline object literal.", options.pos);
		};
		if (entries.length == 0) {
			return fail("SegmentConfig.create requires at least one supported field.", options.pos);
		}
		final result:Array<AdapterConfig> = [];
		final seen = new Map<String, Bool>();
		for (entry in entries) {
			if (seen.exists(entry.field)) {
				return fail('SegmentConfig.create repeats field "${entry.field}".', entry.expr.pos);
			}
			seen.set(entry.field, true);
			result.push(new AdapterConfig(entry.field, configValue(entry.field, entry.expr)));
		}
		return result;
	}

	/** Fails if the compile-time marker escapes an annotated page or layout. */
	public static function rejectStandalone(value:Expr):Expr {
		return
			fail("SegmentConfig.create is compile-time-only and must initialize the public static final segment field of an @:next.page or @:next.layout declaration.",
			value.pos);
	}
}
#end
