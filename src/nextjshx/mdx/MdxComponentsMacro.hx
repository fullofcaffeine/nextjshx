package nextjshx.mdx;

#if macro
import haxe.macro.Compiler;
import haxe.macro.Context;
import haxe.macro.Expr;
import haxe.macro.Type;
import haxe.macro.Type.ClassType;
import haxe.macro.Type.ModuleType;
import haxe.macro.TypedExprTools;
import nextjshx.adapter.AdapterExport;
import nextjshx.adapter.AdapterExport.AdapterExportKind;
import nextjshx.adapter.AdapterImplementation;
import nextjshx.adapter.AdapterImport;
import nextjshx.adapter.AdapterKind;
import nextjshx.adapter.AdapterPlanRegistry;

using haxe.macro.TypeTools;
using Lambda;
using StringTools;
#end

/**
 * Validates one closed Haxe MDX component registry and publishes its convention
 * adapter intent.
 *
 * The generated `mdx-components.tsx` remains an ordinary Next.js convention
 * module. This macro adds no content runtime and never evaluates MDX.
 */
class MdxComponentsMacro {
	#if macro
	static inline final METADATA = ":next.mdxComponents";
	static inline final APP_ROOT_DEFINE = "nextjshx.app-root";
	static inline final GENERATED_ROOT_DEFINE = "nextjshx.generated-root";
	static final BOUNDARY_METADATA = [
		":next.page",
		":next.layout",
		":next.route",
		":next.loading",
		":next.error",
		":next.notFound",
		":next.default",
		":next.clientComponent",
		":next.serverFunctions",
		":next.proxy",
		METADATA
	];
	static var installed:Bool = false;

	static function fail<T>(code:String, message:String, position:Position):T {
		return Context.fatalError('[$code] $message', position);
	}

	static function fullTypeName(type:ClassType):String {
		final primary = type.pack.concat([type.name]).join(".");
		return type.module == primary ? primary : '${type.module}.${type.name}';
	}

	static function hasAccess(field:Field, access:Access):Bool {
		return field.access != null && field.access.contains(access);
	}

	static function metadata(type:ClassType):Null<MetadataEntry> {
		final values = type.meta.get().filter(entry -> entry.name == METADATA);
		if (values.length == 0) {
			return null;
		}
		if (values.length != 1 || values[0].params.length != 0) {
			final position = values.length > 1 ? values[1].pos : values[0].pos;
			return fail("NXHX-MDX-REGISTRY-0001", '@:next.mdxComponents on ${fullTypeName(type)} must appear once and accepts no arguments.', position);
		}
		final boundaries = type.meta.get().filter(entry -> BOUNDARY_METADATA.contains(entry.name));
		if (boundaries.length != 1) {
			return fail("NXHX-MDX-REGISTRY-0001",
				'${fullTypeName(type)} must declare only the MDX registry boundary; found ${boundaries.length} NextJsHx boundary annotations.', values[0].pos);
		}
		return values[0];
	}

	static function componentsField(type:ClassType, fields:Array<Field>):Field {
		final publicFields = fields.filter(field -> hasAccess(field, APublic));
		final matches = publicFields.filter(field -> field.name == "components");
		if (matches.length != 1 || publicFields.length != 1) {
			return fail("NXHX-MDX-COMPONENTS-0002",
				'MDX registry ${fullTypeName(type)} must expose exactly one public static components function; found ${publicFields.length} public fields and ${matches.length} components fields.',
				type.pos);
		}
		final field = matches[0];
		if (!hasAccess(field, AStatic)) {
			return fail("NXHX-MDX-COMPONENTS-0002", 'MDX registry ${fullTypeName(type)}.components must be static.', field.pos);
		}
		switch field.kind {
			case FFun(method) if (method.params.length == 0 && method.args.length == 0 && method.expr != null):
			case _:
				return fail("NXHX-MDX-COMPONENTS-0002",
					'MDX registry ${fullTypeName(type)}.components must be a concrete, non-generic, zero-argument function.', field.pos);
		}
		return field;
	}

	static function directRegistryFields(expression:Expr):Null<Array<ObjectField>> {
		return switch expression.expr {
			case EBlock([inner]) | EParenthesis(inner) | EMeta(_, inner):
				directRegistryFields(inner);
			case EReturn(value):
				value == null ? null : directRegistryFields(value);
			case EObjectDecl(fields):
				fields;
			case _:
				null;
		};
	}

