package nextjshx.boundary;

#if macro
import haxe.macro.Context;
import haxe.macro.Expr.Position;
import haxe.macro.Type;
import haxe.macro.Type.DefType;

using haxe.macro.TypeTools;
#end

/** Conservative React Server-to-Client value validation shared by boundary macros. */
class ReactSerializableMacro {
	#if macro
	static inline final FLIGHT_V19_PACKAGE:String = "nextjs.client.flight.v19";
	static final FLIGHT_V19_SCALARS = [
		"FlightDate",
		"FlightArrayBuffer",
		"FlightInt8Array",
		"FlightInt16Array",
		"FlightInt32Array",
		"FlightUint8Array",
		"FlightUint8ClampedArray",
		"FlightUint16Array",
		"FlightUint32Array",
		"FlightFloat32Array",
		"FlightFloat64Array"
	];

	static function fail(message:String, position:Position):Void {
		Context.fatalError('[NXHX-SERIALIZABLE-PROP-0001] $message', position);
	}

	static function typeIdentity(type:Type):String {
		return switch type {
			case TInst(reference, parameters):
				final value = reference.get();
				'${value.module}.${value.name}<${parameters.map(typeIdentity).join(",")}>';
			case TEnum(reference, parameters):
				final value = reference.get();
				'${value.module}.${value.name}<${parameters.map(typeIdentity).join(",")}>';
			case TType(reference, parameters):
				final value = reference.get();
				'${value.module}.${value.name}<${parameters.map(typeIdentity).join(",")}>';
			case TAbstract(reference, parameters):
				final value = reference.get();
				'${value.module}.${value.name}<${parameters.map(typeIdentity).join(",")}>';
			case TAnonymous(reference):
				"anonymous";
			case TFun(_, _): "function";
			case TDynamic(_): "dynamic";
			case TMono(reference):
				final value = reference.get();
				value == null ? "monomorph" : typeIdentity(value);
			case TLazy(resolve): typeIdentity(resolve());
		};
	}

	static function isNamed(type:Type, module:String, name:String):Bool {
		return switch type {
			case TType(reference, parameters): final value = reference.get(); (value.module == module && value.name == name && parameters.length == 0) || isNamed(value.type.applyTypeParameters(value.params,
					parameters), module, name);
			case TAbstract(reference, parameters): final value = reference.get(); value.module == module && value.name == name && parameters.length == 0;
			case TInst(reference, parameters): final value = reference.get(); value.module == module && value.name == name && parameters.length == 0;
			case TMono(reference): final value = reference.get(); value != null && isNamed(value, module, name);
			case TLazy(resolve): isNamed(resolve(), module, name);
			case _: false;
		};
	}

	static function isPrimitive(type:Type):Bool {
		return switch type {
			case TInst(reference, parameters): final value = reference.get(); value.module == "String" && value.name == "String" && parameters.length == 0;
			case TAbstract(reference, parameters): final value = reference.get(); value.module == "StdTypes" && ["Bool", "Int", "Float"].contains(value.name) && parameters.length == 0;
			case TType(reference, parameters):
				final value = reference.get();
				isPrimitive(value.type.applyTypeParameters(value.params, parameters));
			case TMono(reference): final value = reference.get(); value != null && isPrimitive(value);
			case TLazy(resolve): isPrimitive(resolve());
			case _: false;
		};
	}

	static function pathField(path:String, name:String):String {
		return path == "" ? name : '$path.$name';
	}

	static function reject(path:String, type:Type, reason:String, position:Position):Void {
		fail('$path is not a supported React boundary value: $reason Found ${type.toString()}. Use primitives, arrays, plain immutable records, ReactNode composition, or an exact nextjs.client.flight.v19 capability.',
			position);
	}

	static function isFlightV19Typedef(type:DefType, name:String, parameters:Array<Type>, arity:Int):Bool {
		return type.pack.join(".") == FLIGHT_V19_PACKAGE
			&& type.module == '$FLIGHT_V19_PACKAGE.$name'
			&& type.name == name
			&& parameters.length == arity;
	}

