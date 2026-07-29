package nextjshx.boundary;

#if macro
import haxe.macro.Context;
import haxe.macro.Expr;
import haxe.macro.Type;
import nextjshx.boundary.ReactSerializableMacro.validate;

using haxe.macro.TypeTools;
using Lambda;
#end

/** Validates creation of one module-stable React 19 Flight Promise. */
class FlightPromiseMacro {
	#if macro
	static function fail<T>(message:String, position:Position):T {
		return Context.fatalError('[NXHX-FLIGHT-PROMISE-0001] $message', position);
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

	public static function module(value:Expr):Expr {
		final localMethod = Context.getLocalMethod();
		final ownerReference = Context.getLocalClass();
		if (ownerReference == null || !ownerReference.get().meta.has(":next.serverOnly")) {
			return fail("FlightResource.promise(...) requires an explicit @:next.serverOnly owner so the Promise factory cannot enter the client graph.",
				value.pos);
		}
		final moduleField = localMethod == null ? null : ownerReference.get().statics.get().find(field -> field.name == localMethod);
		final isFinalStaticField = moduleField != null && switch moduleField.kind {
			case FVar(_, AccNever): true;
			case _: false;
		};
		if (!isFinalStaticField) {
			final location = localMethod == null ? "an expression scope" : '"$localMethod"';
			return
				fail('FlightResource.promise(...) must initialize one static final field, but it was called inside $location. Create the Promise once on an @:next.serverOnly provider and pass that capability to the Client Component.',
				value.pos);
		}
		final resolved = switch resolveAliases(Context.typeof(value)) {
			case TInst(reference, [result]) if (reference.get().module == "js.lib.Promise" && reference.get().name == "Promise"):
				result;
			case type:
				return fail('FlightResource.promise(...) requires js.lib.Promise<T>; found ${type.toString()}.', value.pos);
		};
		validate(resolved, "resolved", value.pos);
		final resultType = resolved.toComplexType();
		if (resultType == null) {
			return fail("FlightResource.promise(...) could not preserve the resolved value's exact Haxe type.", value.pos);
		}
		final capability:TypePath = {
			pack: ["nextjs", "client", "flight", "v19"],
			name: "FlightPromise",
			params: [TPType(resultType)]
		};
		final created = {expr: ENew(capability, [value]), pos: value.pos};
		return {
			expr: EMeta({name: ":privateAccess", params: [], pos: value.pos}, created),
			pos: value.pos
		};
	}
	#end
}
