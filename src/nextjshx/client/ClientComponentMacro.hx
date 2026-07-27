package nextjshx.client;

#if macro
import haxe.crypto.Sha256;
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
import nextjshx.boundary.ReactSerializableMacro;

using StringTools;
using haxe.macro.TypeTools;
using Lambda;

private typedef ClientDeclaration = {
	final metadata:MetadataEntry;
	final path:String;
}

private typedef ClientRender = {
	final field:Field;
	final props:Type;
}
#end

/** Validates Haxe-owned Client Components and records directive-first adapters. */
class ClientComponentMacro {
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

	public static function fullTypeName(type:ClassType):String {
		final primaryTypeName = type.pack.concat([type.name]).join(".");
		return type.module == primaryTypeName ? primaryTypeName : '${type.module}.${type.name}';
	}

	static function metadataPath(type:ClassType, metadata:MetadataEntry):String {
		if (metadata.params.length == 0) {
			final name = type.name;
			if (!~/^[A-Za-z_][A-Za-z0-9_]*$/.match(name)) {
				return fail("NXHX-CLIENT-PATH-0002", 'Client Component ${fullTypeName(type)} cannot derive a portable adapter leaf from type name "$name".',
					metadata.pos);
			}
			final digest = Sha256.encode(fullTypeName(type)).substr(0, 12);
			return '_nextjshx/client/$digest/$name';
		}
		if (metadata.params.length != 1) {
			return fail("NXHX-CLIENT-PATH-0002",
				'@:next.clientComponent on ${fullTypeName(type)} accepts no argument for inferred private placement or one App-Router-root-relative extensionless override.',
				metadata.pos);
		}
		final value = switch metadata.params[0].expr {
			case EConst(CString(path, _)): path;
			case _:
				return fail("NXHX-CLIENT-PATH-0002",
					'@:next.clientComponent on ${fullTypeName(type)} requires a compile-time string literal; expressions are not evaluated.',
					metadata.params[0].pos);
		};
		if (value == "" || value.indexOf("\\") != -1 || Path.isAbsolute(value) || value.startsWith("/") || value.endsWith("/")) {
			return fail("NXHX-CLIENT-PATH-0002", 'Client Component adapter path "$value" must be a non-empty slash-normalized relative path.',
				metadata.params[0].pos);
		}
		final parts = value.split("/");
		if (parts.exists(part -> part == "" || part == "." || part == ".." || ~/[^A-Za-z0-9_@()+.\-]/.match(part))) {
			return fail("NXHX-CLIENT-PATH-0002", 'Client Component adapter path "$value" contains an unsafe or non-portable segment.', metadata.params[0].pos);
		}
		final leaf = parts[parts.length - 1];
		if (~/(?i)\.(?:[cm]?[jt]sx?)$/.match(leaf)) {
			return fail("NXHX-CLIENT-PATH-0002", 'Client Component adapter path "$value" must omit its generated file extension.', metadata.params[0].pos);
		}
		if (RESERVED_CONVENTIONS.contains(leaf)) {
			return fail("NXHX-CLIENT-PATH-0002",
				'Client Component adapter path "$value" would collide with Next App Router convention file $leaf.tsx. Choose a component-specific filename.',
				metadata.params[0].pos);
		}
		return parts.join("/");
	}

	static function declaration(type:ClassType):Null<ClientDeclaration> {
		final values = type.meta.get().filter(entry -> entry.name == ":next.clientComponent");
		if (values.length == 0) {
			return null;
		}
		final boundaries = type.meta.get().filter(entry -> BOUNDARY_METADATA.contains(entry.name));
		if (values.length != 1 || boundaries.length != 1) {
			final position = values.length > 1 ? values[1].pos : boundaries[1].pos;
			return fail("NXHX-CLIENT-BOUNDARY-0001",
				'${fullTypeName(type)} must declare exactly one App Router boundary annotation; found ${boundaries.length}.', position);
		}
		return {metadata: values[0], path: metadataPath(type, values[0])};
	}

	static function hasAccess(field:Field, access:Access):Bool {
		return field.access != null && field.access.contains(access);
	}

	static function isElement(type:Type):Bool {
		return switch type {
			case TType(reference, parameters): final value = reference.get(); (value.module == "genes.react.Element"
					&& value.name == "Element"
					&& parameters.length == 0) || isElement(value.type.applyTypeParameters(value.params, parameters));
			case TAbstract(reference, parameters): final value = reference.get(); value.module == "genes.react.Element" && value.name == "Element" && parameters.length == 0;
			case TInst(reference, parameters): final value = reference.get(); value.module == "genes.react.Element" && value.name == "Element" && parameters.length == 0;
			case TMono(reference): final value = reference.get(); value != null && isElement(value);
			case TLazy(resolve): isElement(resolve());
			case _: false;
		};
	}

