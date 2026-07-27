package nextjshx.client;

#if macro
import haxe.macro.Compiler;
import haxe.macro.Context;
import haxe.macro.Expr;
import haxe.macro.Type.ClassType;

using Lambda;
#end

/** Adds framework-neutral compiler metadata to reviewed Haxe React bodies. */
class ReactAnalyzerFunctionMacro {
	#if macro
	static inline final CLIENT_COMPONENT_METADATA = ":next.clientComponent";
	static inline final HOOK_METADATA = ":next.hook";
	static inline final MODULE_FUNCTION_METADATA = ":genes.moduleFunction";
	static var installed:Bool = false;

	static function fail<T>(code:String, message:String, position:Position):T {
		return Context.fatalError('[$code] $message', position);
	}

	static function fullTypeName(type:ClassType):String {
		final primaryTypeName = type.pack.concat([type.name]).join(".");
		return type.module == primaryTypeName ? primaryTypeName : '${type.module}.${type.name}';
	}

	static function hasAccess(field:Field, access:Access):Bool {
		return field.access != null && field.access.contains(access);
	}

	/**
	 * Makes a reviewed React body visible to ordinary JavaScript analyzers.
	 *
	 * The marker is compiler plumbing, not application-facing ceremony:
	 * genes-ts moves the typed body to one genuine module function while keeping
	 * the static Haxe method as the same callable value. NextJsHx supplies the
	 * React-significant name because it owns Hook and component semantics.
	 */
	static function markModuleFunction(field:Field, emittedName:String, position:Position):Void {
		final metadata = field.meta == null ? [] : field.meta;
		if (metadata.exists(entry -> entry.name == MODULE_FUNCTION_METADATA)) {
			fail("NXHX-REACT-ANALYZER-0006",
				'${field.name} must not declare @:genes.moduleFunction directly; NextJsHx derives the analyzer-visible React function name.', position);
		}
		metadata.push({
			name: MODULE_FUNCTION_METADATA,
			params: [{expr: EConst(CString(emittedName, DoubleQuotes)), pos: position}],
			pos: position
		});
		field.meta = metadata;
	}

	static function markHaxeHooks(type:ClassType, fields:Array<Field>):Void {
		if (type.isExtern || type.isInterface) {
			return;
		}
		for (field in fields) {
			final metadata = field.meta == null ? [] : field.meta;
			if (!metadata.exists(entry -> entry.name == HOOK_METADATA)) {
				continue;
			}
			switch field.kind {
				case FFun(method) if (method.expr != null):
					if (!hasAccess(field, APublic) || !hasAccess(field, AStatic)) {
						fail("NXHX-REACT-ANALYZER-0006",
							'Haxe-authored Hook ${fullTypeName(type)}.${field.name} must be public static so its checked body can be emitted as an analyzer-visible module function.',
							field.pos);
					}
					markModuleFunction(field, field.name, field.pos);
				case _:
			}
		}
	}

	static function markClientRender(type:ClassType, fields:Array<Field>):Void {
		if (type.isExtern || type.isInterface || !type.meta.has(CLIENT_COMPONENT_METADATA)) {
			return;
		}
		final renders = fields.filter(field -> field.name == "render");
		if (renders.length != 1) {
			return;
		}
		final render = renders[0];
		switch render.kind {
			case FFun(method) if (method.expr != null && hasAccess(render, APublic) && hasAccess(render, AStatic)):
				markModuleFunction(render, type.name + "Component", render.pos);
			case _:
		}
	}

	public static function install():Void {
		if (installed) {
			return;
		}
		installed = true;
		Compiler.addGlobalMetadata("", "@:build(nextjshx.client.ReactAnalyzerFunctionMacro.build())", true, true, false);
	}

	public static function build():Array<Field> {
		final fields = Context.getBuildFields();
		final localClass = Context.getLocalClass();
		if (localClass == null) {
			return fields;
		}
		final type = localClass.get();
		markHaxeHooks(type, fields);
		markClientRender(type, fields);
		return fields;
	}
	#end
}
