package nextjshx.app;

#if macro
import haxe.crypto.Sha256;
import haxe.macro.Compiler;
import haxe.macro.Context;
import haxe.macro.Expr;
import haxe.macro.Type;
import haxe.macro.Type.ClassField;
import haxe.macro.Type.ClassType;
import nextjshx.adapter.AdapterConfig;
import nextjshx.adapter.AdapterExport;
import nextjshx.adapter.AdapterExport.AdapterExportKind;
import nextjshx.adapter.AdapterImplementation;
import nextjshx.adapter.AdapterImport;
import nextjshx.adapter.AdapterKind;
import nextjshx.adapter.AdapterPlanRegistry;
import nextjshx.cache.CacheDirectiveMacro;
import nextjshx.cache.CacheDirectiveMacro.CacheDirectiveDeclaration;
import nextjshx.route.RouteParameterValidator;
import nextjshx.route.RoutePattern;
import nextjshx.route.RoutePatternMacro;
import nextjshx.route.RoutePatternType;
import nextjshx.route.QueryFieldBinding.QuerySchemaValidation;
import nextjshx.route.QuerySchemaValidator;

using StringTools;
using haxe.macro.TypeTools;
using Lambda;

private enum PageLayoutKind {
	Page;
	Layout;
}

private typedef PageLayoutDeclaration = {
	final kind:PageLayoutKind;
	final metadata:MetadataEntry;
	final ownerField:Null<Field>;
}

private typedef PageQueryDeclaration = {
	final metadata:MetadataEntry;
	final schema:QuerySchemaValidation;
}

private typedef RenderMethod = {
	final field:Field;
	final paramsType:Type;
	final asynchronous:Bool;
}

private typedef GeneratedMetadataMethod = {
	final field:Field;
	final asynchronous:Bool;
}

private typedef StaticParamsMethod = {
	final field:Field;
	final asynchronous:Bool;
}

private typedef StaticParamsReturn = {
	final paramsType:Type;
	final asynchronous:Bool;
}

private typedef PageLayoutNamedFields = {
	final fields:Array<Field>;
	final metadata:Null<Field>;
	final generateMetadata:Null<GeneratedMetadataMethod>;
	final generateStaticParams:Null<StaticParamsMethod>;
	final config:Array<AdapterConfig>;
}
#end

/** Validates `@:next.page` and `@:next.layout` declarations and records adapters. */
class PageLayoutMacro {
	#if macro
	public static inline final APP_ROOT_DEFINE:String = "nextjshx.app-root";
	public static inline final GENERATED_ROOT_DEFINE:String = "nextjshx.generated-root";
	static inline final LAYOUT_SLOTS_METADATA:String = ":next.layoutSlots";
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
	static final REVIEWED_NAMED_FIELDS = ["metadata", "generateMetadata", "generateStaticParams", "segment"];
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

	static function kindName(kind:PageLayoutKind):String {
		return switch kind {
			case Page: "Page";
			case Layout: "Layout";
		};
	}

	static function annotationName(kind:PageLayoutKind):String {
		return switch kind {
			case Page: "page";
			case Layout: "layout";
		};
	}

	static function declaration(type:ClassType, fields:Array<Field>):Null<PageLayoutDeclaration> {
		if (isModuleOwner(type)) {
			final pages = [];
			final layouts = [];
			final queries = [];
			final boundaries = [];
			for (field in fields) {
				for (entry in fieldMetadata(field, ":next.page")) {
					pages.push({field: field, metadata: entry});
					boundaries.push({field: field, metadata: entry});
				}
				for (entry in fieldMetadata(field, ":next.layout")) {
					layouts.push({field: field, metadata: entry});
					boundaries.push({field: field, metadata: entry});
				}
				for (entry in fieldMetadata(field, ":next.query")) {
					queries.push({field: field, metadata: entry});
				}
				for (name in BOUNDARY_METADATA) {
					if (name == ":next.page" || name == ":next.layout") {
						continue;
					}
					for (entry in fieldMetadata(field, name)) {
						boundaries.push({field: field, metadata: entry});
					}
				}
			}
			if (pages.length == 0 && layouts.length == 0) {
				if (queries.length > 0) {
					fail("NXHX-ROUTE-QUERY-SCHEMA-0001",
						'@:next.query on ${ownerName(type)}.${queries[0].field.name} requires the same module-level function to declare @:next.page.',
						queries[0].metadata.pos);
				}
				return null;
			}
			if (boundaries.length != 1 || pages.length + layouts.length != 1) {
				final position = boundaries.length > 1 ? boundaries[1].metadata.pos : (pages.length > 1 ? pages[1].metadata.pos : layouts[1].metadata.pos);
				fail("NXHX-PAGE-LAYOUT-BOUNDARY-0001",
					'Module ${ownerName(type)} must declare exactly one App Router boundary annotation on one module-level function; found ${boundaries.length}.',
					position);
			}
			final selected = pages.length == 1 ? pages[0] : layouts[0];
			return {
				kind: pages.length == 1 ? Page : Layout,
				metadata: selected.metadata,
				ownerField: selected.field
			};
		}
		final pages = type.meta.get().filter(entry -> entry.name == ":next.page");
		final layouts = type.meta.get().filter(entry -> entry.name == ":next.layout");
		final queries = type.meta.get().filter(entry -> entry.name == ":next.query");
		if (pages.length == 0 && layouts.length == 0) {
			if (queries.length > 0) {
				fail("NXHX-ROUTE-QUERY-SCHEMA-0001", '@:next.query on ${fullTypeName(type)} requires the same type to declare @:next.page.', queries[0].pos);
			}
			return null;
		}
		final boundaries = type.meta.get().filter(entry -> BOUNDARY_METADATA.contains(entry.name));
		if (boundaries.length != 1 || pages.length + layouts.length != 1) {
			final position = boundaries.length > 1 ? boundaries[1].pos : (pages.length > 1 ? pages[1].pos : layouts[1].pos);
			fail("NXHX-PAGE-LAYOUT-BOUNDARY-0001",
				'${fullTypeName(type)} must declare exactly one App Router boundary annotation; found ${boundaries.length}.', position);
		}
		return pages.length == 1 ? {kind: Page, metadata: pages[0], ownerField: null} : {kind: Layout, metadata: layouts[0], ownerField: null};
	}

