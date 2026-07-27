package nextjshx.cache;

#if macro
import haxe.crypto.Sha256;
import haxe.io.Bytes;
import haxe.io.Path;
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
import nextjshx.cache.CacheDirectiveMacro.CacheDirectiveDeclaration;

using StringTools;
using haxe.macro.TypeTools;
using Lambda;

private typedef CacheFunctionDeclaration = {
	final cache:CacheDirectiveDeclaration;
	final path:String;
}

private typedef CachedFunction = {
	final field:Field;
}

private typedef TypedCachedFunction = {
	final owner:ClassType;
	final field:ClassField;
}
#end

/** Validates cached functions and expands precise generated-boundary refs. */
class CacheFunctionMacro {
	#if macro
	public static inline final APP_ROOT_DEFINE:String = "nextjshx.app-root";
	public static inline final GENERATED_ROOT_DEFINE:String = "nextjshx.generated-root";

	static final PRIMARY_BOUNDARY_METADATA = [
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
		":next.shared",
		":next.serverOnly",
		":next.clientOnly"
	];
	static final RESERVED_CONVENTIONS = [
		"page",
		"layout",
		"loading",
		"error",
		"not-found",
		"route",
		"template",
		"default"
	];
	static var installed:Bool = false;

	static function fail<T>(code:String, message:String, position:Position):T {
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

	static function fullTypeName(type:ClassType):String {
		return type.pack.concat([type.name]).join(".");
	}

	static function metadataPath(type:ClassType, cache:CacheDirectiveDeclaration):String {
		if (cache.metadata.params.length != 1) {
			return fail("NXHX-CACHE-PATH-0003",
				'${cache.metadata.name} on standalone cache owner ${fullTypeName(type)} requires one extensionless string literal path. Use the zero-argument form only as a page/layout modifier.',
				cache.metadata.pos);
		}
		final value = switch cache.metadata.params[0].expr {
			case EConst(CString(path, _)): path;
			case _:
				return fail("NXHX-CACHE-PATH-0003",
					'${cache.metadata.name} on ${fullTypeName(type)} requires a compile-time string literal; expressions are not evaluated.',
					cache.metadata.params[0].pos);
		};
		if (value == "" || value.indexOf("\\") != -1 || Path.isAbsolute(value) || value.startsWith("/") || value.endsWith("/")) {
			return fail("NXHX-CACHE-PATH-0003", 'Cached-function path "$value" must be a non-empty slash-normalized relative path.',
				cache.metadata.params[0].pos);
		}
		final parts = value.split("/");
		if (parts.exists(part -> part == "" || part == "." || part == ".." || ~/[^A-Za-z0-9_.\-]/.match(part))) {
			return fail("NXHX-CACHE-PATH-0003", 'Cached-function path "$value" contains an unsafe or non-portable segment.', cache.metadata.params[0].pos);
		}
		final leaf = parts[parts.length - 1];
		if (~/(?i)\.(?:[cm]?[jt]sx?)$/.match(leaf)) {
			return fail("NXHX-CACHE-PATH-0003", 'Cached-function path "$value" must omit its generated file extension.', cache.metadata.params[0].pos);
		}
		if (RESERVED_CONVENTIONS.contains(leaf)) {
			return fail("NXHX-CACHE-PATH-0003", 'Cached-function path "$value" ends in reserved App Router convention name "$leaf".',
				cache.metadata.params[0].pos);
		}
		return parts.join("/");
	}

	static function declaration(type:ClassType):Null<CacheFunctionDeclaration> {
		final cache = CacheDirectiveMacro.find(type);
		if (cache == null) {
			return null;
		}
		final boundaries = type.meta.get().filter(entry -> PRIMARY_BOUNDARY_METADATA.contains(entry.name));
		if (boundaries.length > 0) {
			if (boundaries.length == 1 && [":next.page", ":next.layout"].contains(boundaries[0].name)) {
				CacheDirectiveMacro.modifier(type);
				return null;
			}
			return fail("NXHX-CACHE-METADATA-0002",
				'${fullTypeName(type)} combines ${cache.metadata.name} with incompatible boundary ${boundaries[0].name}. Cache functions own a standalone module; only pages/layouts accept a zero-argument cache modifier.',
				boundaries[0].pos);
		}
		return {cache: cache, path: metadataPath(type, cache)};
	}

	static function hasAccess(field:Field, access:Access):Bool {
		return field.access != null && field.access.contains(access);
	}

	static function hasAsyncMetadata(entries:Metadata):Bool {
		return entries.exists(entry -> entry.name == ":async" || entry.name == "async" || entry.name == ":jsAsync");
	}

	static function requireType(value:Null<ComplexType>, label:String, position:Position):Type {
		if (value == null) {
			return fail("NXHX-CACHE-FUNCTION-0004", '$label requires an explicit Haxe type annotation.', position);
		}
		return Context.resolveType(value, position);
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

	static function promiseResult(type:Type):Null<Type> {
		return switch resolveAliases(type) {
			case TInst(reference, [result]) if (reference.get().module == "js.lib.Promise" && reference.get().name == "Promise"): result;
			case _: null;
		};
	}

	static function validateFunction(type:ClassType, field:Field):CachedFunction {
		if (!hasAccess(field, APublic) || !hasAccess(field, AStatic)) {
			return fail("NXHX-CACHE-FUNCTION-0004", 'Cached function ${fullTypeName(type)}.${field.name} must be public static.', field.pos);
		}
		if (!~/^[a-z][A-Za-z0-9]*$/.match(field.name)) {
			return fail("NXHX-CACHE-FUNCTION-0004", 'Cached function name "${field.name}" must use lower-camel Haxe spelling.', field.pos);
		}
		for (entry in field.meta) {
			if (entry.name.startsWith(":next.")) {
				return fail("NXHX-CACHE-FUNCTION-0004",
					'Cached function ${fullTypeName(type)}.${field.name} uses unsupported field annotation @${entry.name.substr(1)}; the owner annotation caches every public function.',
					entry.pos);
			}
		}
		final method = switch field.kind {
			case FFun(value): value;
			case _:
				return fail("NXHX-CACHE-FUNCTION-0004", 'Public cache field ${fullTypeName(type)}.${field.name} must be a function.', field.pos);
		};
		if (method.params.length != 0) {
			return fail("NXHX-CACHE-FUNCTION-0004", 'Cached function ${fullTypeName(type)}.${field.name} must be non-generic.', field.pos);
		}
		if (!hasAsyncMetadata(field.meta)) {
			return fail("NXHX-CACHE-FUNCTION-0004",
				'Cached function ${fullTypeName(type)}.${field.name} must declare @:async so the generated directive belongs to an actual async function.',
				field.pos);
		}
		for (argument in method.args) {
			if (argument.opt || argument.value != null) {
				return fail("NXHX-CACHE-FUNCTION-0004", 'Cached function argument "${argument.name}" must be required and have no default value.',
					argument.value == null ? field.pos : argument.value.pos);
			}
			final argumentType = requireType(argument.type, 'Cached function argument "${argument.name}"', field.pos);
			CacheSerializableMacro.validateArgument(argumentType, 'argument "${argument.name}"', field.pos);
		}
		final returnType = requireType(method.ret, 'Cached function ${fullTypeName(type)}.${field.name} return', field.pos);
		final result = promiseResult(returnType);
		if (result == null) {
			return fail("NXHX-CACHE-FUNCTION-0004",
				'Cached function ${fullTypeName(type)}.${field.name} must explicitly return js.lib.Promise<Result>; found ${returnType.toString()}.',
				field.pos);
		}
		CacheSerializableMacro.validateResult(result, "result", field.pos);
		return {field: field};
	}

	static function portableDefine(name:String, position:Position):Array<String> {
		final value = Context.definedValue(name);
		if (value == null || value == "" || value.indexOf("\\") != -1 || value.startsWith("/") || ~/^[A-Za-z]:/.match(value)) {
			return fail("NXHX-CACHE-PATH-0003", 'Compiler define $name must be a portable project-relative path supplied by the NextJsHx CLI.', position);
		}
		final parts = value.split("/");
		if (parts.exists(part -> part == "" || part == "." || part == "..")) {
			return fail("NXHX-CACHE-PATH-0003", 'Compiler define $name must not contain empty, current-directory, or parent-directory segments.', position);
		}
		return parts;
	}

	static function relativeModule(from:Array<String>, to:Array<String>):String {
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

	static function targetPath(path:String):String {
		return '_nextjshx/cache/$path';
	}

	static function implementationModule(type:ClassType, path:String, position:Position):String {
		final target = targetPath(path);
		final directory = Path.directory(target);
		final from = portableDefine(APP_ROOT_DEFINE, position).concat(directory.split("/"));
		final to = portableDefine(GENERATED_ROOT_DEFINE, position).concat(type.module.split("."));
		return relativeModule(from, to);
	}

	static function adapterModule(caller:ClassType, path:String, position:Position):String {
		final callerParts = caller.module.split(".");
		callerParts.pop();
		final from = portableDefine(GENERATED_ROOT_DEFINE, position).concat(callerParts);
		final to = portableDefine(APP_ROOT_DEFINE, position).concat(targetPath(path).split("/"));
		return relativeModule(from, to);
	}

	static function implementationAlias(type:ClassType):Null<String> {
		return ["Awaited", "Parameters", "Promise", "ReturnType"].contains(type.name) ? "NextJsHxCacheImplementation" : null;
	}

	static function typedFunction(expression:Expr):TypedCachedFunction {
		final typed = Context.typeExpr(expression);
		final value:TypedCachedFunction = switch typed.expr {
			case TField(_, FStatic(owner, field)):
				{owner: owner.get(), field: field.get()};
			case _:
				return fail("NXHX-CACHE-REF-0007", "CacheFunction.ref requires one direct public static cached field.", expression.pos);
		};
		final declaration = declaration(value.owner);
		if (declaration == null) {
			return fail("NXHX-CACHE-REF-0007", '${fullTypeName(value.owner)} is not a standalone cached-function owner.', expression.pos);
		}
		if (!value.field.isPublic || !value.field.meta.has(":async") && !value.field.meta.has("async") && !value.field.meta.has(":jsAsync")) {
			return fail("NXHX-CACHE-REF-0007", '${fullTypeName(value.owner)}.${value.field.name} is not a validated public async cached function.',
				expression.pos);
		}
		switch resolveAliases(value.field.type) {
			case TFun(arguments, result):
				for (argument in arguments) {
					CacheSerializableMacro.validateArgument(argument.t, 'argument "${argument.name}"', value.field.pos);
				}
				final awaited = promiseResult(result);
				if (awaited == null) {
					return fail("NXHX-CACHE-REF-0007", '${fullTypeName(value.owner)}.${value.field.name} does not return Promise<Result>.', expression.pos);
				}
				CacheSerializableMacro.validateResult(awaited, "result", value.field.pos);
			case _:
				return fail("NXHX-CACHE-REF-0007", '${fullTypeName(value.owner)}.${value.field.name} is not a function.', expression.pos);
		}
		return value;
	}

	public static function install():Void {
		if (installed) {
			return;
		}
		installed = true;
		Compiler.addGlobalMetadata("", "@:build(nextjshx.cache.CacheFunctionMacro.build())", true, true, false);
	}

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
		if (type.isExtern || type.isInterface || type.params.length != 0) {
			return fail("NXHX-CACHE-FUNCTION-0004", 'Cached-function owner ${fullTypeName(type)} must be a concrete, non-generic class.', type.pos);
		}
		final functions:Array<CachedFunction> = [];
		for (field in fields) {
			if (!hasAccess(field, APublic)) {
				continue;
			}
			functions.push(validateFunction(type, field));
		}
		if (functions.length == 0) {
			return fail("NXHX-CACHE-FUNCTION-0004", 'Cached-function owner ${fullTypeName(type)} must expose at least one public static async function.',
				value.cache.metadata.pos);
		}
		functions.sort((left, right) -> compareString(left.field.name, right.field.name));
		if (!type.meta.has(":keep")) {
			type.meta.add(":keep", [], value.cache.metadata.pos);
		}
		final modulePath = implementationModule(type, value.path, value.cache.metadata.pos);
		final alias = implementationAlias(type);
		final implementationName = alias == null ? type.name : alias;
		final target = targetPath(value.path);
		AdapterPlanRegistry.register({
			kind: AdapterKind.CacheFunction,
			sourceType: fullTypeName(type),
			sourceField: functions[0].field.name,
			typePosition: type.pos,
			fieldPosition: functions[0].field.pos,
			metadataPosition: value.cache.metadata.pos,
			segmentPath: Path.directory(target),
			targetPath: target + ".ts",
			implementation: new AdapterImplementation(modulePath, type.name),
			imports: [new AdapterImport(modulePath, type.name, alias)],
			directives: [value.cache.directive],
			exports: [
				for (cached in functions)
					new AdapterExport(AdapterExportKind.Named, cached.field.name, cached.field.name,
						'(...args: Parameters<typeof $implementationName.${cached.field.name}>) => Promise<Awaited<ReturnType<typeof $implementationName.${cached.field.name}>>>')
			],
			config: []
		});
		return fields;
	}

	public static function reference(expression:Expr):Expr {
		final cached = typedFunction(expression);
		final value = declaration(cached.owner);
		if (value == null) {
			return fail("NXHX-CACHE-REF-0007", '${fullTypeName(cached.owner)} is not a cached-function owner.', expression.pos);
		}
		final callerReference = Context.getLocalClass();
		if (callerReference == null) {
			return fail("NXHX-CACHE-REF-0007", "CacheFunction.ref must be called from a Haxe class emitted by genes-ts.", expression.pos);
		}
		final specifier = adapterModule(callerReference.get(), value.path, expression.pos);
		final digest = Sha256.encode('${callerReference.get().module}\x00${fullTypeName(cached.owner)}\x00${cached.field.name}\x00${value.path}')
			.substr(0, 12);
		final imported = macro @:pos(expression.pos) genes.ts.Imports.namedImport($v{specifier}, $v{cached.field.name}, $v{'NextJsHxCacheFunction_$digest'});
		final functionType = cached.field.type.toComplexType();
		if (functionType == null) {
			return fail("NXHX-CACHE-REF-0007", 'Cannot preserve the precise type of ${fullTypeName(cached.owner)}.${cached.field.name}.', expression.pos);
		}
		return {expr: ECheckType(imported, functionType), pos: expression.pos};
	}
	#end
}
