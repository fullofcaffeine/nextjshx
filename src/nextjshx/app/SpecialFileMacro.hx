package nextjshx.app;

#if macro
import haxe.macro.Compiler;
import haxe.macro.Context;
import haxe.macro.Expr;
import haxe.macro.Type;
import haxe.macro.Type.ClassType;
import nextjshx.adapter.AdapterExport;
import nextjshx.adapter.AdapterExport.AdapterExportKind;
import nextjshx.adapter.AdapterImplementation;
import nextjshx.adapter.AdapterImport;
import nextjshx.adapter.AdapterKind;
import nextjshx.adapter.AdapterPlanRegistry;
import nextjshx.route.RouteParameterValidator;
import nextjshx.route.RoutePattern;
import nextjshx.route.RoutePatternMacro;
import nextjshx.route.RouteTopologyKind;

using StringTools;
using haxe.macro.TypeTools;
using Lambda;

private enum SpecialFileKind {
	Loading;
	ErrorBoundary;
	NotFound;
	DefaultFallback;
}

private typedef SpecialFileDeclaration = {
	final kind:SpecialFileKind;
	final metadata:MetadataEntry;
	final ownerField:Null<Field>;
}

private typedef SpecialRenderMethod = {
	final field:Field;
	final asynchronous:Bool;
	final paramsType:Null<Type>;
}
#end