	static function queryDeclaration(type:ClassType, declaration:PageLayoutDeclaration):Null<PageQueryDeclaration> {
		final queries = declaration.ownerField == null ? type.meta.get()
			.filter(entry -> entry.name == ":next.query") : fieldMetadata(declaration.ownerField, ":next.query");
		if (queries.length == 0) {
			return null;
		}
		if (declaration.kind != Page) {
			return fail("NXHX-ROUTE-QUERY-SCHEMA-0001", '@:next.query is page-only because layouts do not receive searchParams.', queries[0].pos);
		}
		if (queries.length != 1) {
			return fail("NXHX-ROUTE-QUERY-SCHEMA-0001", '@:next.query may appear at most once on ${ownerName(type)}.', queries[1].pos);
		}
		return {metadata: queries[0], schema: QuerySchemaValidator.fromMetadata(type, queries[0])};
	}

	static function declarationPath(type:ClassType, value:PageLayoutDeclaration):String {
		final annotation = annotationName(value.kind);
		if (value.metadata.params.length != 1) {
			return fail("NXHX-PAGE-LAYOUT-PATH-0002",
				'@:next.$annotation on ${fullTypeName(type)} requires exactly one App-Router-root-relative string literal.', value.metadata.pos);
		}
		return switch value.metadata.params[0].expr {
			case EConst(CString(path, _)): path;
			case _:
				fail("NXHX-PAGE-LAYOUT-PATH-0002",
					'@:next.$annotation on ${fullTypeName(type)} requires a compile-time string literal; expressions are not evaluated.',
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

	/**
	 * Requests Genes' framework-neutral module-function lowering for one native
	 * Next export body. Application code owns only the Next annotation; the
	 * compiler marker is derived plumbing and therefore cannot conflict with a
	 * user-selected binding name.
	 */
	static function markModuleFunction(field:Field):Void {
		final metadata = field.meta == null ? [] : field.meta;
		if (metadata.exists(entry -> entry.name == MODULE_FUNCTION_METADATA)) {
			fail("NXHX-PAGE-LAYOUT-MODULE-0011",
				'${field.name} must not declare @:genes.moduleFunction directly; NextJsHx derives the exact native binding from the reviewed App Router export.',
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

	static function promiseArgument(type:Type):Null<Type> {
		return switch resolveAliases(type) {
			case TInst(reference, [value]) if (reference.get().module == "js.lib.Promise" && reference.get().name == "Promise"):
				value;
			case _:
				null;
		};
	}

	static function anonymousFields(type:Type):Null<Array<ClassField>> {
		return switch resolveAliases(type) {
			case TAnonymous(reference): reference.get().fields.copy();
			case _: null;
		};
	}

	static function looksLikeUnmarkedSlottedLayout(type:Type):Bool {
		final fields = anonymousFields(type);
		if (fields == null || fields.length < 3) {
			return false;
		}
		var children = false;
		var params = false;
		for (field in fields) {
			children = children || field.name == "children";
			params = params || field.name == "params";
		}
		return children && params;
	}

	/**
	 * Validates a named, zero-runtime layout-props typedef whose extra fields are
	 * Next parallel-route slots. The marker makes the structural exception
	 * explicit; ordinary lookalikes remain rejected as before.
	 */
	static function slottedLayoutParams(type:Type, position:Position):Null<Type> {
		return switch type {
			case TMono(reference):
				final value = reference.get();
				value == null ? null : slottedLayoutParams(value, position);
			case TLazy(resolve):
				slottedLayoutParams(resolve(), position);
			case TType(reference, parameters):
				final definition = reference.get();
				final markers = definition.meta.get().filter(entry -> entry.name == LAYOUT_SLOTS_METADATA);
				if (markers.length == 0) {
					null;
				} else {
					if (markers.length != 1 || markers[0].params.length != 0) {
						fail("NXHX-PAGE-LAYOUT-SLOTS-0010",
							'@:next.layoutSlots on ${definition.module}.${definition.name} is a parameterless marker and may appear exactly once.',
							markers.length > 1 ? markers[1].pos : markers[0].pos);
					}
					final applied = definition.type.applyTypeParameters(definition.params, parameters);
					final fields = anonymousFields(applied);
					if (fields == null) {
						fail("NXHX-PAGE-LAYOUT-SLOTS-0010", '@:next.layoutSlots may annotate only a named anonymous props typedef; found ${type.toString()}.',
							markers[0].pos);
					}
					final byName = new Map<String, ClassField>();
					for (field in fields) {
						byName.set(field.name, field);
					}
					final children = byName.get("children");
					if (children == null || !isSemanticType(children.type, "nextjs.raw.react.ReactNode", "ReactNode")) {
						fail("NXHX-PAGE-LAYOUT-SLOTS-0010",
							'${definition.name} must include required immutable children:nextjs.raw.react.ReactNode, normally by extending nextjs.app.LayoutProps<Params>.',
							children == null ? markers[0].pos : children.pos);
					}
					final params = byName.get("params");
					final paramsType = params == null ? null : promiseArgument(params.type);
					if (paramsType == null) {
						fail("NXHX-PAGE-LAYOUT-SLOTS-0010",
							'${definition.name} must include required immutable params:js.lib.Promise<Params>, normally by extending nextjs.app.LayoutProps<Params>.',
							params == null ? markers[0].pos : params.pos);
					}
					var slots = 0;
					for (field in fields) {
						final required = !field.meta.has(":optional");
						final immutable = switch field.kind {
							case FVar(_, AccNever): true;
							case _: false;
						};
						if (!required || !immutable) {
							fail("NXHX-PAGE-LAYOUT-SLOTS-0010",
								'Layout props field "${field.name}" must be required and immutable because Next supplies one closed render snapshot.',
								field.pos);
						}
						if (field.name != "children" && field.name != "params") {
							slots++;
							if (!isSemanticType(field.type, "nextjs.raw.react.ReactNode", "ReactNode")) {
								fail("NXHX-PAGE-LAYOUT-SLOTS-0010",
									'Parallel slot "${field.name}" must be nextjs.raw.react.ReactNode; found ${field.type.toString()}.', field.pos);
							}
						}
					}
					if (slots == 0) {
						fail("NXHX-PAGE-LAYOUT-SLOTS-0010",
							'@:next.layoutSlots on ${definition.name} requires at least one named ReactNode slot in addition to children and params.',
							markers[0].pos);
					}
					paramsType;
				}
			case _:
				null;
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

	static function metadataReturn(type:Type):Null<Bool> {
		if (isSemanticType(type, "nextjs.raw.metadata.Metadata", "Metadata")) {
			return false;
		}
		return switch resolveAliases(type) {
			case TInst(reference, [result])
				if (reference.get().module == "js.lib.Promise"
					&& reference.get().name == "Promise"
					&& isSemanticType(result, "nextjs.raw.metadata.Metadata", "Metadata")): true;
			case _: null;
		};
	}

	static function staticParamsReturn(type:Type):Null<StaticParamsReturn> {
		return switch resolveAliases(type) {
			case TInst(reference, [paramsType]) if (reference.get().module == "Array" && reference.get().name == "Array"):
				{paramsType: paramsType, asynchronous: false};
			case TInst(reference, [result]) if (reference.get().module == "js.lib.Promise" && reference.get().name == "Promise"):
				switch resolveAliases(result) {
					case TInst(arrayReference, [paramsType]) if (arrayReference.get().module == "Array"
						&& arrayReference.get().name == "Array"):
						{paramsType: paramsType, asynchronous: true};
					case _: null;
				};
			case _: null;
		};
	}

	static function requireType(type:Null<ComplexType>, label:String, position:Position):Type {
		if (type == null) {
			return fail("NXHX-PAGE-LAYOUT-RENDER-0004", '$label requires an explicit Haxe type annotation.', position);
		}
		return Context.resolveType(type, position);
	}

	static function renderField(type:ClassType, declaration:PageLayoutDeclaration, pattern:RoutePattern, fields:Array<Field>):RenderMethod {
		final kind = declaration.kind;
		final label = kindName(kind);
		final renders = declaration.ownerField == null ? fields.filter(field -> field.name == "render") : [declaration.ownerField];
		if (renders.length != 1) {
			return fail("NXHX-PAGE-LAYOUT-RENDER-0004",
				'$label declaration ${ownerName(type)} must expose exactly one public static render function; found ${renders.length}.', type.pos);
		}
		final field = renders[0];
		if (declaration.ownerField != null && field.name != "render") {
			return fail("NXHX-PAGE-LAYOUT-RENDER-0004",
				'Module-level @:next.${annotationName(kind)} must annotate the function named render so ${type.module}.render maps directly to Next\'s default export; found ${field.name}.',
				field.pos);
		}
		if (!isPublicField(type, field) || !isStaticField(type, field)) {
			return fail("NXHX-PAGE-LAYOUT-RENDER-0004", '$label render ${ownerName(type)}.render must be public static or a public module-level function.',
				field.pos);
		}
		final method = switch field.kind {
			case FFun(value): value;
			case _:
				return fail("NXHX-PAGE-LAYOUT-RENDER-0004", '$label field ${fullTypeName(type)}.render must be a function.', field.pos);
		};
		if (method.params.length != 0) {
			fail("NXHX-PAGE-LAYOUT-RENDER-0004", '$label render ${fullTypeName(type)}.render must be non-generic.', field.pos);
		}
		if (method.args.length != 1) {
			fail("NXHX-PAGE-LAYOUT-RENDER-0004",
				'$label render ${fullTypeName(type)}.render requires exactly one props argument; found ${method.args.length}.', field.pos);
		}
		final argument = method.args[0];
		if (argument.opt || argument.value != null) {
			fail("NXHX-PAGE-LAYOUT-RENDER-0004", '$label props argument "${argument.name}" must be required and have no default value.',
				argument.value == null ? field.pos : argument.value.pos);
		}
		final propsType = requireType(argument.type, '$label props argument "${argument.name}"', field.pos);
		final paramsType = switch kind {
			case Page:
				final arguments = semanticArguments(propsType, "nextjs.app.PageProps", "PageProps", 2);
				if (arguments == null) {
					return fail("NXHX-PAGE-LAYOUT-PROPS-0005",
						'Page render props must be nextjs.app.PageProps<Params, SearchParams> so params and searchParams remain Promise-shaped; found ${propsType.toString()}.',
						field.pos);
				}
				if (!isSemanticType(arguments[1], "nextjs.route.SearchParams", "SearchParams")) {
					fail("NXHX-PAGE-LAYOUT-QUERY-0006",
						'Page render query type must remain nextjs.route.SearchParams because @:next.query types outbound href construction but does not decode URL input; found ${arguments[1].toString()}.',
						field.pos);
				}
				arguments[0];
			case Layout:
				final slottedParams = slottedLayoutParams(propsType, field.pos);
				if (slottedParams != null) {
					slottedParams;
				} else {
					final arguments = semanticArguments(propsType, "nextjs.app.LayoutProps", "LayoutProps", 1);
					if (arguments == null) {
						if (looksLikeUnmarkedSlottedLayout(propsType)) {
							return fail("NXHX-PAGE-LAYOUT-SLOTS-0010",
								'Layout props ${propsType.toString()} declares named slot fields but is not reviewed. Add parameterless @:next.layoutSlots to the named typedef, extend nextjs.app.LayoutProps<Params>, and keep every slot a required final ReactNode.',
								field.pos);
						}
						return fail("NXHX-PAGE-LAYOUT-PROPS-0005",
							'Layout render props must be nextjs.app.LayoutProps<Params> so children are ReactNode and params remain Promise-shaped; found ${propsType.toString()}.',
							field.pos);
					}
					arguments[0];
				}
		};
		RouteParameterValidator.validate(pattern, paramsType, field.pos);

		final returnType = requireType(method.ret, '$label render return', field.pos);
		final asynchronous = elementReturn(returnType);
		if (asynchronous == null) {
			fail("NXHX-PAGE-LAYOUT-RETURN-0007",
				'$label render must return genes.react.Element or Promise<genes.react.Element>; found ${returnType.toString()}.', field.pos);
		}
		return {field: field, paramsType: paramsType, asynchronous: asynchronous};
	}

	static function requireNamedType(type:Null<ComplexType>, code:String, label:String, position:Position):Type {
		if (type == null) {
			return fail(code, '$label requires an explicit Haxe type annotation.', position);
		}
		return Context.resolveType(type, position);
	}

	static function validateStaticMetadata(type:ClassType, field:Field):Field {
		if (isModuleOwner(type)) {
			return fail("NXHX-PAGE-LAYOUT-MODULE-0011",
				'${ownerName(type)}.metadata cannot yet be emitted as a direct module value. Use a module-level generateMetadata function, or keep this page/layout in the compatibility class form until Genes provides framework-neutral direct module-value lowering.',
				field.pos);
		}
		if (!isStaticField(type, field) || !hasAccess(field, AFinal)) {
			return fail("NXHX-PAGE-LAYOUT-METADATA-0008", '${ownerName(type)}.metadata must be public static final.', field.pos);
		}
		final fieldType = switch field.kind {
			case FVar(complexType, value) if (value != null):
				requireNamedType(complexType, "NXHX-PAGE-LAYOUT-METADATA-0008", '${ownerName(type)}.metadata', field.pos);
			case FVar(_, _):
				return fail("NXHX-PAGE-LAYOUT-METADATA-0008", '${ownerName(type)}.metadata requires an inline initialized value.', field.pos);
			case _:
				return fail("NXHX-PAGE-LAYOUT-METADATA-0008", '${ownerName(type)}.metadata must be a typed field, not a function or property.', field.pos);
		};
		if (!isSemanticType(fieldType, "nextjs.raw.metadata.Metadata", "Metadata")) {
			return fail("NXHX-PAGE-LAYOUT-METADATA-0008",
				'${ownerName(type)}.metadata must use nextjs.raw.metadata.Metadata so Next remains the metadata type oracle; found ${fieldType.toString()}.',
				field.pos);
		}
		return field;
	}

	static function validateMetadataProps(type:ClassType, kind:PageLayoutKind, pattern:RoutePattern, propsType:Type, position:Position):Void {
		final common = semanticArguments(propsType, "nextjs.app.MetadataProps", "MetadataProps", 1);
		if (common != null) {
			RouteParameterValidator.validate(pattern, common[0], position);
			return;
		}
		if (kind == Page) {
			final page = semanticArguments(propsType, "nextjs.app.PageMetadataProps", "PageMetadataProps", 2);
			if (page != null) {
				RouteParameterValidator.validate(pattern, page[0], position);
				if (!isSemanticType(page[1], "nextjs.route.SearchParams", "SearchParams")) {
					fail("NXHX-PAGE-LAYOUT-METADATA-0008",
						'Page generateMetadata query type must remain nextjs.route.SearchParams because @:next.query types outbound href construction but does not decode URL input; found ${page[1].toString()}.',
						position);
				}
				return;
			}
		}
		final expected = kind == Page ? "MetadataProps<Params> or PageMetadataProps<Params, SearchParams>" : "MetadataProps<Params>";
		fail("NXHX-PAGE-LAYOUT-METADATA-0008",
			'${kindName(kind)} generateMetadata props must be nextjs.app.$expected so params remain Promise-shaped and layout-only values stay honest; found ${propsType.toString()}.',
			position);
	}

	static function validateGeneratedMetadata(type:ClassType, kind:PageLayoutKind, pattern:RoutePattern, field:Field):GeneratedMetadataMethod {
		if (!isStaticField(type, field)) {
			return fail("NXHX-PAGE-LAYOUT-METADATA-0008", '${ownerName(type)}.generateMetadata must be public static or module-level.', field.pos);
		}
		final method = switch field.kind {
			case FFun(value): value;
			case _: return fail("NXHX-PAGE-LAYOUT-METADATA-0008", '${ownerName(type)}.generateMetadata must be a function.', field.pos);
		};
		if (method.params.length != 0) {
			fail("NXHX-PAGE-LAYOUT-METADATA-0008", '${ownerName(type)}.generateMetadata must be non-generic.', field.pos);
		}
		if (method.args.length < 1 || method.args.length > 2) {
			fail("NXHX-PAGE-LAYOUT-METADATA-0008",
				'${fullTypeName(type)}.generateMetadata requires props and may optionally receive parent; found ${method.args.length} arguments.', field.pos);
		}
		for (argument in method.args) {
			if (argument.opt || argument.value != null) {
				fail("NXHX-PAGE-LAYOUT-METADATA-0008", 'generateMetadata argument "${argument.name}" must be required and have no default value.',
					argument.value == null ? field.pos : argument.value.pos);
			}
		}
		final propsType = requireNamedType(method.args[0].type, "NXHX-PAGE-LAYOUT-METADATA-0008", 'generateMetadata props argument "${method.args[0].name}"',
			field.pos);
		validateMetadataProps(type, kind, pattern, propsType, field.pos);
		if (method.args.length == 2) {
			final parentType = requireNamedType(method.args[1].type, "NXHX-PAGE-LAYOUT-METADATA-0008",
				'generateMetadata parent argument "${method.args[1].name}"', field.pos);
			if (!isSemanticType(parentType, "nextjs.raw.metadata.ResolvingMetadata", "ResolvingMetadata")) {
				fail("NXHX-PAGE-LAYOUT-METADATA-0008",
					'generateMetadata parent must be nextjs.raw.metadata.ResolvingMetadata; found ${parentType.toString()}.', field.pos);
			}
		}
		final returnType = requireNamedType(method.ret, "NXHX-PAGE-LAYOUT-METADATA-0008", "generateMetadata return", field.pos);
		final asynchronous = metadataReturn(returnType);
		if (asynchronous == null) {
			fail("NXHX-PAGE-LAYOUT-METADATA-0008",
				'generateMetadata must return nextjs.raw.metadata.Metadata or Promise<nextjs.raw.metadata.Metadata>; found ${returnType.toString()}.',
				field.pos);
		}
		return {field: field, asynchronous: asynchronous};
	}

	static function validateStaticParams(type:ClassType, pattern:RoutePattern, field:Field):StaticParamsMethod {
		if (!isStaticField(type, field)) {
			return fail("NXHX-PAGE-LAYOUT-STATIC-PARAMS-0009", '${ownerName(type)}.generateStaticParams must be public static or module-level.', field.pos);
		}
		if (pattern.parameters.length == 0) {
			return fail("NXHX-PAGE-LAYOUT-STATIC-PARAMS-0009",
				'${ownerName(type)}.generateStaticParams requires at least one dynamic route segment; route "${pattern.publicPath}" has none.', field.pos);
		}
		final method = switch field.kind {
			case FFun(value): value;
			case _: return fail("NXHX-PAGE-LAYOUT-STATIC-PARAMS-0009", '${ownerName(type)}.generateStaticParams must be a function.', field.pos);
		};
		if (method.params.length != 0 || method.args.length != 0) {
			fail("NXHX-PAGE-LAYOUT-STATIC-PARAMS-0009",
				'${fullTypeName(type)}.generateStaticParams must be a non-generic zero-argument function in the current declaration contract.', field.pos);
		}
		final returnType = requireNamedType(method.ret, "NXHX-PAGE-LAYOUT-STATIC-PARAMS-0009", "generateStaticParams return", field.pos);
		final result = staticParamsReturn(returnType);
		if (result == null) {
			return fail("NXHX-PAGE-LAYOUT-STATIC-PARAMS-0009",
				'generateStaticParams must return Array<Params> or Promise<Array<Params>>; found ${returnType.toString()}.', field.pos);
		}
		RouteParameterValidator.validate(pattern, result.paramsType, field.pos);
		return {field: field, asynchronous: result.asynchronous};
	}

	static function validateNamedFields(type:ClassType, kind:PageLayoutKind, pattern:RoutePattern, fields:Array<Field>):PageLayoutNamedFields {
		final label = kindName(kind);
		var metadataField:Null<Field> = null;
		var generatedMetadataField:Null<Field> = null;
		var staticParamsField:Null<Field> = null;
		var segmentField:Null<Field> = null;
		for (field in fields) {
			if (field.name == "render" || !isPublicField(type, field)) {
				continue;
			}
			switch field.name {
				case "metadata":
					metadataField = field;
				case "generateMetadata":
					generatedMetadataField = field;
				case "generateStaticParams":
					staticParamsField = field;
				case "segment":
					segmentField = field;
				case _:
					fail("NXHX-PAGE-LAYOUT-FIELD-0003",
						'Public $label field ${ownerName(type)}.${field.name} has no reviewed App Router export mapping; supported named fields are ${REVIEWED_NAMED_FIELDS.join(", ")}; make helpers private.',
						field.pos);
			}
		}
		if (metadataField != null && generatedMetadataField != null) {
			fail("NXHX-PAGE-LAYOUT-METADATA-0008",
				'${ownerName(type)} cannot export both metadata and generateMetadata; Next.js requires exactly one metadata source.',
				generatedMetadataField.pos);
		}
		final metadata = metadataField == null ? null : validateStaticMetadata(type, metadataField);
		final generateMetadata = generatedMetadataField == null ? null : validateGeneratedMetadata(type, kind, pattern, generatedMetadataField);
		final generateStaticParams = staticParamsField == null ? null : validateStaticParams(type, pattern, staticParamsField);
		final config = segmentField == null ? [] : SegmentConfigMacro.parse(segmentField, ownerName(type));
		return {
			fields: segmentField == null ? fields : fields.filter(field -> field.name != "segment"),
			metadata: metadata,
			generateMetadata: generateMetadata,
			generateStaticParams: generateStaticParams,
			config: config
		};
	}

	static function portableDefine(name:String, position:Position):Array<String> {
		final value = Context.definedValue(name);
		if (value == null || value == "" || value.indexOf("\\") != -1 || value.startsWith("/") || ~/^[A-Za-z]:/.match(value)) {
			return fail("NXHX-PAGE-LAYOUT-PATH-0002", 'Compiler define $name must be a portable project-relative path supplied by the NextJsHx CLI.', position);
		}
		final parts = value.split("/");
		if (parts.exists(part -> part == "" || part == "." || part == "..")) {
			return fail("NXHX-PAGE-LAYOUT-PATH-0002", 'Compiler define $name must not contain empty, current-directory, or parent-directory segments.',
				position);
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

	static function implementationAlias(symbol:String, kind:PageLayoutKind, asynchronous:Bool):Null<String> {
		final reserved = switch kind {
			case Page: ["PageProps", "JSX", "Metadata", "ResolvingMetadata"];
			case Layout: ["LayoutProps", "JSX", "Metadata", "ResolvingMetadata"];
		};
		if (asynchronous) {
			reserved.push("Promise");
		}
		if (!reserved.contains(symbol)) {
			return null;
		}
		var alias = 'NextJsHx${kindName(kind)}Implementation';
		while (reserved.contains(alias) || alias == symbol) {
			alias += "Type";
		}
		return alias;
	}

	static function hrefPattern(type:ClassType, pattern:RoutePattern, position:Position):ComplexType {
		final digest = Sha256.encode(fullTypeName(type)).substr(0, 16);
		final name = 'NextJsHxHrefPattern_$digest';
		final pack = ["nextjshx", "generated", "href"];
		final typeValue = RoutePatternType.typeScript(pattern);
		Context.defineType({
			pack: pack,
			name: name,
			pos: position,
			meta: [
				{name: ":ts.type", params: [{expr: EConst(CString(typeValue, DoubleQuotes)), pos: position}], pos: position},
				{name: ":noCompletion", params: [], pos: position}
			],
			params: [],
			isExtern: true,
			kind: TDClass(),
			fields: []
		});
		return TPath({pack: pack, name: name});
	}

	static function hrefReturnType(marker:ComplexType):ComplexType {
		return TPath({
			pack: ["nextjs", "route"],
			name: "RouteHref",
			params: [TPType(marker)]
		});
	}

	static function hrefWithQueryReturnType(marker:ComplexType):ComplexType {
		return TPath({
			pack: ["nextjs", "route"],
			name: "RouteHrefWithQuery",
			params: [TPType(marker)]
		});
	}

	static function hrefField(type:ClassType, pattern:RoutePattern, paramsType:Type, marker:ComplexType, position:Position):Field {
		final paramsComplex = paramsType.toComplexType();
		if (paramsComplex == null) {
			return fail("NXHX-PAGE-LAYOUT-PROPS-0005", 'Page params for ${fullTypeName(type)} cannot be represented in the generated href companion.',
				position);
		}
		final args:Array<FunctionArg> = pattern.parameters.length == 0 ? [] : [
			{
				name: "params",
				type: paramsComplex,
				opt: false
			}
		];
		final body = pattern.parameters.length == 0 ? macro nextjshx.route.RouteHrefMacro.build($v{pattern.filesystemPath}) : macro nextjshx.route.RouteHrefMacro.build($v{pattern.filesystemPath},
			params);
		return {
			name: "href",
			pos: position,
			access: [APublic, AStatic, AInline],
			kind: FFun({
				args: args,
				ret: hrefReturnType(marker),
				expr: macro return $body
			})
		};
	}

	static function hrefWithQueryField(type:ClassType, pattern:RoutePattern, paramsType:Type, query:PageQueryDeclaration, marker:ComplexType,
			position:Position):Field {
		final paramsComplex = paramsType.toComplexType();
		final queryComplex = query.schema.queryType.toComplexType();
		if (paramsComplex == null || queryComplex == null) {
			return fail("NXHX-ROUTE-QUERY-SCHEMA-0001",
				'Page params and query schema for ${fullTypeName(type)} must be representable in the generated hrefWithQuery companion.', query.metadata.pos);
		}
		final args:Array<FunctionArg> = [];
		if (pattern.parameters.length != 0) {
			args.push({name: "params", type: paramsComplex, opt: false});
		}
		args.push({name: "query", type: queryComplex, opt: false});
		final body = pattern.parameters.length == 0 ? macro nextjshx.route.RouteQueryMacro.build($v{pattern.filesystemPath},
			query) : macro nextjshx.route.RouteQueryMacro.build($v{pattern.filesystemPath}, params, query);
		return {
			name: "hrefWithQuery",
			pos: position,
			access: [APublic, AStatic, AInline],
			kind: FFun({
				args: args,
				ret: hrefWithQueryReturnType(marker),
				expr: macro return $body
			})
		};
	}

	static function metadataPropsSignature(kind:PageLayoutKind, pattern:RoutePattern):String {
		return kind == Page ? 'PageProps<"${pattern.publicPath}">' : 'Pick<LayoutProps<"${pattern.publicPath}">, "params">';
	}

	static function staticParamsType(kind:PageLayoutKind, pattern:RoutePattern):String {
		final props = kind == Page ? "PageProps" : "LayoutProps";
		return 'Array<Awaited<$props<"${pattern.publicPath}">["params"]>>';
	}

	/** Installs one build macro before application declarations are loaded. */
	public static function install():Void {
		if (installed) {
			return;
		}
		installed = true;
		Compiler.addGlobalMetadata("", "@:build(nextjshx.app.PageLayoutMacro.build())", true, true, false);
	}

	/** Types one page or layout declaration and records its closed adapter intent. */
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
			fail("NXHX-PAGE-LAYOUT-RENDER-0004", '${kindName(value.kind)} declaration ${fullTypeName(type)} must be non-generic.', type.pos);
		}
		final path = declarationPath(type, value);
		final pattern = RoutePatternMacro.parse(path, value.metadata.pos);
		final query = queryDeclaration(type, value);
		final render = renderField(type, value, pattern, fields);
		final named = validateNamedFields(type, value.kind, pattern, fields);
		final cache:Null<CacheDirectiveDeclaration> = CacheDirectiveMacro.modifier(type);
		if (cache != null) {
			if (!render.asynchronous) {
				fail("NXHX-CACHE-FUNCTION-0004",
					'Cached ${kindName(value.kind)} ${fullTypeName(type)}.render must declare @:async and return Promise<Element>; file-level cache directives require async function exports.',
					render.field.pos);
			}
			if (named.generateMetadata != null && !named.generateMetadata.asynchronous) {
				fail("NXHX-CACHE-FUNCTION-0004",
					'Cached ${kindName(value.kind)} ${fullTypeName(type)}.generateMetadata must declare @:async and return Promise<Metadata>.',
					named.generateMetadata.field.pos);
			}
			if (named.generateStaticParams != null && !named.generateStaticParams.asynchronous) {
				fail("NXHX-CACHE-FUNCTION-0004",
					'Cached ${kindName(value.kind)} ${fullTypeName(type)}.generateStaticParams must declare @:async and return Promise<Array<Params>>.',
					named.generateStaticParams.field.pos);
			}
		}
		if (value.ownerField == null) {
			if (!type.meta.has(":keep")) {
				type.meta.add(":keep", [], value.metadata.pos);
			}
		} else {
			for (field in [
				render.field,
				named.metadata,
				named.generateMetadata == null ? null : named.generateMetadata.field,
				named.generateStaticParams == null ? null : named.generateStaticParams.field
			]) {
				if (field != null && (field.meta == null || !field.meta.exists(entry -> entry.name == ":keep"))) {
					final metadata = field.meta == null ? [] : field.meta;
					metadata.push({name: ":keep", params: [], pos: value.metadata.pos});
					field.meta = metadata;
				}
			}
			markModuleFunction(render.field);
			if (named.generateMetadata != null) {
				markModuleFunction(named.generateMetadata.field);
			}
			if (named.generateStaticParams != null) {
				markModuleFunction(named.generateStaticParams.field);
			}
		}
		final modulePath = implementationModule(type, pattern, value.metadata.pos);
		final implementationSymbol = value.ownerField == null ? type.name : render.field.name;
		final alias = implementationAlias(implementationSymbol, value.kind, render.asynchronous);
		final nextKind = value.kind == Page ? AdapterKind.Page : AdapterKind.Layout;
		final convention = value.kind == Page ? "page.tsx" : "layout.tsx";
		final props = value.kind == Page ? "PageProps" : "LayoutProps";
		final result = '${render.asynchronous ? "Promise<" : ""}JSX.Element${render.asynchronous ? ">" : ""}';
		final imports = [
			new AdapterImport(modulePath, implementationSymbol, alias),
			new AdapterImport("react", "JSX", null, true)
		];
		if (value.ownerField != null) {
			for (field in [
				named.metadata,
				named.generateMetadata == null ? null : named.generateMetadata.field,
				named.generateStaticParams == null ? null : named.generateStaticParams.field
			]) {
				if (field != null) {
					final importAlias = switch field.name {
						case "generateMetadata": "NextJsHxGenerateMetadataImplementation";
						case "generateStaticParams": "NextJsHxGenerateStaticParamsImplementation";
						case _: null;
					};
					imports.push(new AdapterImport(modulePath, field.name, importAlias));
				}
			}
		}
		if (named.metadata != null || named.generateMetadata != null) {
			imports.push(new AdapterImport("next", "Metadata", null, true));
		}
		if (named.generateMetadata != null) {
			imports.push(new AdapterImport("next", "ResolvingMetadata", null, true));
		}
		final exports = [
			new AdapterExport(AdapterExportKind.Default, "default", render.field.name, '(props: $props<"${pattern.publicPath}">) => $result')
		];
		if (named.metadata != null) {
			exports.push(new AdapterExport(AdapterExportKind.Named, "metadata", named.metadata.name, "Metadata"));
		}
		if (named.generateMetadata != null) {
			final metadataResult = '${named.generateMetadata.asynchronous ? "Promise<" : ""}Metadata${named.generateMetadata.asynchronous ? ">" : ""}';
			exports.push(new AdapterExport(AdapterExportKind.Named, "generateMetadata", named.generateMetadata.field.name,
				'(props: ${metadataPropsSignature(value.kind, pattern)}, parent: ResolvingMetadata) => $metadataResult'));
		}
		if (named.generateStaticParams != null) {
			final paramsResult = staticParamsType(value.kind, pattern);
			final staticResult = named.generateStaticParams.asynchronous ? 'Promise<$paramsResult>' : paramsResult;
			exports.push(new AdapterExport(AdapterExportKind.Named, "generateStaticParams", named.generateStaticParams.field.name, '() => $staticResult'));
		}
		AdapterPlanRegistry.register({
			kind: nextKind,
			sourceType: ownerName(type),
			sourceField: render.field.name,
			typePosition: value.ownerField == null ? type.pos : render.field.pos,
			fieldPosition: render.field.pos,
			metadataPosition: value.metadata.pos,
			segmentPath: pattern.filesystemPath,
			targetPath: pattern.filesystemPath == "" ? convention : '${pattern.filesystemPath}/$convention',
			implementation: new AdapterImplementation(modulePath, implementationSymbol),
			imports: imports,
			directives: cache == null ? [] : [cache.directive],
			exports: exports,
			config: named.config
		});
		if (value.kind == Page) {
			final marker = hrefPattern(type, pattern, value.metadata.pos);
			named.fields.push(hrefField(type, pattern, render.paramsType, marker, value.metadata.pos));
			if (query != null) {
				named.fields.push(hrefWithQueryField(type, pattern, render.paramsType, query, marker, value.metadata.pos));
			}
		}
		return named.fields;
	}
	#end
}
