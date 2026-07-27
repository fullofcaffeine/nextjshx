package nextjshx.server;

#if macro
import haxe.io.Bytes;
import haxe.macro.Compiler;
import haxe.macro.Context;
import haxe.macro.Expr;
import haxe.macro.Type;
import haxe.macro.Type.ClassType;
import nextjshx.adapter.AdapterConfig;
import nextjshx.adapter.AdapterConfig.AdapterConfigValue;
import nextjshx.adapter.AdapterExport;
import nextjshx.adapter.AdapterExport.AdapterExportKind;
import nextjshx.adapter.AdapterImplementation;
import nextjshx.adapter.AdapterImport;
import nextjshx.adapter.AdapterKind;
import nextjshx.adapter.AdapterPlanRegistry;

using StringTools;
using haxe.macro.TypeTools;
using Lambda;

private typedef ProxyDeclaration = {
	final metadata:MetadataEntry;
	final matchers:Array<String>;
}

private typedef ProxyMethod = {
	final field:Field;
}
#end

/** Validates one Haxe-first `proxy.ts` declaration and records its adapter. */
class ProxyMacro {
	#if macro
	public static inline final APP_ROOT_DEFINE:String = "nextjshx.app-root";
	public static inline final GENERATED_ROOT_DEFINE:String = "nextjshx.generated-root";

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

	static function matcherLiteral(value:Expr, owner:ClassType):String {
		final result = switch value.expr {
			case EConst(CString(text, _)): text;
			case _:
				return fail("NXHX-PROXY-MATCHER-0003",
					'@:next.matcher on ${fullTypeName(owner)} accepts compile-time string literals only; expressions are not evaluated.', value.pos);
		};
		if (!result.startsWith("/") || result.length > 512 || result != result.trim()) {
			return fail("NXHX-PROXY-MATCHER-0003", 'Proxy matcher "$result" must be slash-prefixed, trimmed, and at most 512 characters.', value.pos);
		}
		for (index in 0...result.length) {
			final code = StringTools.fastCodeAt(result, index);
			if (code < 32 || code == 127) {
				return fail("NXHX-PROXY-MATCHER-0003", "Proxy matcher literals must not contain control characters.", value.pos);
			}
		}
		return result;
	}

	static function declaration(type:ClassType):Null<ProxyDeclaration> {
		final proxies = type.meta.get().filter(entry -> entry.name == ":next.proxy");
		final matcherEntries = type.meta.get().filter(entry -> entry.name == ":next.matcher");
		if (proxies.length == 0) {
			if (matcherEntries.length > 0) {
				fail("NXHX-PROXY-MATCHER-0003", '@:next.matcher on ${fullTypeName(type)} requires the same type to declare @:next.proxy.',
					matcherEntries[0].pos);
			}
			return null;
		}
		final boundaries = type.meta.get().filter(entry -> BOUNDARY_METADATA.contains(entry.name));
		if (proxies.length != 1 || boundaries.length != 1) {
			final position = proxies.length > 1 ? proxies[1].pos : boundaries[1].pos;
			return fail("NXHX-PROXY-BOUNDARY-0001",
				'${fullTypeName(type)} must declare exactly one App Router boundary annotation; found ${boundaries.length}.', position);
		}
		final proxy = proxies[0];
		if (proxy.params.length != 0) {
			return fail("NXHX-PROXY-BOUNDARY-0001", '@:next.proxy on ${fullTypeName(type)} does not accept path or config arguments.', proxy.pos);
		}
		if (matcherEntries.length > 1) {
			return fail("NXHX-PROXY-MATCHER-0003", '@:next.matcher may appear at most once on ${fullTypeName(type)}.', matcherEntries[1].pos);
		}
		final matchers:Array<String> = [];
		if (matcherEntries.length == 1) {
			final matcher = matcherEntries[0];
			if (matcher.params.length == 0 || matcher.params.length > 256) {
				return fail("NXHX-PROXY-MATCHER-0003", '@:next.matcher on ${fullTypeName(type)} requires between one and 256 string literals.', matcher.pos);
			}
			for (parameter in matcher.params) {
				matchers.push(matcherLiteral(parameter, type));
			}
			matchers.sort(compareString);
			for (index in 1...matchers.length) {
				if (matchers[index - 1] == matchers[index]) {
					return fail("NXHX-PROXY-MATCHER-0003", 'Proxy matcher "${matchers[index]}" is duplicated.', matcher.pos);
				}
			}
		}
		return {metadata: proxy, matchers: matchers};
	}

	static function hasAccess(field:Field, access:Access):Bool {
		return field.access != null && field.access.contains(access);
	}

