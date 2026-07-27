package nextjshx.client;

#if macro
import haxe.crypto.Sha256;
import haxe.io.Path;
import haxe.macro.Context;
import haxe.macro.Expr;
import haxe.macro.Type.ClassType;
import nextjshx.adapter.AdapterExport;
import nextjshx.adapter.AdapterExport.AdapterExportKind;
import nextjshx.adapter.AdapterImplementation;
import nextjshx.adapter.AdapterImport;
import nextjshx.adapter.AdapterKind;
import nextjshx.adapter.AdapterPlanRegistry;

using Lambda;
#end

/** Validates explicit Haxe Hook exports and records directive-first adapters. */
class ReactHookExportMacro {
	#if macro
	static inline final HOOK_METADATA = ":next.hook";
	static inline final EXPORT_METADATA = ":next.exportHook";

	static function fail<T>(code:String, message:String, position:Position):T {
		return Context.fatalError('[$code] $message', position);
	}

	static function hasAccess(field:Field, access:Access):Bool {
		return field.access != null && field.access.contains(access);
	}

	static function metadata(field:Field, name:String):Array<MetadataEntry> {
		return field.meta == null ? [] : field.meta.filter(entry -> entry.name == name);
	}

	static function adapterPath(type:ClassType, field:Field):String {
		final identity = '${ClientComponentMacro.fullTypeName(type)}\x00${field.name}\x00${field.name}';
		final digest = Sha256.encode(identity).substr(0, 12);
		return '_nextjshx/hook/$digest/${field.name}';
	}

	static function validate(type:ClassType, field:Field, entry:MetadataEntry):Void {
		final label = '${ClientComponentMacro.fullTypeName(type)}.${field.name}';
		if (entry.params.length != 0) {
			fail("NXHX-REACT-EXPORT-0002",
				'@:next.exportHook on $label does not accept arguments; its collision-resistant adapter path and public name are derived from the typed Hook identity.',
				entry.pos);
		}
		final hooks = metadata(field, HOOK_METADATA);
		if (hooks.length != 1) {
			fail("NXHX-REACT-EXPORT-0002", '$label must declare exactly one @:next.hook before it can be exported as a React Hook.', entry.pos);
		}
		if (!hasAccess(field, APublic) || !hasAccess(field, AStatic)) {
			fail("NXHX-REACT-EXPORT-0002", '$label must be a public static Haxe-authored Hook.', entry.pos);
		}
		if (!~/^use(?:$|[A-Z0-9])/.match(field.name)) {
			fail("NXHX-REACT-EXPORT-0002", '$label must retain React\'s use-prefixed public Hook naming convention.', entry.pos);
		}
		switch field.kind {
			case FFun(method) if (method.expr != null):
			case FFun(_):
				fail("NXHX-REACT-EXPORT-0002",
					'$label must have a Haxe implementation; use a precise extern without @:next.exportHook to consume a native TypeScript Hook.', field.pos);
			case _:
				fail("NXHX-REACT-EXPORT-0002", '$label must be a function.', field.pos);
		}
	}

	public static function process(type:ClassType, fields:Array<Field>):Void {
		for (field in fields) {
			final exports = metadata(field, EXPORT_METADATA);
			if (exports.length == 0) {
				continue;
			}
			if (exports.length != 1) {
				fail("NXHX-REACT-EXPORT-0002", '${ClientComponentMacro.fullTypeName(type)}.${field.name} must declare @:next.exportHook exactly once.',
					exports[1].pos);
			}
			final entry = exports[0];
			validate(type, field, entry);
			if (type.isExtern || type.isInterface || type.params.length != 0) {
				fail("NXHX-REACT-EXPORT-0002", 'Exported Hook owner ${ClientComponentMacro.fullTypeName(type)} must be a concrete non-generic Haxe class.',
					type.pos);
			}
			if (!type.meta.has(":keep")) {
				type.meta.add(":keep", [], entry.pos);
			}
			final path = adapterPath(type, field);
			final implementationModule = ClientComponentMacro.implementationModule(type, path, entry.pos);
			AdapterPlanRegistry.register({
				kind: AdapterKind.ReactHook,
				sourceType: ClientComponentMacro.fullTypeName(type),
				sourceField: field.name,
				typePosition: type.pos,
				fieldPosition: field.pos,
				metadataPosition: entry.pos,
				segmentPath: Path.directory(path),
				targetPath: path + ".ts",
				implementation: new AdapterImplementation(implementationModule, type.name),
				imports: [new AdapterImport(implementationModule, type.name)],
				directives: ["use client"],
				exports: [
					new AdapterExport(AdapterExportKind.Named, field.name, field.name, 'typeof ${type.name}.${field.name}')
				],
				config: []
			});
		}
	}
	#end
}