	static function validateSourceRegistry(type:ClassType, field:Field):Void {
		final expression = switch field.kind {
			case FFun(method): method.expr;
			case _:
				null;
		}
		if (expression == null) {
			return fail("NXHX-MDX-COMPONENTS-0002", 'MDX registry ${fullTypeName(type)}.components must return one direct closed object literal.', field.pos);
		}
		final components = directRegistryFields(expression);
		if (components == null) {
			return fail("NXHX-MDX-COMPONENTS-0002",
				'MDX registry ${fullTypeName(type)}.components must directly return one closed object literal so every MDX name and component is checked at its Haxe source span.',
				expression.pos);
		}
		if (components.length == 0) {
			return fail("NXHX-MDX-COMPONENTS-0002", 'MDX registry ${fullTypeName(type)}.components must register at least one component.', expression.pos);
		}
		for (component in components) {
			if (!~/^[A-Z][A-Za-z0-9]*$/.match(component.field)) {
				return fail("NXHX-MDX-COMPONENTS-0002",
					'MDX component name "${component.field}" must be a PascalCase JSX identifier so local content cannot silently replace an intrinsic HTML element.',
					component.expr.pos);
			}
			final componentType = Context.typeof(component.expr);
			if (!isComponentType(componentType)) {
				return fail("NXHX-MDX-COMPONENTS-0002",
					'MDX component "${component.field}" must be nextjs.raw.react.ComponentType<Props>; found ${componentType.toString()}. Use an exact Haxe Client Component ref.',
					component.expr.pos);
			}
		}
	}

	static function portablePathDefine(name:String, position:Position):Array<String> {
		final value = Context.definedValue(name);
		if (value == null || value == "" || value.indexOf("\\") != -1 || value.startsWith("/") || ~/^[A-Za-z]:/.match(value)) {
			return fail("NXHX-MDX-PATH-0003", 'Compiler define $name must be a portable project-relative path supplied by the NextJsHx CLI.', position);
		}
		final parts = value.split("/");
		if (parts.exists(part -> part == "" || part == "." || part == "..")) {
			return fail("NXHX-MDX-PATH-0003", 'Compiler define $name must not contain empty, current-directory, or parent-directory segments.', position);
		}
		return parts;
	}

	static function relativeModule(from:Array<String>, to:Array<String>):String {
		var shared = 0;
		while (shared < from.length && shared < to.length && from[shared] == to[shared]) {
			shared++;
		}
		final parts = new Array<String>();
		for (_ in shared...from.length) {
			parts.push("..");
		}
		for (index in shared...to.length) {
			parts.push(to[index]);
		}
		final relative = parts.join("/");
		return relative.startsWith(".") ? relative : './$relative';
	}

	static function implementationModule(type:ClassType, position:Position):String {
		final appRoot = portablePathDefine(APP_ROOT_DEFINE, position);
		if (appRoot.length == 0 || appRoot[appRoot.length - 1] != "app") {
			return fail("NXHX-MDX-PATH-0003", 'Compiler define $APP_ROOT_DEFINE must end in app so the root MDX convention location is deterministic.',
				position);
		}
		appRoot.pop();
		final generated = portablePathDefine(GENERATED_ROOT_DEFINE, position).concat(type.module.split("."));
		return relativeModule(appRoot, generated);
	}

	static function isComponentType(type:Type):Bool {
		return switch type {
			case TInst(reference, parameters): final value = reference.get(); value.module == "nextjs.raw.react.ComponentType" && value.name == "ComponentType" && parameters.length == 1;
			case TType(reference, parameters):
				final value = reference.get();
				isComponentType(value.type.applyTypeParameters(value.params, parameters));
			case TMono(reference): final value = reference.get(); value != null && isComponentType(value);
			case TLazy(resolve):
				isComponentType(resolve());
			case _:
				false;
		};
	}

	static function sourcePosition(preferred:Position, fallback:Position):Position {
		final file = Context.getPosInfos(preferred).file;
		return file == "" || file == "(unknown)" ? fallback : preferred;
	}

	static function collectObjectFieldPositions(expression:TypedExpr, positions:Map<String, Position>):Void {
		switch expression.expr {
			case TObjectDecl(fields):
				for (field in fields) {
					if (!positions.exists(field.name)) {
						positions.set(field.name, field.expr.pos);
					}
					collectObjectFieldPositions(field.expr, positions);
				}
			case _:
				TypedExprTools.iter(expression, child -> collectObjectFieldPositions(child, positions));
		}
	}