	static function isSemanticType(type:Type, module:String, name:String):Bool {
		return switch type {
			case TMono(reference): final value = reference.get(); value != null && isSemanticType(value, module, name);
			case TLazy(resolve): isSemanticType(resolve(), module, name);
			case TType(reference, parameters): final definition = reference.get(); (definition.module == module && definition.name == name) || isSemanticType(definition.type.applyTypeParameters(definition.params,
					parameters), module, name);
			case TAbstract(reference, parameters): final definition = reference.get(); definition.module == module && definition.name == name && parameters.length == definition.params.length;
			case TInst(reference, parameters): final definition = reference.get(); definition.module == module && definition.name == name && parameters.length == definition.params.length;
			case _: false;
		};
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

	static function isResponseClass(type:Type):Bool {
		return switch resolveAliases(type) {
			case TInst(reference, _):
				final definition = reference.get();
				if (definition.module == "nextjs.raw.server.WebResponse" && definition.name == "WebResponse") {
					true;
				} else if (definition.superClass != null) {
					final parent = definition.superClass;
					isResponseClass(TInst(parent.t, parent.params));
				} else {
					false;
				}
			case _: false;
		};
	}

	static function isSynchronousResult(type:Type):Bool {
		if (isSemanticType(type, "nextjs.raw.server.NextMiddleware", "NextMiddlewareResult")
			|| isSemanticType(type, "nextjs.proxy.ProxyResponse", "ProxyResponse")
			|| isResponseClass(type)) {
			return true;
		}
		return switch resolveAliases(type) {
			case TAbstract(reference, [inner]) if (reference.get().module == "StdTypes" && reference.get().name == "Null"):
				isResponseClass(inner);
			case _: false;
		};
	}

	static function isProxyReturn(type:Type):Bool {
		if (isSemanticType(type, "nextjs.raw.server.NextMiddleware", "NextMiddlewareReturn") || isSynchronousResult(type)) {
			return true;
		}
		return switch resolveAliases(type) {
			case TInst(reference, [result]) if (reference.get().module == "js.lib.Promise" && reference.get().name == "Promise"):
				isSynchronousResult(result);
			case _: false;
		};
	}

	static function requireType(type:Null<ComplexType>, label:String, position:Position):Type {
		if (type == null) {
			return fail("NXHX-PROXY-SIGNATURE-0004", '$label requires an explicit Haxe type annotation.', position);
		}
		return Context.resolveType(type, position);
	}

	static function proxyMethod(type:ClassType, fields:Array<Field>):ProxyMethod {
		final methods = fields.filter(field -> field.name == "proxy");
		if (methods.length != 1) {
			return fail("NXHX-PROXY-FUNCTION-0002",
				'Proxy declaration ${fullTypeName(type)} must expose exactly one public static proxy function; found ${methods.length}.', type.pos);
		}
		final field = methods[0];
		if (!hasAccess(field, APublic) || !hasAccess(field, AStatic)) {
			return fail("NXHX-PROXY-FUNCTION-0002", 'Proxy function ${fullTypeName(type)}.proxy must be public static.', field.pos);
		}
		final method = switch field.kind {
			case FFun(value): value;
			case _:
				return fail("NXHX-PROXY-FUNCTION-0002", 'Proxy field ${fullTypeName(type)}.proxy must be a function.', field.pos);
		};
		if (method.params.length != 0 || method.args.length < 1 || method.args.length > 2) {
			return fail("NXHX-PROXY-SIGNATURE-0004",
				'${fullTypeName(type)}.proxy must be non-generic and accept a NextRequest plus an optional second NextFetchEvent argument.', field.pos);
		}
		for (argument in method.args) {
			if (argument.opt || argument.value != null) {
				return fail("NXHX-PROXY-SIGNATURE-0004", 'Proxy argument "${argument.name}" must be required and have no default value.', field.pos);
			}
		}
		final requestType = requireType(method.args[0].type, 'Proxy request argument "${method.args[0].name}"', field.pos);
		if (!isSemanticType(requestType, "nextjs.proxy.ProxyRequest", "ProxyRequest")
			&& !isSemanticType(requestType, "nextjs.raw.server.NextRequest", "NextRequest")) {
			return fail("NXHX-PROXY-SIGNATURE-0004",
				'Proxy request must be nextjs.proxy.ProxyRequest or raw nextjs.raw.server.NextRequest; found ${requestType.toString()}.', field.pos);
		}
		if (method.args.length == 2) {
			final eventType = requireType(method.args[1].type, 'Proxy event argument "${method.args[1].name}"', field.pos);
			if (!isSemanticType(eventType, "nextjs.raw.server.NextFetchEvent", "NextFetchEvent")) {
				return fail("NXHX-PROXY-SIGNATURE-0004", 'Proxy event must be nextjs.raw.server.NextFetchEvent; found ${eventType.toString()}.', field.pos);
			}
		}
		final returnType = requireType(method.ret, "Proxy return", field.pos);
		if (!isProxyReturn(returnType)) {
			return fail("NXHX-PROXY-RETURN-0005",
				'Proxy return must be ProxyResponse, WebResponse, NextResponse, NextMiddlewareResult, or a supported Promise form; found ${returnType.toString()}.',
				field.pos);
		}
		return {field: field};
	}

	static function validatePublicFields(type:ClassType, fields:Array<Field>):Void {
		for (field in fields) {
			if (field.name == "proxy" || !hasAccess(field, APublic)) {
				continue;
			}
			fail("NXHX-PROXY-FIELD-0006",
				'Public proxy field ${fullTypeName(type)}.${field.name} has no reviewed proxy.ts export mapping; make helpers private.', field.pos);
		}
	}

	static function portableDefine(name:String, position:Position):Array<String> {
		final value = Context.definedValue(name);
		if (value == null || value == "" || value.indexOf("\\") != -1 || value.startsWith("/") || ~/^[A-Za-z]:/.match(value)) {
			return fail("NXHX-PROXY-PATH-0007", 'Compiler define $name must be a portable project-relative path supplied by the NextJsHx CLI.', position);
		}
		final parts = value.split("/");
		if (parts.exists(part -> part == "" || part == "." || part == "..")) {
			return fail("NXHX-PROXY-PATH-0007", 'Compiler define $name must not contain empty, current-directory, or parent-directory segments.', position);
		}
		return parts;
	}

	static function implementationModule(type:ClassType, position:Position):String {
		final appRoot = portableDefine(APP_ROOT_DEFINE, position);
		if (appRoot[appRoot.length - 1] != "app") {
			return fail("NXHX-PROXY-PATH-0007", 'Compiler define $APP_ROOT_DEFINE must end in app for Next proxy discovery.', position);
		}
		final from = appRoot.slice(0, appRoot.length - 1);
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

	static function implementationAlias(type:ClassType):Null<String> {
		final reserved = ["NextJsHxProxy", "NextJsHxProxyConfig", "proxy", "config"];
		return reserved.contains(type.name) ? "NextJsHxProxyImplementation" : null;
	}

	/** Installs proxy validation before application declarations are loaded. */
	public static function install():Void {
		if (installed) {
			return;
		}
		installed = true;
		Compiler.addGlobalMetadata("", "@:build(nextjshx.server.ProxyMacro.build())", true, true, false);
	}

	/** Types one proxy declaration and records its closed root adapter intent. */
	public static function build():Array<Field> {
		final fields = Context.getBuildFields();
		final localClass = Context.getLocalClass();
		if (localClass == null) {
			return fields;
		}
		final type = localClass.get();
		final value = declaration(type);
		if (value == null) {
			return fields;
		}
		if (type.params.length != 0) {
			fail("NXHX-PROXY-FUNCTION-0002", 'Proxy declaration ${fullTypeName(type)} must be non-generic.', type.pos);
		}
		final method = proxyMethod(type, fields);
		validatePublicFields(type, fields);
		if (!type.meta.has(":keep")) {
			type.meta.add(":keep", [], value.metadata.pos);
		}
		final modulePath = implementationModule(type, value.metadata.pos);
		final imports = [
			new AdapterImport(modulePath, type.name, implementationAlias(type)),
			new AdapterImport("next/server", "NextProxy", "NextJsHxProxy", true)
		];
		final config:Array<AdapterConfig> = [];
		if (value.matchers.length > 0) {
			imports.push(new AdapterImport("next/server", "ProxyConfig", "NextJsHxProxyConfig", true));
			final matcherValue = value.matchers.length == 1 ? AdapterConfigValue.StringValue(value.matchers[0]) : AdapterConfigValue.StringArrayValue(value.matchers);
			config.push(new AdapterConfig("matcher", matcherValue));
		}
		AdapterPlanRegistry.register({
			kind: AdapterKind.Proxy,
			sourceType: fullTypeName(type),
			sourceField: method.field.name,
			typePosition: type.pos,
			fieldPosition: method.field.pos,
			metadataPosition: value.metadata.pos,
			segmentPath: "",
			targetPath: "proxy.ts",
			implementation: new AdapterImplementation(modulePath, type.name),
			imports: imports,
			directives: [],
			exports: [
				new AdapterExport(AdapterExportKind.Named, "proxy", method.field.name, "NextJsHxProxy")
			],
			config: config
		});
		return fields;
	}
	#end
}