/** Validates typed loading, error, not-found, and parallel-slot default declarations. */
class SpecialFileMacro {
	#if macro
	public static inline final APP_ROOT_DEFINE:String = "nextjshx.app-root";
	public static inline final GENERATED_ROOT_DEFINE:String = "nextjshx.generated-root";
	static inline final MODULE_FUNCTION_METADATA:String = ":genes.moduleFunction";

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
		":next.proxy"
	];
	static var installed:Bool = false;

	static function fail<T>(code:String, message:String, position:Position):T {
		return Context.fatalError('[$code] $message', position);
	}

	static function fullTypeName(type:ClassType):String {
		return type.pack.concat([type.name]).join(".");
	}

	static function isModuleOwner(type:ClassType):Bool {
		return switch type.kind {
			#if (haxe_ver >= 4.2)
			case KModuleFields(_): true;
			#end
			case _: false;
		};
	}

	static function ownerName(type:ClassType):String {
		return isModuleOwner(type) ? type.module : fullTypeName(type);
	}

	static function fieldMetadata(field:Field, name:String):Array<MetadataEntry> {
		return field.meta == null ? [] : field.meta.filter(entry -> entry.name == name);
	}

	static function kindName(kind:SpecialFileKind):String {
		return switch kind {
			case Loading: "Loading";
			case ErrorBoundary: "Error";
			case NotFound: "Not-found";
			case DefaultFallback: "Default";
		};
	}

	static function annotationName(kind:SpecialFileKind):String {
		return switch kind {
			case Loading: "loading";
			case ErrorBoundary: "error";
			case NotFound: "notFound";
			case DefaultFallback: "default";
		};
	}

	static function declaration(type:ClassType, fields:Array<Field>):Null<SpecialFileDeclaration> {
		if (isModuleOwner(type)) {
			final declarations:Array<SpecialFileDeclaration> = [];
			final boundaries = [];
			for (field in fields) {
				for (name in BOUNDARY_METADATA) {
					for (entry in fieldMetadata(field, name)) {
						boundaries.push({field: field, metadata: entry});
						switch name {
							case ":next.loading":
								declarations.push({kind: Loading, metadata: entry, ownerField: field});
							case ":next.error":
								declarations.push({kind: ErrorBoundary, metadata: entry, ownerField: field});
							case ":next.notFound":
								declarations.push({kind: NotFound, metadata: entry, ownerField: field});
							case ":next.default":
								declarations.push({kind: DefaultFallback, metadata: entry, ownerField: field});
							case _:
						}
					}
				}
			}
			if (declarations.length == 0) {
				return null;
			}
			if (boundaries.length != 1 || declarations.length != 1) {
				final position = boundaries.length > 1 ? boundaries[1].metadata.pos : declarations[1].metadata.pos;
				fail("NXHX-SPECIAL-BOUNDARY-0001",
					'Module ${ownerName(type)} must declare exactly one App Router boundary annotation on one module-level render function; found ${boundaries.length}.',
					position);
			}
			return declarations[0];
		}
		final declarations:Array<SpecialFileDeclaration> = [];
		for (entry in type.meta.get()) {
			switch entry.name {
				case ":next.loading":
					declarations.push({kind: Loading, metadata: entry, ownerField: null});
				case ":next.error":
					declarations.push({kind: ErrorBoundary, metadata: entry, ownerField: null});
				case ":next.notFound":
					declarations.push({kind: NotFound, metadata: entry, ownerField: null});
				case ":next.default":
					declarations.push({kind: DefaultFallback, metadata: entry, ownerField: null});
				case _:
			}
		}
		if (declarations.length == 0) {
			return null;
		}
		final boundaries = type.meta.get().filter(entry -> BOUNDARY_METADATA.contains(entry.name));
		if (boundaries.length != 1 || declarations.length != 1) {
			final position = boundaries.length > 1 ? boundaries[1].pos : declarations[1].metadata.pos;
			fail("NXHX-SPECIAL-BOUNDARY-0001", '${ownerName(type)} must declare exactly one App Router boundary annotation; found ${boundaries.length}.',
				position);
		}
		return declarations[0];
	}

	static function declarationPath(type:ClassType, value:SpecialFileDeclaration):String {
		final annotation = annotationName(value.kind);
		if (value.metadata.params.length != 1) {
			return fail("NXHX-SPECIAL-PATH-0002", '@:next.$annotation on ${ownerName(type)} requires exactly one App-Router-root-relative string literal.',
				value.metadata.pos);
		}
		return switch value.metadata.params[0].expr {
			case EConst(CString(path, _)): path;
			case _:
				fail("NXHX-SPECIAL-PATH-0002",
					'@:next.$annotation on ${ownerName(type)} requires a compile-time string literal; expressions are not evaluated.',
					value.metadata.params[0].pos);
		};
	}

	static function hasAccess(field:Field, access:Access):Bool {
		return field.access != null && field.access.contains(access);
	}

	static function isPublicField(type:ClassType, field:Field):Bool {
		return isModuleOwner(type) ? !hasAccess(field, APrivate) : hasAccess(field, APublic);
	}

	static function isStaticField(type:ClassType, field:Field):Bool {
		return isModuleOwner(type) || hasAccess(field, AStatic);
	}

	static function markModuleFunction(field:Field):Void {
		final metadata = field.meta == null ? [] : field.meta;
		if (metadata.exists(entry -> entry.name == MODULE_FUNCTION_METADATA)) {
			fail("NXHX-SPECIAL-MODULE-0010",
				'${field.name} must not declare @:genes.moduleFunction directly; NextJsHx derives the native export from the special-file annotation.',
				field.pos);
		}
		metadata.push({
			name: MODULE_FUNCTION_METADATA,
			params: [{expr: EConst(CString(field.name, DoubleQuotes)), pos: field.pos}],
			pos: field.pos
		});
		field.meta = metadata;
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

	static function isSemanticType(type:Type, module:String, name:String):Bool {
		return switch type {
			case TMono(reference): final value = reference.get(); value != null && isSemanticType(value, module, name);
			case TLazy(resolve): isSemanticType(resolve(), module, name);
			case TType(reference, parameters): final definition = reference.get(); (definition.module == module && definition.name == name
					&& parameters.length == 0) || isSemanticType(definition.type.applyTypeParameters(definition.params, parameters), module, name);
			case TAbstract(reference, parameters): final definition = reference.get(); definition.module == module && definition.name == name && parameters.length == 0;
			case TInst(reference, parameters): final definition = reference.get(); definition.module == module && definition.name == name && parameters.length == 0;
			case _: false;
		};
	}

	static function isElement(type:Type):Bool {
		return isSemanticType(type, "genes.react.Element", "Element");
	}

	static function semanticArguments(type:Type, module:String, name:String, arity:Int):Null<Array<Type>> {
		return switch type {
			case TMono(reference):
				final value = reference.get();
				value == null ? null : semanticArguments(value, module, name, arity);
			case TLazy(resolve): semanticArguments(resolve(), module, name, arity);
			case TType(reference, parameters):
				final definition = reference.get();
				if (definition.module == module && definition.name == name && parameters.length == arity) {
					parameters;
				} else {
					semanticArguments(definition.type.applyTypeParameters(definition.params, parameters), module, name, arity);
				}
			case _: null;
		};
	}

	static function elementReturn(type:Type):Null<Bool> {
		if (isElement(type)) {
			return false;
		}
		return switch resolveAliases(type) {
			case TInst(reference, [result]) if (reference.get().module == "js.lib.Promise"
				&& reference.get().name == "Promise"
				&& isElement(result)): true;
			case _: null;
		};
	}

	static function requireType(type:Null<ComplexType>, label:String, position:Position):Type {
		if (type == null) {
			return fail("NXHX-SPECIAL-RENDER-0004", '$label requires an explicit Haxe type annotation.', position);
		}
		return Context.resolveType(type, position);
	}

	static function renderField(type:ClassType, declaration:SpecialFileDeclaration, fields:Array<Field>):SpecialRenderMethod {
		final kind = declaration.kind;
		final label = kindName(kind);
		final renders = declaration.ownerField == null ? fields.filter(field -> field.name == "render") : [declaration.ownerField];
		if (renders.length != 1) {
			return fail("NXHX-SPECIAL-RENDER-0004",
				'$label declaration ${ownerName(type)} must expose exactly one public static render function; found ${renders.length}.', type.pos);
		}
		final field = renders[0];
		if (declaration.ownerField != null && field.name != "render") {
			return fail("NXHX-SPECIAL-RENDER-0004",
				'@:next.${annotationName(kind)} must annotate the module-level render function; found ${ownerName(type)}.${field.name}.', field.pos);
		}
		if (!isPublicField(type, field) || !isStaticField(type, field)) {
			return fail("NXHX-SPECIAL-RENDER-0004", '$label render ${ownerName(type)}.render must be public static or a public module-level function.',
				field.pos);
		}
		final method = switch field.kind {
			case FFun(value): value;
			case _:
				return fail("NXHX-SPECIAL-RENDER-0004", '$label field ${ownerName(type)}.render must be a function.', field.pos);
		};
		if (method.params.length != 0) {
			fail("NXHX-SPECIAL-RENDER-0004", '$label render ${ownerName(type)}.render must be non-generic.', field.pos);
		}
		final expectedArguments = kind == ErrorBoundary ? 1 : 0;
		if ((kind == DefaultFallback && method.args.length > 1) || (kind != DefaultFallback && method.args.length != expectedArguments)) {
			final expectation = kind == DefaultFallback ? "zero arguments or one nextjs.app.DefaultProps<Params> argument" : '$expectedArguments argument${expectedArguments == 1 ? "" : "s"}';
			fail("NXHX-SPECIAL-RENDER-0004", '$label render ${ownerName(type)}.render requires $expectation; found ${method.args.length}.', field.pos);
		}
		var paramsType:Null<Type> = null;
		if (kind == ErrorBoundary) {
			final argument = method.args[0];
			if (argument.opt || argument.value != null) {
				fail("NXHX-SPECIAL-ERROR-PROPS-0005", 'Error props argument "${argument.name}" must be required and have no default value.',
					argument.value == null ? field.pos : argument.value.pos);
			}
			final propsType = requireType(argument.type, 'Error props argument "${argument.name}"', field.pos);
			if (!isSemanticType(propsType, "nextjs.app.ErrorProps", "ErrorProps")) {
				fail("NXHX-SPECIAL-ERROR-PROPS-0005",
					'Error render props must be nextjs.app.ErrorProps so error and reset retain Next\'s exact client-boundary contract; found ${propsType.toString()}.',
					field.pos);
			}
		}
		if (kind == DefaultFallback && method.args.length == 1) {
			final argument = method.args[0];
			if (argument.opt || argument.value != null) {
				fail("NXHX-SPECIAL-DEFAULT-PROPS-0008", 'Default props argument "${argument.name}" must be required and have no default value.',
					argument.value == null ? field.pos : argument.value.pos);
			}
			final propsType = requireType(argument.type, 'Default props argument "${argument.name}"', field.pos);
			final arguments = semanticArguments(propsType, "nextjs.app.DefaultProps", "DefaultProps", 1);
			if (arguments == null) {
				fail("NXHX-SPECIAL-DEFAULT-PROPS-0008",
					'Default render props must be nextjs.app.DefaultProps<Params> so dynamic params remain Promise-shaped; found ${propsType.toString()}.',
					field.pos);
			}
			paramsType = arguments[0];
		}
		final returnType = requireType(method.ret, '$label render return', field.pos);
		final asynchronous = elementReturn(returnType);
		if (asynchronous == null) {
			fail("NXHX-SPECIAL-RETURN-0006",
				'$label render must return genes.react.Element${kind == ErrorBoundary ? "" : " or Promise<genes.react.Element>"}; found ${returnType.toString()}.',
				field.pos);
		}
		if (kind == ErrorBoundary && asynchronous) {
			fail("NXHX-SPECIAL-ERROR-ASYNC-0007", 'Error render ${ownerName(type)}.render must be synchronous because error.tsx is a Client Component.',
				field.pos);
		}
		return {field: field, asynchronous: asynchronous, paramsType: paramsType};
	}

	static function validatePublicFields(type:ClassType, kind:SpecialFileKind, fields:Array<Field>):Void {
		final label = kindName(kind);
		for (field in fields) {
			if (field.name == "render" || !isPublicField(type, field)) {
				continue;
			}
			fail("NXHX-SPECIAL-FIELD-0003",
				'Public $label field ${ownerName(type)}.${field.name} has no reviewed special-file export mapping; make helpers private.', field.pos);
		}
	}

	static function portableDefine(name:String, position:Position):Array<String> {
		final value = Context.definedValue(name);
		if (value == null || value == "" || value.indexOf("\\") != -1 || value.startsWith("/") || ~/^[A-Za-z]:/.match(value)) {
			return fail("NXHX-SPECIAL-PATH-0002", 'Compiler define $name must be a portable project-relative path supplied by the NextJsHx CLI.', position);
		}
		final parts = value.split("/");
		if (parts.exists(part -> part == "" || part == "." || part == "..")) {
			return fail("NXHX-SPECIAL-PATH-0002", 'Compiler define $name must not contain empty, current-directory, or parent-directory segments.', position);
		}
		return parts;
	}

	static function implementationModule(type:ClassType, pattern:RoutePattern, position:Position):String {
		final from = portableDefine(APP_ROOT_DEFINE, position).concat(pattern.filesystemPath == "" ? [] : pattern.filesystemPath.split("/"));
		final to = portableDefine(GENERATED_ROOT_DEFINE, position).concat(type.module.split("."));
		var shared = 0;
		while (shared < from.length && shared < to.length && from[shared] == to[shared]) {
			shared++;
		}
		final parts:Array<String> = [];
		for (_ in shared...from.length) {
			parts.push("..");
		}
		for (index in shared...to.length) {
			parts.push(to[index]);
		}
		final relative = parts.join("/");
		return relative.startsWith(".") ? relative : './$relative';
	}

	static function implementationAlias(symbol:String, kind:SpecialFileKind, asynchronous:Bool):Null<String> {
		final reserved = ["JSX", "Error"];
		if (asynchronous) {
			reserved.push("Promise");
		}
		if (!reserved.contains(symbol)) {
			return null;
		}
		var alias = 'NextJsHx${kindName(kind).split("-").join("")}Implementation';
		while (reserved.contains(alias) || alias == symbol) {
			alias += "Type";
		}
		return alias;
	}

	static function adapterKind(kind:SpecialFileKind):AdapterKind {
		return switch kind {
			case Loading: AdapterKind.Loading;
			case ErrorBoundary: AdapterKind.Error;
			case NotFound: AdapterKind.NotFound;
			case DefaultFallback: AdapterKind.DefaultFallback;
		};
	}

	static function convention(kind:SpecialFileKind):String {
		return switch kind {
			case Loading: "loading.tsx";
			case ErrorBoundary: "error.tsx";
			case NotFound: "not-found.tsx";
			case DefaultFallback: "default.tsx";
		};
	}

	/** Installs special-file validation before application declarations load. */
	public static function install():Void {
		if (installed) {
			return;
		}
		installed = true;
		Compiler.addGlobalMetadata("", "@:build(nextjshx.app.SpecialFileMacro.build())", true, true, false);
	}

	/** Types one special-file declaration and records its closed adapter intent. */
	public static function build():Array<Field> {
		final fields = Context.getBuildFields();
		final localClass = Context.getLocalClass();
		if (localClass == null) {
			return fields;
		}
		final type = localClass.get();
		final value = declaration(type, fields);
		if (value == null) {
			return fields;
		}
		if (type.params.length != 0) {
			fail("NXHX-SPECIAL-RENDER-0004", '${kindName(value.kind)} declaration ${ownerName(type)} must be non-generic.', type.pos);
		}
		final path = declarationPath(type, value);
		final pattern = RoutePatternMacro.parse(path, value.metadata.pos);
		if (value.kind == DefaultFallback) {
			final parts = pattern.filesystemPath.split("/");
			final last = parts[parts.length - 1];
			if (pattern.topology != RouteTopologyKind.ParallelView || !last.startsWith("@")) {
				fail("NXHX-SPECIAL-DEFAULT-PATH-0009",
					'@:next.default must target the root of one named parallel slot such as "dashboard/@modal"; found "$path".', value.metadata.pos);
			}
		}
		final render = renderField(type, value, fields);
		validatePublicFields(type, value.kind, fields);
		if (render.paramsType != null) {
			RouteParameterValidator.validate(pattern, render.paramsType, render.field.pos);
		}
		if (value.ownerField == null) {
			if (!type.meta.has(":keep")) {
				type.meta.add(":keep", [], value.metadata.pos);
			}
		} else {
			final metadata = render.field.meta == null ? [] : render.field.meta;
			if (!metadata.exists(entry -> entry.name == ":keep")) {
				metadata.push({name: ":keep", params: [], pos: value.metadata.pos});
				render.field.meta = metadata;
			}
			markModuleFunction(render.field);
		}
		final modulePath = implementationModule(type, pattern, value.metadata.pos);
		final implementationSymbol = value.ownerField == null ? type.name : render.field.name;
		final alias = implementationAlias(implementationSymbol, value.kind, render.asynchronous);
		final file = convention(value.kind);
		final result = '${render.asynchronous ? "Promise<" : ""}JSX.Element${render.asynchronous ? ">" : ""}';
		final signature = switch value.kind {
			case ErrorBoundary: '(props: { error: Error & { digest?: string }; reset: () => void }) => JSX.Element';
			case DefaultFallback if (render.paramsType != null): '(props: Pick<LayoutProps<"${pattern.publicPath}">, "params">) => $result';
			case _: '() => $result';
		};
		AdapterPlanRegistry.register({
			kind: adapterKind(value.kind),
			sourceType: ownerName(type),
			sourceField: render.field.name,
			typePosition: value.ownerField == null ? type.pos : render.field.pos,
			fieldPosition: render.field.pos,
			metadataPosition: value.metadata.pos,
			segmentPath: pattern.filesystemPath,
			targetPath: pattern.filesystemPath == "" ? file : '${pattern.filesystemPath}/$file',
			implementation: new AdapterImplementation(modulePath, implementationSymbol),
			imports: [
				new AdapterImport(modulePath, implementationSymbol, alias),
				new AdapterImport("react", "JSX", null, true)
			],
			directives: value.kind == ErrorBoundary ? ["use client"] : [],
			exports: [
				new AdapterExport(AdapterExportKind.Default, "default", render.field.name, signature)
			],
			config: []
		});
		return fields;
	}
	#end
}
