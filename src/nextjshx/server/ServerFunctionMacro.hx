package nextjshx.server;

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
import nextjshx.boundary.EnvironmentBoundaryMacro;

using StringTools;
using haxe.macro.TypeTools;
using Lambda;

private typedef ServerFunctionDeclaration = {
	final metadata:MetadataEntry;
	final path:String;
}

private typedef ServerAction = {
	final field:Field;
}

private typedef TypedServerAction = {
	final owner:ClassType;
	final field:ClassField;
}
#end

/** Validates native Server Functions and expands precise generated action refs. */
class ServerFunctionMacro {
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

	static function metadataPath(type:ClassType, metadata:MetadataEntry):String {
		if (metadata.params.length != 1) {
			return fail("NXHX-SERVER-FUNCTION-PATH-0002",
				'@:next.serverFunctions on ${fullTypeName(type)} requires one App-Router-root-relative extensionless string literal.', metadata.pos);
		}
		final value = switch metadata.params[0].expr {
			case EConst(CString(path, _)): path;
			case _:
				return fail("NXHX-SERVER-FUNCTION-PATH-0002",
					'@:next.serverFunctions on ${fullTypeName(type)} requires a compile-time string literal; expressions are not evaluated.',
					metadata.params[0].pos);
		};
		if (value == "" || value.indexOf("\\") != -1 || Path.isAbsolute(value) || value.startsWith("/") || value.endsWith("/")) {
			return fail("NXHX-SERVER-FUNCTION-PATH-0002", 'Server Function adapter path "$value" must be a non-empty slash-normalized relative path.',
				metadata.params[0].pos);
		}
		final parts = value.split("/");
		if (parts.exists(part -> part == "" || part == "." || part == ".." || ~/[^A-Za-z0-9_@()+.\-]/.match(part))) {
			return fail("NXHX-SERVER-FUNCTION-PATH-0002", 'Server Function adapter path "$value" contains an unsafe or non-portable segment.',
				metadata.params[0].pos);
		}
		final leaf = parts[parts.length - 1];
		if (~/(?i)\.(?:[cm]?[jt]sx?)$/.match(leaf)) {
			return fail("NXHX-SERVER-FUNCTION-PATH-0002", 'Server Function adapter path "$value" must omit its generated file extension.',
				metadata.params[0].pos);
		}
		if (RESERVED_CONVENTIONS.contains(leaf)) {
			return fail("NXHX-SERVER-FUNCTION-PATH-0002",
				'Server Function adapter path "$value" would collide with Next App Router convention file $leaf.tsx. Choose an action-specific filename.',
				metadata.params[0].pos);
		}
		return parts.join("/");
	}

	static function declaration(type:ClassType):Null<ServerFunctionDeclaration> {
		final values = type.meta.get().filter(entry -> entry.name == ":next.serverFunctions");
		if (values.length == 0) {
			return null;
		}
		final boundaries = type.meta.get().filter(entry -> BOUNDARY_METADATA.contains(entry.name));
		if (values.length != 1 || boundaries.length != 1) {
			final position = values.length > 1 ? values[1].pos : boundaries[1].pos;
			return fail("NXHX-SERVER-FUNCTION-BOUNDARY-0001",
				'${fullTypeName(type)} must declare exactly one App Router boundary annotation; found ${boundaries.length}.', position);
		}
		return {metadata: values[0], path: metadataPath(type, values[0])};
	}

	static function hasAccess(field:Field, access:Access):Bool {
		return field.access != null && field.access.contains(access);
	}

	static function actionMetadata(field:Field):Array<MetadataEntry> {
		final result:Array<MetadataEntry> = [];
		for (entry in field.meta) {
			if (entry.name == ":next.action") {
				result.push(entry);
			} else if (entry.name.startsWith(":next.")) {
				fail("NXHX-SERVER-FUNCTION-EXPORT-0003",
					'Server Function field "${field.name}" uses unsupported annotation @${entry.name.substr(1)}; only @:next.action selects an export.',
					entry.pos);
			}
		}
		return result;
	}