	static function requireType(value:Null<ComplexType>, label:String, position:Position):Type {
		if (value == null) {
			return fail("NXHX-CLIENT-RENDER-0003", '$label requires an explicit Haxe type annotation.', position);
		}
		return Context.resolveType(value, position);
	}

	static function renderField(type:ClassType, fields:Array<Field>):ClientRender {
		final renders = fields.filter(field -> field.name == "render");
		if (renders.length != 1) {
			return fail("NXHX-CLIENT-RENDER-0003",
				'Client Component ${fullTypeName(type)} must expose exactly one public static render function; found ${renders.length}.', type.pos);
		}
		final field = renders[0];
		if (!hasAccess(field, APublic) || !hasAccess(field, AStatic)) {
			return fail("NXHX-CLIENT-RENDER-0003", 'Client Component ${fullTypeName(type)}.render must be public static.', field.pos);
		}
		final method = switch field.kind {
			case FFun(value): value;
			case _: return fail("NXHX-CLIENT-RENDER-0003", 'Client Component ${fullTypeName(type)}.render must be a function.', field.pos);
		};
		if (method.params.length != 0 || method.args.length != 1) {
			return fail("NXHX-CLIENT-RENDER-0003", 'Client Component ${fullTypeName(type)}.render must be non-generic and accept exactly one props argument.',
				field.pos);
		}
		final argument = method.args[0];
		if (argument.opt || argument.value != null) {
			return fail("NXHX-CLIENT-RENDER-0003", 'Client Component props argument "${argument.name}" must be required and have no default value.', field.pos);
		}
		final props = requireType(argument.type, 'Client Component props argument "${argument.name}"', field.pos);
		ReactSerializableMacro.validate(props, "props", field.pos);
		final result = requireType(method.ret, "Client Component render return", field.pos);
		if (!isElement(result)) {
			return fail("NXHX-CLIENT-RETURN-0004",
				'Client Component render must synchronously return genes.react.Element; found ${result.toString()}. Client Components cannot be async.',
				field.pos);
		}
		return {field: field, props: props};
	}

