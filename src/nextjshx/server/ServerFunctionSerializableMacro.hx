package nextjshx.server;

#if macro
import haxe.macro.Context;
import haxe.macro.Expr.Position;
import haxe.macro.Type;

using haxe.macro.TypeTools;
#end

/** Conservative native Server Function argument/result validation. */
class ServerFunctionSerializableMacro {
	#if macro
	static function fail(message:String, position:Position):Void {
		Context.fatalError('[NXHX-SERVER-FUNCTION-SERIALIZABLE-0005] $message', position);
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
			case TAnonymous(_): "anonymous";
			case TFun(_, _): "function";
			case TDynamic(_): "dynamic";
			case TMono(reference):
				final value = reference.get();
				value == null ? "monomorph" : typeIdentity(value);
			case TLazy(resolve): typeIdentity(resolve());
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

	static function isVoid(type:Type):Bool {
		return switch type {
			case TAbstract(reference, parameters): final value = reference.get(); value.module == "StdTypes" && value.name == "Void" && parameters.length == 0;
			case TType(reference, parameters):
				final value = reference.get();
				isVoid(value.type.applyTypeParameters(value.params, parameters));
			case TMono(reference): final value = reference.get(); value != null && isVoid(value);
			case TLazy(resolve): isVoid(resolve());
			case _: false;
		};
	}

	static function isWebFormData(type:Type):Bool {
		return switch type {
			case TInst(reference, parameters): final value = reference.get(); value.module == "nextjs.raw.server.WebFormData" && value.name == "WebFormData" && parameters.length == 0;
			case TType(reference, parameters):
				final value = reference.get();
				isWebFormData(value.type.applyTypeParameters(value.params, parameters));
			case TMono(reference): final value = reference.get(); value != null && isWebFormData(value);
			case TLazy(resolve): isWebFormData(resolve());
			case _: false;
		};
	}

	static function pathField(path:String, name:String):String {
		return path == "" ? name : '$path.$name';
	}

	static function reject(path:String, type:Type, reason:String, position:Position):Void {
		fail('$path is not a supported native Server Function value: $reason Found ${type.toString()}. Use primitives, arrays, plain immutable records, string/number abstracts, and top-level WebFormData action input.',
			position);
	}

	static function visit(type:Type, path:String, active:Array<String>, allowVoid:Bool, allowRootFormData:Bool, root:Bool, position:Position):Void {
		if (isPrimitive(type) || (allowVoid && isVoid(type)) || (allowRootFormData && root && isWebFormData(type))) {
			return;
		}

		switch type {
			case TMono(reference):
				final value = reference.get();
				if (value == null) {
					reject(path, type, "the type is not concrete at the action boundary.", position);
				}
				visit(value, path, active, allowVoid, allowRootFormData, root, position);
			case TLazy(resolve):
				visit(resolve(), path, active, allowVoid, allowRootFormData, root, position);
			case TType(reference, parameters):
				final definition = reference.get();
				final identity = typeIdentity(type);
				if (active.contains(identity)) {
					reject(path, type, "recursive or cyclic value graphs are rejected conservatively.", position);
				}
				active.push(identity);
				visit(definition.type.applyTypeParameters(definition.params, parameters), path, active, allowVoid, allowRootFormData, root, position);
				active.pop();
			case TAbstract(reference, parameters):
				final definition = reference.get();
				if (definition.module == "StdTypes" && definition.name == "Null" && parameters.length == 1) {
					visit(parameters[0], path, active, false, false, false, position);
					return;
				}
				if (definition.module == "genes.ts.Undefinable" && definition.name == "Undefinable" && parameters.length == 1) {
					visit(parameters[0], path, active, false, false, false, position);
					return;
				}
				if (definition.name == "Any" || (definition.module == "genes.ts.Unknown" && definition.name == "Unknown")) {
					reject(path, type, "broad values must be decoded before crossing the action boundary.", position);
				}
				final underlying = definition.type.applyTypeParameters(definition.params, parameters);
				if (!isPrimitive(underlying)) {
					reject(path, type, "only abstracts whose runtime representation is a string, number, or boolean are allowed.", position);
				}
			case TInst(reference, parameters):
				final definition = reference.get();
				if (definition.module == "Array" && parameters.length == 1) {
					visit(parameters[0], path + "[]", active, false, false, false, position);
					return;
				}
				if (isWebFormData(type)) {
					reject(path, type, "WebFormData is accepted only as a top-level action argument, not as a nested value or result.", position);
				}
				reject(path, type, "class instances and runtime containers do not have a stable native action encoding.", position);
			case TAnonymous(reference):
				for (field in reference.get().fields) {
					visit(field.type, pathField(path, field.name), active, false, false, false, field.pos);
				}
			case TFun(_, _):
				reject(path, type, "functions cannot be nested inside Server Function arguments or results.", position);
			case TEnum(_, _):
				reject(path, type, "runtime Haxe enum instances are not plain records; use a string or number enum abstract.", position);
			case TDynamic(_):
				reject(path, type, "a broad dynamic value must be decoded into a closed model first.", position);
		}
	}

	/** Validates one action argument; native FormData is allowed only at its root. */
	public static function validateArgument(type:Type, root:String, position:Position):Void {
		visit(type, root, [], false, true, true, position);
	}

	/** Validates the awaited action result, including `Void`. */
	public static function validateResult(type:Type, root:String, position:Position):Void {
		visit(type, root, [], true, false, true, position);
	}
	#end
}