	static function visit(type:Type, path:String, active:Array<String>, position:Position):Void {
		if (isPrimitive(type) || isNamed(type, "nextjs.raw.react.ReactNode", "ReactNode")) {
			return;
		}

		switch type {
			case TMono(reference):
				final value = reference.get();
				if (value == null) {
					reject(path, type, "the type is not concrete at the boundary.", position);
				}
				visit(value, path, active, position);
			case TLazy(resolve):
				visit(resolve(), path, active, position);
			case TType(reference, parameters):
				final definition = reference.get();
				if (FLIGHT_V19_SCALARS.contains(definition.name) && isFlightV19Typedef(definition, definition.name, parameters, 0)) {
					return;
				}
				if (isFlightV19Typedef(definition, "FlightSet", parameters, 1)) {
					visit(parameters[0], path + ".values[]", active, position);
					return;
				}
				if (isFlightV19Typedef(definition, "FlightPromise", parameters, 1)) {
					visit(parameters[0], path + ".resolved", active, position);
					return;
				}
				final identity = typeIdentity(type);
				if (active.contains(identity)) {
					reject(path, type, "recursive or cyclic value graphs are rejected conservatively.", position);
				}
				active.push(identity);
				visit(definition.type.applyTypeParameters(definition.params, parameters), path, active, position);
				active.pop();
			case TAbstract(reference, parameters):
				final definition = reference.get();
				if (definition.pack.join(".") == FLIGHT_V19_PACKAGE
					&& definition.module == '$FLIGHT_V19_PACKAGE.FlightGlobalSymbol'
					&& definition.name == "FlightGlobalSymbol"
					&& parameters.length == 0) {
					return;
				}
				if (definition.pack.join(".") == FLIGHT_V19_PACKAGE
					&& definition.module == '$FLIGHT_V19_PACKAGE.FlightServerFunction'
					&& definition.name == "FlightServerFunction"
					&& parameters.length == 1) {
					return;
				}
				if (definition.pack.join(".") == FLIGHT_V19_PACKAGE
					&& definition.module == '$FLIGHT_V19_PACKAGE.FlightPromise'
					&& definition.name == "FlightPromise"
					&& parameters.length == 1) {
					visit(parameters[0], path + ".resolved", active, position);
					return;
				}
				if (definition.module == "StdTypes" && definition.name == "Null" && parameters.length == 1) {
					visit(parameters[0], path, active, position);
					return;
				}
				if (definition.module == "genes.ts.Undefinable" && definition.name == "Undefinable" && parameters.length == 1) {
					visit(parameters[0], path, active, position);
					return;
				}
				if (definition.name == "Any" || (definition.module == "genes.ts.Unknown" && definition.name == "Unknown")) {
					reject(path, type, "broad external-boundary values must be decoded before crossing into a Client Component.", position);
				}
				final underlying = definition.type.applyTypeParameters(definition.params, parameters);
				if (!isPrimitive(underlying)) {
					reject(path, type, "only abstracts whose runtime representation is a string, number, or boolean are allowed.", position);
				}
			case TInst(reference, parameters):
				final definition = reference.get();
				if (definition.pack.join(".") == FLIGHT_V19_PACKAGE
					&& definition.module == '$FLIGHT_V19_PACKAGE.FlightMap'
					&& definition.name == "FlightMap"
					&& parameters.length == 2) {
					visit(parameters[0], path + ".keys[]", active, position);
					visit(parameters[1], path + ".values[]", active, position);
					return;
				}
				if (definition.module == "Array" && parameters.length == 1) {
					visit(parameters[0], path + "[]", active, position);
					return;
				}
				if (definition.module == "nextjs.client.CachedPromise" && definition.name == "CachedPromise" && parameters.length == 1) {
					visit(parameters[0], path + ".resolved", active, position);
					return;
				}
				if (definition.module == "js.lib.Promise" && definition.name == "Promise") {
					reject(path, type,
						"an ordinary Promise does not prove server ownership or stable React identity; use FlightPromise from a reviewed server-owned provider.",
						position);
				}
				if (definition.module == "js.lib.Symbol" && definition.name == "Symbol") {
					reject(path, type,
						"a raw symbol does not prove global-registry provenance; create FlightGlobalSymbol with FlightGlobalSymbol.forKey(...).", position);
				}
				reject(path, type, "class instances and runtime containers do not have a stable plain-value encoding.", position);
			case TAnonymous(reference):
				for (field in reference.get().fields) {
					visit(field.type, pathField(path, field.name), active, field.pos);
				}
			case TFun(_, _):
				reject(path, type,
					"ordinary functions cannot cross the Server-to-Client boundary; use a generated Server Function ref when that feature is intended.",
					position);
			case TEnum(_, _):
				reject(path, type, "runtime Haxe enum instances are not treated as plain records; use a string or number enum abstract.", position);
			case TDynamic(_):
				reject(path, type, "a broad dynamic value must be decoded into a closed model first.", position);
		}
	}

	/** Validates one already-resolved props type and reports the exact field path. */
	public static function validate(type:Type, root:String, position:Position):Void {
		visit(type, root, [], position);
	}
	#end
}