	static function typedRender(type:ClassType, position:Position):Type {
		final renders = type.statics.get().filter(field -> field.name == "render" && field.isPublic);
		if (renders.length != 1) {
			return fail("NXHX-CLIENT-REF-0006", '${fullTypeName(type)} does not expose one validated public static render function.', position);
		}
		return switch renders[0].type.follow() {
			case TFun(arguments, result) if (arguments.length == 1 && isElement(result)):
				ReactSerializableMacro.validate(arguments[0].t, "props", renders[0].pos);
				arguments[0].t;
			case _:
				fail("NXHX-CLIENT-REF-0006", '${fullTypeName(type)}.render is not a validated synchronous one-prop Client Component.', position);
		};
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

	public static function implementationModule(type:ClassType, path:String, position:Position):String {
		final directory = Path.directory(path);
		final from = portableDefine(APP_ROOT_DEFINE, "NXHX-CLIENT-PATH-0002", position).concat(directory == "" ? [] : directory.split("/"));
		final to = portableDefine(GENERATED_ROOT_DEFINE, "NXHX-CLIENT-PATH-0002", position).concat(type.module.split("."));
		return relativeModule(from, to);
	}

	static function adapterModule(caller:ClassType, path:String, position:Position):String {
		final callerParts = caller.module.split(".");
		callerParts.pop();
		final from = portableDefine(GENERATED_ROOT_DEFINE, "NXHX-CLIENT-REF-0006", position).concat(callerParts);
		final to = portableDefine(APP_ROOT_DEFINE, "NXHX-CLIENT-REF-0006", position).concat(path.split("/"));
		return relativeModule(from, to);
	}

	static function implementationAlias(type:ClassType):Null<String> {
		if (type.name != "ComponentType" && type.name != "Parameters") {
			return null;
		}
		return "NextJsHxClientImplementation";
	}

	/**
	 * Copies the validated plain props record onto a checker-visible extern.
	 *
	 * Haxe needs these exact fields when Genes validates `<ClientRef ... />`, but
	 * generated server TypeScript must not import the raw client implementation
	 * merely to name its props. `boundaryPropsType` gives this extern an opaque
	 * adapter-derived TypeScript projection; these copied fields therefore exist
	 * only for Haxe's semantic pass and introduce no runtime or server-graph edge.
	 */
	static function boundaryPropsFields(props:Type, position:Position):Array<Field> {
		return switch props.follow() {
			case TAnonymous(reference):
				[
					for (field in reference.get().fields) {
						final fieldType = field.type.toComplexType();
						if (fieldType == null) {
							return fail("NXHX-CLIENT-REF-0006",
								'Client Component property "${field.name}" cannot be represented at the generated client boundary.', field.pos);
						}
						{
							name: field.name,
							doc: field.doc,
							access: [APublic],
							kind: FVar(fieldType),
							pos: field.pos,
							meta: field.meta.get()
						};
					}
				];
			case _:
				fail("NXHX-CLIENT-REF-0006", "Client Component props must be a closed anonymous record at the generated client boundary.", position);
		};
	}

	static function boundaryPropsType(specifier:String, digest:String, props:Type, position:Position):ComplexType {
		final pack = ["nextjshx", "generated", "client"];
		final name = 'NextJsHxClientProps_$digest';
		final fullName = pack.concat([name]).join(".");
		var exists = true;
		try {
			Context.getType(fullName);
		} catch (_:haxe.Exception) {
			exists = false;
		}
		if (!exists) {
			final typeScript = 'Parameters<typeof import(\'$specifier\').default>[0]';
			Context.defineType({
				pack: pack,
				name: name,
				pos: position,
				meta: [
					{name: ":ts.type", params: [{expr: EConst(CString(typeScript, DoubleQuotes)), pos: position}], pos: position},
					{name: ":noCompletion", params: [], pos: position}
				],
				params: [],
				isExtern: true,
				kind: TDClass(),
				fields: boundaryPropsFields(props, position)
			});
		}
		return TPath({pack: pack, name: name});
	}

	/** Installs client boundary validation before application declarations load. */
	public static function install():Void {
		if (installed) {
			return;
		}
		installed = true;
		ReactDiagnosticsMacro.install();
		Compiler.addGlobalMetadata("", "@:build(nextjshx.client.ClientComponentMacro.build())", true, true, false);
	}

	/** Types one annotated Client Component and records its closed adapter intent. */
	public static function build():Array<Field> {
		final fields = Context.getBuildFields();
		final localClass = Context.getLocalClass();
		if (localClass == null) {
			return fields;
		}
		final type = localClass.get();
		ReactHookExportMacro.process(type, fields);
		final value = declaration(type);
		if (value == null) {
			return fields;
		}
		if (type.isExtern || type.isInterface || type.params.length != 0) {
			return fail("NXHX-CLIENT-RENDER-0003", 'Client Component ${fullTypeName(type)} must be a concrete, non-generic class.', type.pos);
		}
		final render = renderField(type, fields);
		if (!type.meta.has(":keep")) {
			type.meta.add(":keep", [], value.metadata.pos);
		}
		final modulePath = implementationModule(type, value.path, value.metadata.pos);
		final alias = implementationAlias(type);
		final implementationName = alias == null ? type.name : alias;
		AdapterPlanRegistry.register({
			kind: AdapterKind.ClientComponent,
			sourceType: fullTypeName(type),
			sourceField: render.field.name,
			typePosition: type.pos,
			fieldPosition: render.field.pos,
			metadataPosition: value.metadata.pos,
			segmentPath: Path.directory(value.path),
			targetPath: value.path + ".tsx",
			implementation: new AdapterImplementation(modulePath, type.name),
			imports: [
				new AdapterImport(modulePath, type.name, alias),
				new AdapterImport("react", "ComponentType", null, true)
			],
			directives: ["use client"],
			exports: [
				new AdapterExport(AdapterExportKind.Default, "default", render.field.name, 'ComponentType<Parameters<typeof $implementationName.render>[0]>')
			],
			config: []
		});
		return fields;
	}

	/** Expands a raw annotated type token into a precise generated-boundary import. */
	public static function reference(expression:Expr):Expr {
		final typed = Context.typeExpr(expression);
		final type = switch typed.expr {
			case TTypeExpr(TClassDecl(reference)): reference.get();
			case _:
				return fail("NXHX-CLIENT-REF-0006", "ClientComponent.ref requires one @:next.clientComponent class token.", expression.pos);
		};
		final value = declaration(type);
		if (value == null) {
			return fail("NXHX-CLIENT-REF-0006", '${fullTypeName(type)} is not annotated with @:next.clientComponent.', expression.pos);
		}
		final props = typedRender(type, expression.pos);
		final callerReference = Context.getLocalClass();
		if (callerReference == null) {
			return fail("NXHX-CLIENT-REF-0006", "ClientComponent.ref must be called from a Haxe class emitted by genes-ts.", expression.pos);
		}
		final specifier = adapterModule(callerReference.get(), value.path, expression.pos);
		final digest = Sha256.encode('${callerReference.get().module}\x00${fullTypeName(type)}\x00${value.path}').substr(0, 12);
		final imported = macro @:pos(expression.pos) genes.ts.Imports.defaultImport($v{specifier}, $v{'NextJsHxClient_$digest'});
		final componentType:ComplexType = TPath({
			pack: ["nextjs", "raw", "react"],
			name: "ComponentType",
			params: [TPType(boundaryPropsType(specifier, digest, props, expression.pos))]
		});
		EnvironmentBoundaryMacro.registerReference("client-component", fullTypeName(type), "render", value.path + ".tsx", expression.pos);
		return {expr: ECheckType(imported, componentType), pos: expression.pos};
	}
	#end
}