	static function validateTypedRegistry(type:ClassType):Void {
		final marker = metadata(type);
		if (marker == null) {
			return;
		}
		final fields = type.statics.get().filter(field -> field.isPublic && field.name == "components");
		if (fields.length != 1) {
			return fail("NXHX-MDX-COMPONENTS-0002", 'MDX registry ${fullTypeName(type)} must retain one public static components function after typing.',
				marker.pos);
		}
		final result = switch fields[0].type.follow() {
			case TFun(arguments, result) if (arguments.length == 0): result.follow();
			case _:
				return fail("NXHX-MDX-COMPONENTS-0002", 'MDX registry ${fullTypeName(type)}.components must remain a zero-argument function after typing.',
					fields[0].pos);
		};
		final componentFields = switch result {
			case TAnonymous(reference): reference.get().fields;
			case _:
				return fail("NXHX-MDX-COMPONENTS-0002",
					'MDX registry ${fullTypeName(type)}.components must return one closed anonymous component map; found ${result.toString()}.', fields[0].pos);
		};
		if (componentFields.length == 0) {
			return fail("NXHX-MDX-COMPONENTS-0002", 'MDX registry ${fullTypeName(type)}.components must register at least one component.', fields[0].pos);
		}
		final expression = fields[0].expr();
		final fallback = expression == null ? type.pos : expression.pos;
		final positions = new Map<String, Position>();
		if (expression != null) {
			collectObjectFieldPositions(expression, positions);
		}
		for (component in componentFields) {
			final objectPosition = positions.get(component.name);
			final position = sourcePosition(component.pos, objectPosition == null ? fallback : objectPosition);
			if (!~/^[A-Z][A-Za-z0-9]*$/.match(component.name)) {
				return fail("NXHX-MDX-COMPONENTS-0002",
					'MDX component name "${component.name}" must be a PascalCase JSX identifier so local content cannot silently replace an intrinsic HTML element.',
					position);
			}
			if (!isComponentType(component.type)) {
				return fail("NXHX-MDX-COMPONENTS-0002",
					'MDX component "${component.name}" must be nextjs.raw.react.ComponentType<Props>; found ${component.type.toString()}. Use an exact Haxe Client Component ref.',
					position);
			}
		}
	}

	static function audit(types:Array<ModuleType>):Void {
		for (moduleType in types) {
			switch moduleType {
				case TClassDecl(reference):
					validateTypedRegistry(reference.get());
				case _:
			}
		}
	}

	public static function install():Void {
		if (installed) {
			return;
		}
		installed = true;
		Compiler.addGlobalMetadata("", "@:build(nextjshx.mdx.MdxComponentsMacro.build())", true, true, false);
		Context.onAfterTyping(audit);
	}

	public static function build():Array<Field> {
		final fields = Context.getBuildFields();
		final localClass = Context.getLocalClass();
		if (localClass == null) {
			return fields;
		}
		final type = localClass.get();
		final marker = metadata(type);
		if (marker == null) {
			return fields;
		}
		if (type.isExtern || type.isInterface || type.params.length != 0) {
			return fail("NXHX-MDX-REGISTRY-0001", 'MDX registry ${fullTypeName(type)} must be a concrete, non-generic class.', type.pos);
		}
		final field = componentsField(type, fields);
		validateSourceRegistry(type, field);
		if (!type.meta.has(":keep")) {
			type.meta.add(":keep", [], marker.pos);
		}
		final modulePath = implementationModule(type, marker.pos);
		AdapterPlanRegistry.register({
			kind: AdapterKind.MdxComponents,
			sourceType: fullTypeName(type),
			sourceField: field.name,
			typePosition: type.pos,
			fieldPosition: field.pos,
			metadataPosition: marker.pos,
			segmentPath: "",
			targetPath: "mdx-components.tsx",
			implementation: new AdapterImplementation(modulePath, type.name),
			imports: [new AdapterImport(modulePath, type.name, "NextJsHxMdxRegistry")],
			directives: [],
			exports: [
				new AdapterExport(AdapterExportKind.Named, "useMDXComponents", field.name, "typeof NextJsHxMdxRegistry.components")
			],
			config: []
		});
		return fields;
	}
	#end
}
