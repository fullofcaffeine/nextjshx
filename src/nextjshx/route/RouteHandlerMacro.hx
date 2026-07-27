package nextjshx.route;

#if macro
import haxe.crypto.Sha256;
import haxe.io.Bytes;
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

using StringTools;
using haxe.macro.TypeTools;
using Lambda;

private typedef RouteMethod = {
	final httpName:String;
	final field:Field;
	final metadata:MetadataEntry;
	final asynchronous:Bool;
	final paramsType:Type;
}
#end

/** Validates `@:next.route` declarations and registers native `route.ts` exports. */
class RouteHandlerMacro {
	#if macro
	public static inline final APP_ROOT_DEFINE:String = "nextjshx.app-root";
	public static inline final GENERATED_ROOT_DEFINE:String = "nextjshx.generated-root";

	static final HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];
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

	static function fail(code:String, message:String, position:Position):Dynamic {
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

	static function metadata(type:ClassType, name:String):Array<MetadataEntry> {
		return type.meta.get().filter(entry -> entry.name == name);
	}

	static function routeMetadata(type:ClassType):Null<MetadataEntry> {
		final routes = metadata(type, ":next.route");
		if (routes.length == 0) {
			return null;
		}
		final boundaries = type.meta.get().filter(entry -> BOUNDARY_METADATA.contains(entry.name));
		if (boundaries.length != 1 || routes.length != 1) {
			final position = boundaries.length > 1 ? boundaries[1].pos : routes[1].pos;
			fail("NXHX-ROUTE-HANDLER-BOUNDARY-0001",
				'Route Handler ${fullTypeName(type)} must declare exactly one App Router boundary annotation; found ${boundaries.length}.', position);
		}
		return routes[0];
	}

	static function routePath(entry:MetadataEntry, type:ClassType):String {
		if (entry.params.length != 1) {
			return fail("NXHX-ROUTE-HANDLER-PATH-0001", '@:next.route on ${fullTypeName(type)} requires exactly one App-Router-root-relative string literal.',
				entry.pos);
		}
		return switch entry.params[0].expr {
			case EConst(CString(value, _)): value;
			case _:
				fail("NXHX-ROUTE-HANDLER-PATH-0001",
					'@:next.route on ${fullTypeName(type)} requires a compile-time string literal; expressions are not evaluated.', entry.params[0].pos);
		};
	}

	static function fullTypeName(type:ClassType):String {
		return type.pack.concat([type.name]).join(".");
	}

	static function hasAccess(field:Field, access:Access):Bool {
		return field.access != null && field.access.contains(access);
	}

	static function methodMetadata(field:Field):Array<MetadataEntry> {
		final result:Array<MetadataEntry> = [];
		for (entry in field.meta) {
			if (HTTP_METHODS.contains(entry.name.substr(6))) {
				result.push(entry);
			} else if (entry.name.startsWith(":next.")) {
				fail("NXHX-ROUTE-HANDLER-METHOD-0002",
					'Route Handler field "${field.name}" uses unsupported method annotation @${entry.name.substr(1)}; supported methods are ${HTTP_METHODS.join(", ")}.',
					entry.pos);
			}
		}
		return result;
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

	static function classIdentity(type:ClassType):String {
		return '${type.module}.${type.name}';
	}

	static function isRequest(type:Type):Bool {
		return switch resolveAliases(type) {
			case TInst(reference, parameters): final identity = classIdentity(reference.get()); parameters.length == 0 && (identity == "nextjs.raw.server.WebRequest.WebRequest"
					|| identity == "nextjs.raw.server.NextRequest.NextRequest");
			case _: false;
		};
	}

	static function routeContextParams(type:Type):Null<Type> {
		return switch type {
			case TMono(reference):
				final value = reference.get();
				value == null ? null : routeContextParams(value);
			case TLazy(resolve): routeContextParams(resolve());
			case TType(reference, parameters):
				final definition = reference.get();
				if (definition.module == "nextjs.route.RouteContext" && definition.name == "RouteContext" && parameters.length == 1) {
					parameters[0];
				} else {
					routeContextParams(definition.type.applyTypeParameters(definition.params, parameters));
				}
			case _: null;
		};
	}

	static function responseClass(type:Type):Null<ClassType> {
		return switch resolveAliases(type) {
			case TInst(reference, _): reference.get();
			case _: null;
		};
	}

	static function isResponse(type:Type):Bool {
		var current = responseClass(type);
		while (current != null) {
			if (classIdentity(current) == "nextjs.raw.server.WebResponse.WebResponse") {
				return true;
			}
			current = current.superClass == null ? null : current.superClass.t.get();
		}
		return false;
	}

	static function responseReturn(type:Type):Null<Bool> {
		if (isResponse(type)) {
			return false;
		}
		return switch resolveAliases(type) {
			case TInst(reference, [result]) if (reference.get().module == "js.lib.Promise"
				&& reference.get().name == "Promise"
				&& isResponse(result)): true;
			case _: null;
		};
	}

	static function requireType(type:Null<ComplexType>, label:String, position:Position):Type {
		if (type == null) {
			return fail("NXHX-ROUTE-HANDLER-TYPE-0003", '$label requires an explicit Haxe type annotation.', position);
		}
		return Context.resolveType(type, position);
	}

	static function validateMethod(type:ClassType, pattern:RoutePattern, field:Field, entry:MetadataEntry):RouteMethod {
		if (entry.params.length != 0) {
			fail("NXHX-ROUTE-HANDLER-METHOD-0002", '@${entry.name.substr(1)} on ${fullTypeName(type)}.${field.name} does not accept arguments.', entry.pos);
		}
		if (!hasAccess(field, APublic) || !hasAccess(field, AStatic)) {
			fail("NXHX-ROUTE-HANDLER-METHOD-0002", 'Route Handler method ${fullTypeName(type)}.${field.name} must be public static.', field.pos);
		}
		if (!~/^[a-z][A-Za-z0-9]*$/.match(field.name)) {
			fail("NXHX-ROUTE-HANDLER-METHOD-0002",
				'Route Handler method "${field.name}" must use a lower-camel Haxe name; the annotation supplies the uppercase HTTP export.', field.pos);
		}
		final method = switch field.kind {
			case FFun(value): value;
			case _:
				return fail("NXHX-ROUTE-HANDLER-METHOD-0002", '@${entry.name.substr(1)} may annotate only a function.', field.pos);
		};
		if (method.params.length != 0) {
			fail("NXHX-ROUTE-HANDLER-TYPE-0003", 'Route Handler method ${fullTypeName(type)}.${field.name} must be non-generic.', field.pos);
		}
		if (method.args.length != 2) {
			fail("NXHX-ROUTE-HANDLER-TYPE-0003",
				'Route Handler method ${fullTypeName(type)}.${field.name} requires exactly (request, context); found ${method.args.length} arguments.',
				field.pos);
		}
		for (argument in method.args) {
			if (argument.opt || argument.value != null) {
				fail("NXHX-ROUTE-HANDLER-TYPE-0003", 'Route Handler argument "${argument.name}" must be required and have no default value.',
					argument.value == null ? field.pos : argument.value.pos);
			}
		}

		final requestType = requireType(method.args[0].type, 'Route Handler request argument "${method.args[0].name}"', field.pos);
		if (!isRequest(requestType)) {
			fail("NXHX-ROUTE-HANDLER-REQUEST-0004",
				'Route Handler request argument must be nextjs.raw.server.WebRequest or NextRequest; found ${requestType.toString()}.', field.pos);
		}
		final contextType = requireType(method.args[1].type, 'Route Handler context argument "${method.args[1].name}"', field.pos);
		final paramsType = routeContextParams(contextType);
		if (paramsType == null) {
			fail("NXHX-ROUTE-HANDLER-CONTEXT-0005",
				'Route Handler context must be nextjs.route.RouteContext<Params> so params remain Promise-shaped; found ${contextType.toString()}.', field.pos);
		}
		RouteParameterValidator.validate(pattern, paramsType, field.pos);

		final returnType = requireType(method.ret, 'Route Handler ${entry.name.substr(6)} return', field.pos);
		final asynchronous = responseReturn(returnType);
		if (asynchronous == null) {
			fail("NXHX-ROUTE-HANDLER-RESPONSE-0006",
				'Route Handler ${entry.name.substr(6)} must return WebResponse, NextResponse, or Promise of one; found ${returnType.toString()}.', field.pos);
		}
		return {
			httpName: entry.name.substr(6),
			field: field,
			metadata: entry,
			asynchronous: asynchronous,
			paramsType: paramsType
		};
	}

	static function hrefPattern(type:ClassType, pattern:RoutePattern, position:Position):ComplexType {
		final digest = Sha256.encode(fullTypeName(type)).substr(0, 16);
		final name = 'NextJsHxRouteHandlerPattern_$digest';
		final pack = ["nextjshx", "generated", "route_handler_href"];
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
			name: "RouteHandlerHref",
			params: [TPType(marker)]
		});
	}

	static function hrefField(type:ClassType, pattern:RoutePattern, paramsType:Type, marker:ComplexType, position:Position):Field {
		final paramsComplex = paramsType.toComplexType();
		if (paramsComplex == null) {
			return fail("NXHX-ROUTE-HANDLER-TYPE-0003",
				'Route Handler params for ${fullTypeName(type)} cannot be represented in the generated href companion.', position);
		}
		final args:Array<FunctionArg> = pattern.parameters.length == 0 ? [] : [{name: "params", type: paramsComplex, opt: false}];
		final body = pattern.parameters.length == 0 ? macro nextjshx.route.RouteHrefMacro.buildHandler($v{pattern.filesystemPath}) : macro nextjshx.route.RouteHrefMacro.buildHandler($v{pattern.filesystemPath},
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

	static function portableDefine(name:String, position:Position):Array<String> {
		final value = Context.definedValue(name);
		if (value == null || value == "" || value.indexOf("\\") != -1 || value.startsWith("/") || ~/^[A-Za-z]:/.match(value)) {
			return fail("NXHX-ROUTE-HANDLER-PATH-0007", 'Compiler define $name must be a portable project-relative path supplied by the NextJsHx CLI.',
				position);
		}
		final parts = value.split("/");
		if (parts.exists(part -> part == "" || part == "." || part == "..")) {
			return fail("NXHX-ROUTE-HANDLER-PATH-0007", 'Compiler define $name must not contain empty, current-directory, or parent-directory segments.',
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

	static function requestImportAlias(symbol:String):String {
		var alias = "NextJsHxRouteRequest";
		while (alias == symbol) {
			alias += "Type";
		}
		return alias;
	}

	static function implementationImportAlias(symbol:String, requestAlias:String):Null<String> {
		if (symbol != "RouteContext" && symbol != "Promise" && symbol != requestAlias) {
			return null;
		}
		var alias = "NextJsHxRouteImplementation";
		while (alias == symbol || alias == requestAlias || alias == "RouteContext" || alias == "Promise") {
			alias += "Type";
		}
		return alias;
	}

	/** Installs one build macro before application declarations are loaded. */
	public static function install():Void {
		if (installed) {
			return;
		}
		installed = true;
		Compiler.addGlobalMetadata("", "@:build(nextjshx.route.RouteHandlerMacro.build())", true, true, false);
	}

	/** Types one annotated class and records its closed adapter intent. */
	public static function build():Array<Field> {
		final fields = Context.getBuildFields();
		final localClass = Context.getLocalClass();
		if (localClass == null) {
			return fields;
		}
		final type = localClass.get();
		final declaration = routeMetadata(type);
		if (declaration == null) {
			return fields;
		}
		if (type.params.length != 0) {
			fail("NXHX-ROUTE-HANDLER-TYPE-0003", 'Route Handler declaration ${fullTypeName(type)} must be non-generic.', type.pos);
		}
		final path = routePath(declaration, type);
		final pattern = RoutePatternMacro.parse(path, declaration.pos);
		if (pattern.topology != RouteTopologyKind.Canonical) {
			fail("NXHX-ROUTE-HANDLER-PATH-0001",
				'Route Handler ${fullTypeName(type)} may use URL-elided route groups, but parallel slots and intercepted views are UI topology rather than request endpoint ownership.',
				declaration.pos);
		}
		final methods:Array<RouteMethod> = [];
		final byHttp = new Map<String, RouteMethod>();
		for (field in fields) {
			final annotations = methodMetadata(field);
			if (annotations.length == 0) {
				if (hasAccess(field, APublic)) {
					fail("NXHX-ROUTE-HANDLER-METHOD-0002",
						'Public Route Handler field ${fullTypeName(type)}.${field.name} must declare exactly one supported HTTP method annotation or be private.',
						field.pos);
				}
				continue;
			}
			if (annotations.length != 1) {
				fail("NXHX-ROUTE-HANDLER-METHOD-0002",
					'Route Handler field ${fullTypeName(type)}.${field.name} declares ${annotations.length} HTTP method annotations; exactly one is required.',
					annotations[1].pos);
			}
			final method = validateMethod(type, pattern, field, annotations[0]);
			final previous = byHttp.get(method.httpName);
			if (previous != null) {
				fail("NXHX-ROUTE-HANDLER-DUPLICATE-0008",
					'Route Handler ${fullTypeName(type)} exports ${method.httpName} from both "${previous.field.name}" and "${field.name}"; each HTTP method may be exported once.',
					method.metadata.pos);
			}
			byHttp.set(method.httpName, method);
			methods.push(method);
		}
		if (methods.length == 0) {
			fail("NXHX-ROUTE-HANDLER-METHOD-0002", 'Route Handler ${fullTypeName(type)} must export at least one supported HTTP method.', declaration.pos);
		}
		methods.sort((left, right) -> compareString(left.httpName, right.httpName));
		final marker = hrefPattern(type, pattern, declaration.pos);
		fields.push(hrefField(type, pattern, methods[0].paramsType, marker, declaration.pos));
		if (!type.meta.has(":keep")) {
			type.meta.add(":keep", [], declaration.pos);
		}
		final modulePath = implementationModule(type, pattern, declaration.pos);
		final requestAlias = requestImportAlias(type.name);
		final implementationAlias = implementationImportAlias(type.name, requestAlias);
		AdapterPlanRegistry.register({
			kind: AdapterKind.RouteHandler,
			sourceType: fullTypeName(type),
			sourceField: methods[0].field.name,
			typePosition: type.pos,
			fieldPosition: methods[0].field.pos,
			metadataPosition: declaration.pos,
			segmentPath: pattern.filesystemPath,
			targetPath: pattern.filesystemPath == "" ? "route.ts" : '${pattern.filesystemPath}/route.ts',
			implementation: new AdapterImplementation(modulePath, type.name),
			imports: [
				new AdapterImport(modulePath, type.name, implementationAlias),
				new AdapterImport("next/server", "NextRequest", requestAlias, true)
			],
			directives: [],
			exports: [
				for (method in methods)
					new AdapterExport(AdapterExportKind.Named, method.httpName, method.field.name,
						'(request: $requestAlias, context: RouteContext<"${pattern.publicPath}">) => ${method.asynchronous ? "Promise<globalThis.Response>" : "globalThis.Response"}')
			],
			config: []
		});
		return fields;
	}
	#end
}