	static function hasAsyncMetadata(entries:Metadata):Bool {
		return entries.exists(entry -> entry.name == ":async" || entry.name == "async" || entry.name == ":jsAsync");
	}

	static function requireType(value:Null<ComplexType>, label:String, position:Position):Type {
		if (value == null) {
			return fail("NXHX-SERVER-FUNCTION-TYPE-0004", '$label requires an explicit Haxe type annotation.', position);
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

	static function validateAction(type:ClassType, field:Field, metadata:MetadataEntry):ServerAction {
		if (metadata.params.length != 0) {
			return fail("NXHX-SERVER-FUNCTION-EXPORT-0003", '@:next.action on ${fullTypeName(type)}.${field.name} does not accept arguments.', metadata.pos);
		}
		if (!hasAccess(field, APublic) || !hasAccess(field, AStatic)) {
			return fail("NXHX-SERVER-FUNCTION-EXPORT-0003", 'Server Function ${fullTypeName(type)}.${field.name} must be public static.', field.pos);
		}
		if (!~/^[a-z][A-Za-z0-9]*$/.match(field.name)) {
			return fail("NXHX-SERVER-FUNCTION-EXPORT-0003", 'Server Function name "${field.name}" must use lower-camel Haxe spelling.', field.pos);
		}
		final method = switch field.kind {
			case FFun(value): value;
			case _:
				return fail("NXHX-SERVER-FUNCTION-EXPORT-0003", '@:next.action may annotate only a function.', field.pos);
		};
		if (method.params.length != 0) {
			return fail("NXHX-SERVER-FUNCTION-TYPE-0004", 'Server Function ${fullTypeName(type)}.${field.name} must be non-generic.', field.pos);
		}
		if (!hasAsyncMetadata(field.meta)) {
			return fail("NXHX-SERVER-FUNCTION-ASYNC-0004",
				'Server Function ${fullTypeName(type)}.${field.name} must declare @:async so the emitted export is an actual async function.', field.pos);
		}
		for (argument in method.args) {
			if (argument.opt || argument.value != null) {
				return fail("NXHX-SERVER-FUNCTION-TYPE-0004", 'Server Function argument "${argument.name}" must be required and have no default value.',
					argument.value == null ? field.pos : argument.value.pos);
			}
			final argumentType = requireType(argument.type, 'Server Function argument "${argument.name}"', field.pos);
			ServerFunctionSerializableMacro.validateArgument(argumentType, 'argument "${argument.name}"', field.pos);
		}
		final returnType = requireType(method.ret, 'Server Function ${fullTypeName(type)}.${field.name} return', field.pos);
		final result = promiseResult(returnType);
		if (result == null) {
			return fail("NXHX-SERVER-FUNCTION-ASYNC-0004",
				'Server Function ${fullTypeName(type)}.${field.name} must explicitly return js.lib.Promise<Result>; found ${returnType.toString()}.',
				field.pos);
		}
		ServerFunctionSerializableMacro.validateResult(result, "result", field.pos);
		return {field: field};
	}

	static function portableDefine(name:String, code:String, position:Position):Array<String> {
		final value = Context.definedValue(name);
		if (value == null || value == "" || value.indexOf("\\") != -1 || value.startsWith("/") || ~/^[A-Za-z]:/.match(value)) {
			return fail(code, 'Compiler define $name must be a portable project-relative path supplied by the NextJsHx CLI.', position);
		}
		final parts = value.split("/");
		if (parts.exists(part -> part == "" || part == "." || part == "..")) {
			return fail(code, 'Compiler define $name must not contain empty, current-directory, or parent-directory segments.', position);
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

	static function implementationModule(type:ClassType, path:String, position:Position):String {
		final directory = Path.directory(path);
		final from = portableDefine(APP_ROOT_DEFINE, "NXHX-SERVER-FUNCTION-PATH-0002", position).concat(directory == "" ? [] : directory.split("/"));
		final to = portableDefine(GENERATED_ROOT_DEFINE, "NXHX-SERVER-FUNCTION-PATH-0002", position).concat(type.module.split("."));
		return relativeModule(from, to);
	}

	static function adapterModule(caller:ClassType, path:String, position:Position):String {
		final callerParts = caller.module.split(".");
		callerParts.pop();
		final from = portableDefine(GENERATED_ROOT_DEFINE, "NXHX-SERVER-FUNCTION-REF-0006", position).concat(callerParts);
		final to = portableDefine(APP_ROOT_DEFINE, "NXHX-SERVER-FUNCTION-REF-0006", position).concat(path.split("/"));
		return relativeModule(from, to);
	}

	static function implementationAlias(type:ClassType):Null<String> {
		return ["Awaited", "Parameters", "Promise", "ReturnType"].contains(type.name) ? "NextJsHxServerImplementation" : null;
	}

	static function typedAction(expression:Expr):TypedServerAction {
		final typed = Context.typeExpr(expression);
		final value:TypedServerAction = switch typed.expr {
			case TField(_, FStatic(owner, field)):
				{owner: owner.get(), field: field.get()};
			case _:
				return fail("NXHX-SERVER-FUNCTION-REF-0006",
					"ServerFunction.ref requires one direct public static @:next.action field such as TodoActions.createTodo.", expression.pos);
		};
		final declaration = declaration(value.owner);
		if (declaration == null) {
			return fail("NXHX-SERVER-FUNCTION-REF-0006", '${fullTypeName(value.owner)} is not annotated with @:next.serverFunctions.', expression.pos);
		}
		if (!value.field.isPublic || !value.field.meta.has(":next.action")) {
			return fail("NXHX-SERVER-FUNCTION-REF-0006", '${fullTypeName(value.owner)}.${value.field.name} is not a validated public @:next.action export.',
				expression.pos);
		}
		if (!value.field.meta.has(":async") && !value.field.meta.has("async") && !value.field.meta.has(":jsAsync")) {
			return fail("NXHX-SERVER-FUNCTION-REF-0006", '${fullTypeName(value.owner)}.${value.field.name} is not emitted as an async function.',
				expression.pos);
		}
		final functionType = resolveAliases(value.field.type);
		switch functionType {
			case TFun(arguments, result):
				for (argument in arguments) {
					ServerFunctionSerializableMacro.validateArgument(argument.t, 'argument "${argument.name}"', value.field.pos);
				}
				final awaited = promiseResult(result);
				if (awaited == null) {
					return fail("NXHX-SERVER-FUNCTION-REF-0006", '${fullTypeName(value.owner)}.${value.field.name} does not return Promise<Result>.',
						expression.pos);
				}
				ServerFunctionSerializableMacro.validateResult(awaited, "result", value.field.pos);
			case _:
				return fail("NXHX-SERVER-FUNCTION-REF-0006", '${fullTypeName(value.owner)}.${value.field.name} is not a function.', expression.pos);
		}
		return value;
	}

	/** Installs Server Function validation before application declarations load. */
	public static function install():Void {
		if (installed) {
			return;
		}
		installed = true;
		Compiler.addGlobalMetadata("", "@:build(nextjshx.server.ServerFunctionMacro.build())", true, true, false);
	}

	/** Types one annotated Server Function class and records its closed adapter intent. */
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
			return fail("NXHX-SERVER-FUNCTION-TYPE-0004", 'Server Function owner ${fullTypeName(type)} must be a concrete, non-generic class.', type.pos);
		}
		final actions:Array<ServerAction> = [];
		for (field in fields) {
			final annotations = actionMetadata(field);
			if (annotations.length == 0) {
				if (hasAccess(field, APublic)) {
					return fail("NXHX-SERVER-FUNCTION-EXPORT-0003",
						'Public Server Function field ${fullTypeName(type)}.${field.name} must declare exactly one @:next.action annotation or be private.',
						field.pos);
				}
				continue;
			}
			if (annotations.length != 1) {
				return fail("NXHX-SERVER-FUNCTION-EXPORT-0003",
					'Server Function field ${fullTypeName(type)}.${field.name} declares ${annotations.length} @:next.action annotations; exactly one is required.',
					annotations[1].pos);
			}
			actions.push(validateAction(type, field, annotations[0]));
		}
		if (actions.length == 0) {
			return fail("NXHX-SERVER-FUNCTION-EXPORT-0003", 'Server Function owner ${fullTypeName(type)} must export at least one @:next.action method.',
				value.metadata.pos);
		}
		actions.sort((left, right) -> compareString(left.field.name, right.field.name));
		if (!type.meta.has(":keep")) {
			type.meta.add(":keep", [], value.metadata.pos);
		}
		final modulePath = implementationModule(type, value.path, value.metadata.pos);
		final alias = implementationAlias(type);
		final implementationName = alias == null ? type.name : alias;
		AdapterPlanRegistry.register({
			kind: AdapterKind.ServerFunction,
			sourceType: fullTypeName(type),
			sourceField: actions[0].field.name,
			typePosition: type.pos,
			fieldPosition: actions[0].field.pos,
			metadataPosition: value.metadata.pos,
			segmentPath: Path.directory(value.path),
			targetPath: value.path + ".ts",
			implementation: new AdapterImplementation(modulePath, type.name),
			imports: [new AdapterImport(modulePath, type.name, alias)],
			directives: ["use server"],
			exports: [
				for (action in actions)
					new AdapterExport(AdapterExportKind.Named, action.field.name, action.field.name,
						'(...args: Parameters<typeof $implementationName.${action.field.name}>) => Promise<Awaited<ReturnType<typeof $implementationName.${action.field.name}>>>')
			],
			config: []
		});
		return fields;
	}

	/**
	 * Expands one annotated action field into a precise generated-boundary
	 * import, optionally retaining nominal React Flight provenance.
	 */
	public static function reference(expression:Expr, flightBoundary:Bool = false):Expr {
		final action = typedAction(expression);
		final value = declaration(action.owner);
		if (value == null) {
			return fail("NXHX-SERVER-FUNCTION-REF-0006", '${fullTypeName(action.owner)} is not a Server Function owner.', expression.pos);
		}
		final callerReference = Context.getLocalClass();
		if (callerReference == null) {
			return fail("NXHX-SERVER-FUNCTION-REF-0006", "ServerFunction.ref must be called from a Haxe class emitted by genes-ts.", expression.pos);
		}
		final specifier = adapterModule(callerReference.get(), value.path, expression.pos);
		final digest = Sha256.encode('${callerReference.get().module}\x00${fullTypeName(action.owner)}\x00${action.field.name}\x00${value.path}')
			.substr(0, 12);
		final imported = macro @:pos(expression.pos) genes.ts.Imports.namedImport($v{specifier}, $v{action.field.name}, $v{'NextJsHxServerFunction_$digest'});
		final functionType = action.field.type.toComplexType();
		if (functionType == null) {
			return fail("NXHX-SERVER-FUNCTION-REF-0006", 'Cannot preserve the precise type of ${fullTypeName(action.owner)}.${action.field.name}.',
				expression.pos);
		}
		EnvironmentBoundaryMacro.registerReference("server-function", fullTypeName(action.owner), action.field.name, value.path + ".ts", expression.pos);
		final checked = {expr: ECheckType(imported, functionType), pos: expression.pos};
		if (!flightBoundary) {
			return checked;
		}
		final capabilityType:TypePath = {
			pack: ["nextjs", "client", "flight", "v19"],
			name: "FlightServerFunction",
			params: [TPType(functionType)]
		};
		final capability = {expr: ENew(capabilityType, [checked]), pos: expression.pos};
		return {
			expr: EMeta({name: ":privateAccess", params: [], pos: expression.pos}, capability),
			pos: expression.pos
		};
	}
	#end
}
