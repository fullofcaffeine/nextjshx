package nextjshx.boundary;

#if macro
import haxe.Json;
import haxe.io.Bytes;
import haxe.io.Path;
import haxe.macro.Compiler;
import haxe.macro.Context;
import haxe.macro.Expr;
import haxe.macro.PositionTools;
import haxe.macro.Type;
import haxe.macro.TypedExprTools;
#if nextjshx_genes_compiler_data
import genes.tooling.CompilerData.writeUtf8;
#end
import sys.FileSystem;
import sys.io.File;

using Lambda;
using StringTools;

private enum EnvironmentBoundaryKind {
	ServerDefault;
	Client;
	ServerFunctions;
	Cache;
	PrivateCache;
	RemoteCache;
	Shared;
	ServerOnly;
	ClientOnly;
}

private typedef EnvironmentBoundaryRegistration = {
	final kind:EnvironmentBoundaryKind;
	final moduleName:String;
	final ownerName:String;
	final signal:String;
	final position:Position;
}

private typedef EnvironmentBoundarySignal = {
	final kind:EnvironmentBoundaryKind;
	final metadata:MetadataEntry;
}

private typedef EnvironmentBoundaryConflict = {
	final message:String;
	final position:Position;
}

private typedef BoundaryReferenceRegistration = {
	final kind:String;
	final targetOwner:String;
	final targetField:String;
	final targetPath:String;
	final position:Position;
}
#end

/**
 * Emits native environment-poisoning imports and audits known Haxe graph edges.
 *
 * Next remains the final transitive graph oracle. This macro only rejects
 * environment mistakes whose source and target are both visible to Haxe.
 */
class EnvironmentBoundaryMacro {
	#if macro
	public static inline final OUTPUT_DEFINE:String = "nextjshx.boundary-plan-output";
	public static inline final COMPILER_DATA_ID:String = "nextjshx.boundary-plan";
	static inline final COMPILER_DATA_DEFINE:String = "genes.tooling.compiler-data";

	static final SERVER_APIS = ["nextjs.raw.Cache", "nextjs.raw.Headers", "nextjs.raw.Server"];
	static var installed:Bool = false;
	static var registrations = new Map<String, EnvironmentBoundaryRegistration>();
	static var conflicts:Array<EnvironmentBoundaryConflict> = [];
	static var dependencies = new Map<String, Map<String, Position>>();
	static var references = new Map<String, Array<BoundaryReferenceRegistration>>();
	static var projectRoot:String = "";
	static var outputPath:Null<String> = null;

	static function fail<T>(code:String, message:String, position:Position):T {
		return Context.fatalError('[$code] $message', position);
	}

	static function fullTypeName(type:ClassType):String {
		final primaryTypeName = type.pack.concat([type.name]).join(".");
		return type.module == primaryTypeName ? primaryTypeName : '${type.module}.${type.name}';
	}

	static function kindName(kind:EnvironmentBoundaryKind):String {
		return switch kind {
			case ServerDefault: "server-default";
			case Client: "client";
			case ServerFunctions: "Server Function";
			case Cache: "shared cache";
			case PrivateCache: "private cache";
			case RemoteCache: "remote cache";
			case Shared: "shared-pure";
			case ServerOnly: "server-only";
			case ClientOnly: "client-only";
		};
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

	static function normalizedSlashes(value:String):String {
		return Path.normalize(value).split("\\").join("/");
	}

	static function portablePath(value:String, position:Position):String {
		final absolute = normalizedSlashes(FileSystem.fullPath(Path.isAbsolute(value) ? value : Path.join([projectRoot, value])));
		final root = normalizedSlashes(FileSystem.fullPath(projectRoot));
		final prefix = root + "/";
		if (!absolute.startsWith(prefix)) {
			fail("NXHX-BOUNDARY-REPORT-0005",
				'Boundary evidence source "$value" is outside the configured project root; reports never publish machine-local paths.', position);
		}
		return absolute.substr(prefix.length);
	}

	static function isProjectPosition(position:Position):Bool {
		final location = PositionTools.toLocation(position);
		final absolute = normalizedSlashes(FileSystem.fullPath(location.file.toString()));
		final root = normalizedSlashes(FileSystem.fullPath(projectRoot));
		return absolute.startsWith(root + "/");
	}

	static function validateOutputPath(value:String, position:Position):String {
		if (value == "" || Path.isAbsolute(value) || value != value.split("\\").join("/") || !value.endsWith(".json")) {
			fail("NXHX-BOUNDARY-REPORT-0005", 'Boundary report output "$value" must be a relative slash-normalized .json path.', position);
		}
		for (part in value.split("/")) {
			if (part == "" || part == "." || part == "..") {
				fail("NXHX-BOUNDARY-REPORT-0005", 'Boundary report output "$value" contains an unsafe path segment.', position);
			}
		}
		return value;
	}

	static function appendIndent(buffer:StringBuf, depth:Int):Void {
		for (_ in 0...depth) {
			buffer.add("  ");
		}
	}

	static function appendPosition(buffer:StringBuf, position:Position, depth:Int):Void {
		final location = PositionTools.toLocation(position);
		buffer.add("{\n");
		appendIndent(buffer, depth + 1);
		buffer.add('"file": ${Json.stringify(portablePath(location.file.toString(), position))},\n');
		appendIndent(buffer, depth + 1);
		buffer.add('"startLine": ${location.range.start.line},\n');
		appendIndent(buffer, depth + 1);
		buffer.add('"startCharacter": ${location.range.start.character},\n');
		appendIndent(buffer, depth + 1);
		buffer.add('"endLine": ${location.range.end.line},\n');
		appendIndent(buffer, depth + 1);
		buffer.add('"endCharacter": ${location.range.end.character}\n');
		appendIndent(buffer, depth);
		buffer.add("}");
	}

	static function encodedPlan():String {
		// The CLI report is a project artifact. Library classifications still
		// label project-owned dependency edges, but their machine-local source
		// declarations must never become top-level report owners.
		final owners = [
			for (registration in registrations)
				if (isProjectPosition(registration.position)) registration
		];
		owners.sort((left, right) -> compareString(left.ownerName, right.ownerName));
		final buffer = new StringBuf();
		buffer.add('{\n  "$$schema": "https://nextjshx.dev/schemas/boundary-plan-v1.json",\n  "schemaVersion": 1,\n  "boundaries": [');
		if (owners.length > 0) {
			buffer.add("\n");
		}
		for (ownerIndex in 0...owners.length) {
			final owner = owners[ownerIndex];
			appendIndent(buffer, 2);
			buffer.add("{\n");
			appendIndent(buffer, 3);
			buffer.add('"kind": ${Json.stringify(kindName(owner.kind))},\n');
			appendIndent(buffer, 3);
			buffer.add('"moduleName": ${Json.stringify(owner.moduleName)},\n');
			appendIndent(buffer, 3);
			buffer.add('"ownerName": ${Json.stringify(owner.ownerName)},\n');
			appendIndent(buffer, 3);
			buffer.add('"signal": ${Json.stringify(owner.signal)},\n');
			appendIndent(buffer, 3);
			buffer.add('"position": ');
			appendPosition(buffer, owner.position, 3);
			buffer.add(",\n");
			appendIndent(buffer, 3);
			buffer.add('"references": [');
			final ownerReferences = references.get(owner.moduleName);
			final sortedReferences = ownerReferences == null ? [] : ownerReferences.copy();
			sortedReferences.sort((left,
					right) -> compareString('${left.kind}\x00${left.targetOwner}\x00${left.targetField}\x00${left.targetPath}',
					'${right.kind}\x00${right.targetOwner}\x00${right.targetField}\x00${right.targetPath}'));
			if (sortedReferences.length > 0) {
				buffer.add("\n");
			}
			for (referenceIndex in 0...sortedReferences.length) {
				final reference = sortedReferences[referenceIndex];
				appendIndent(buffer, 4);
				buffer.add("{\n");
				appendIndent(buffer, 5);
				buffer.add('"kind": ${Json.stringify(reference.kind)},\n');
				appendIndent(buffer, 5);
				buffer.add('"targetOwner": ${Json.stringify(reference.targetOwner)},\n');
				appendIndent(buffer, 5);
				buffer.add('"targetField": ${Json.stringify(reference.targetField)},\n');
				appendIndent(buffer, 5);
				buffer.add('"targetPath": ${Json.stringify(reference.targetPath)},\n');
				appendIndent(buffer, 5);
				buffer.add('"position": ');
				appendPosition(buffer, reference.position, 5);
				buffer.add("\n");
				appendIndent(buffer, 4);
				buffer.add(referenceIndex == sortedReferences.length - 1 ? "}\n" : "},\n");
			}
			if (sortedReferences.length > 0) {
				appendIndent(buffer, 3);
			}
			buffer.add("],\n");
			appendIndent(buffer, 3);
			buffer.add('"dependencies": [');
			final ownerDependencies = dependencies.get(owner.moduleName);
			final targetNames = ownerDependencies == null ? [] : [for (targetName in ownerDependencies.keys()) targetName];
			targetNames.sort(compareString);
			if (targetNames.length > 0) {
				buffer.add("\n");
			}
			for (dependencyIndex in 0...targetNames.length) {
				final targetName = targetNames[dependencyIndex];
				final target = registrations.get(targetName);
				final position = ownerDependencies.get(targetName);
				appendIndent(buffer, 4);
				buffer.add("{\n");
				appendIndent(buffer, 5);
				buffer.add('"moduleName": ${Json.stringify(targetName)},\n');
				appendIndent(buffer, 5);
				buffer.add('"classification": ${Json.stringify(target == null ? "unclassified" : kindName(target.kind))},\n');
				appendIndent(buffer, 5);
				buffer.add('"position": ');
				appendPosition(buffer, position, 5);
				buffer.add("\n");
				appendIndent(buffer, 4);
				buffer.add(dependencyIndex == targetNames.length - 1 ? "}\n" : "},\n");
			}
			if (targetNames.length > 0) {
				appendIndent(buffer, 3);
			}
			buffer.add("]\n");
			appendIndent(buffer, 2);
			buffer.add(ownerIndex == owners.length - 1 ? "}\n" : "},\n");
		}
		if (owners.length > 0) {
			appendIndent(buffer, 1);
		}
		buffer.add("]\n}\n");
		return buffer.toString();
	}

	static function ensureDirectory(directory:String):Void {
		if (directory == "" || FileSystem.exists(directory)) {
			return;
		}
		ensureDirectory(Path.directory(directory));
		FileSystem.createDirectory(directory);
	}

	static function kindForSignal(name:String):Null<EnvironmentBoundaryKind> {
		return switch name {
			case ":next.page" | ":next.layout" | ":next.loading" | ":next.notFound" | ":next.default" | ":next.route" | ":next.proxy": ServerDefault;
			case ":next.error" | ":next.clientComponent": Client;
			case ":next.serverFunctions": ServerFunctions;
			case ":next.cache": Cache;
			case ":next.cachePrivate": PrivateCache;
			case ":next.cacheRemote": RemoteCache;
			case ":next.shared": Shared;
			case ":next.serverOnly": ServerOnly;
			case ":next.clientOnly": ClientOnly;
			case _: null;
		};
	}

	static function boundarySignals(type:ClassType):Array<EnvironmentBoundarySignal> {
		final result:Array<EnvironmentBoundarySignal> = [];
		for (entry in type.meta.get()) {
			final kind = kindForSignal(entry.name);
			if (kind != null) {
				result.push({kind: kind, metadata: entry});
			}
		}
		if (result.length == 2) {
			final cache = result.find(signal -> switch signal.kind {
				case Cache | PrivateCache | RemoteCache: true;
				case _: false;
			});
			final page = result.find(signal -> [":next.page", ":next.layout"].contains(signal.metadata.name));
			if (cache != null && page != null) {
				return [cache];
			}
		}
		return result;
	}

	static function register(type:ClassType, signal:EnvironmentBoundarySignal):Bool {
		final ownerName = fullTypeName(type);
		final previous = registrations.get(type.module);
		if (previous != null && (previous.ownerName != ownerName || previous.signal != signal.metadata.name)) {
			conflicts.push({
				message: 'Haxe module "${type.module}" has conflicting boundary owners ${previous.ownerName} (${previous.signal}) and $ownerName (${signal.metadata.name}). Split them into separate .hx modules.',
				position: signal.metadata.pos
			});
			return false;
		}
		registrations.set(type.module, {
			kind: signal.kind,
			moduleName: type.module,
			ownerName: ownerName,
			signal: signal.metadata.name,
			position: signal.metadata.pos
		});
		return true;
	}

	static function hasAccess(field:Field, access:Access):Bool {
		return field.access != null && field.access.contains(access);
	}

	static function marker(specifier:String, position:Position):Expr {
		return macro @:pos(position) genes.ts.Imports.sideEffect($v{specifier});
	}

	static function prependMarker(field:Field, specifier:String, position:Position):Void {
		if (!hasAccess(field, AStatic)) {
			fail("NXHX-BOUNDARY-INIT-0004", "A boundary-owned __init__ function must be static.", field.pos);
		}
		switch field.kind {
			case FFun(method):
				if (method.args.length != 0 || method.params.length != 0 || method.expr == null) {
					fail("NXHX-BOUNDARY-INIT-0004", "A boundary-owned __init__ function must be non-generic, argument-free, and have a body.", field.pos);
				}
				final request = marker(specifier, position);
				final body = method.expr;
				method.expr = switch body.expr {
					case EBlock(expressions): {expr: EBlock([request].concat(expressions)), pos: body.pos};
					case _: {expr: EBlock([request, body]), pos: body.pos};
				};
			case _:
				fail("NXHX-BOUNDARY-INIT-0004", "A boundary-owned __init__ field must be a function.", field.pos);
		}
	}

	static function injectMarker(type:ClassType, fields:Array<Field>, signal:EnvironmentBoundarySignal):Void {
		if (type.isExtern || type.isInterface || type.params.length != 0) {
			fail("NXHX-BOUNDARY-METADATA-0001",
				'${signal.metadata.name} owner ${fullTypeName(type)} must be a concrete, non-generic class because it owns one emitted ECMAScript module.',
				signal.metadata.pos);
		}
		if (!type.meta.has(":keep")) {
			type.meta.add(":keep", [], signal.metadata.pos);
		}
		final specifier = signal.kind == ServerOnly ? "server-only" : "client-only";
		final initializers = fields.filter(field -> field.name == "__init__");
		if (initializers.length > 1) {
			fail("NXHX-BOUNDARY-INIT-0004", '${fullTypeName(type)} may declare at most one static __init__ function.', initializers[1].pos);
		}
		if (initializers.length == 1) {
			prependMarker(initializers[0], specifier, signal.metadata.pos);
			return;
		}
		fields.push({
			name: "__init__",
			pos: signal.metadata.pos,
			access: [AStatic],
			kind: FFun({
				args: [],
				ret: macro :Void,
				expr: {expr: EBlock([marker(specifier, signal.metadata.pos)]), pos: signal.metadata.pos}
			})
		});
	}

	static function typeDeclarationModule(type:ModuleType):String {
		return switch type {
			case TClassDecl(reference): reference.get().module;
			case TEnumDecl(reference): reference.get().module;
			case TTypeDecl(reference): reference.get().module;
			case TAbstract(reference): reference.get().module;
		};
	}

	static function invalidDependency(source:EnvironmentBoundaryRegistration, target:EnvironmentBoundaryRegistration):Bool {
		final targetIsCache = switch target.kind {
			case Cache | PrivateCache | RemoteCache: true;
			case _: false;
		};
		if (targetIsCache && target.moduleName != source.moduleName) {
			return true;
		}
		return switch source.kind {
			case Client | ClientOnly: target.kind == ServerDefault || target.kind == ServerOnly || target.kind == ServerFunctions || targetIsCache;
			case Shared:
				target.kind != Shared;
			case ServerDefault | ServerOnly | ServerFunctions | Cache | PrivateCache | RemoteCache: target.kind == Client || target.kind == ClientOnly;
		};
	}

	static function validateCacheRequestAccess(source:EnvironmentBoundaryRegistration, owner:ClassType, field:ClassField, position:Position):Void {
		if (source.kind != Cache && source.kind != RemoteCache) {
			return;
		}
		final directRequestApi = owner.module == "nextjs.raw.Headers"
			|| (owner.module == "nextjs.raw.Server" && field.name == "connection");
		if (directRequestApi) {
			fail("NXHX-CACHE-REQUEST-0006",
				'${kindName(source.kind)} module ${source.ownerName} cannot call ${owner.module}.${field.name} directly. Read request-time values outside the ordinary/remote cached scope and pass a decoded serializable argument; use @:next.cachePrivate only with its explicit capability when direct request access is truly required.',
				position);
		}
	}

	static function validateDependency(source:EnvironmentBoundaryRegistration, targetModule:String, position:Position):Void {
		if (targetModule != source.moduleName && isProjectPosition(position)) {
			var sourceDependencies = dependencies.get(source.moduleName);
			if (sourceDependencies == null) {
				sourceDependencies = new Map<String, Position>();
				dependencies.set(source.moduleName, sourceDependencies);
			}
			if (!sourceDependencies.exists(targetModule)) {
				sourceDependencies.set(targetModule, position);
			}
		}
		if ((source.kind == Client || source.kind == ClientOnly || source.kind == Shared) && SERVER_APIS.contains(targetModule)) {
			fail("NXHX-BOUNDARY-REQUEST-0003",
				'${kindName(source.kind)} module ${source.ownerName} cannot use server request/cache API $targetModule. Move the access into an explicit @:next.serverOnly service and pass only a validated value across a native boundary.',
				position);
		}
		final target = registrations.get(targetModule);
		if (target != null && target.moduleName != source.moduleName && invalidDependency(source, target)) {
			fail("NXHX-BOUNDARY-IMPORT-0002",
				'${kindName(source.kind)} module ${source.ownerName} cannot depend directly on ${kindName(target.kind)} module ${target.ownerName}. Use the generated native boundary ref, or move target-neutral values into an explicit @:next.shared module.',
				position);
		}
	}

	static function auditExpression(source:EnvironmentBoundaryRegistration, expression:TypedExpr):Void {
		switch expression.expr {
			case TField(_, FStatic(owner, field)):
				validateCacheRequestAccess(source, owner.get(), field.get(), expression.pos);
			case TTypeExpr(type):
				validateDependency(source, typeDeclarationModule(type), expression.pos);
			case TNew(reference, _, _):
				validateDependency(source, reference.get().module, expression.pos);
			case _:
		}
		TypedExprTools.iter(expression, child -> auditExpression(source, child));
	}

	static function auditField(source:EnvironmentBoundaryRegistration, field:ClassField):Void {
		final expression = field.expr();
		if (expression != null) {
			auditExpression(source, expression);
		}
	}

	static function auditClass(type:ClassType):Void {
		final source = registrations.get(type.module);
		if (source == null) {
			return;
		}
		for (field in type.statics.get()) {
			auditField(source, field);
		}
		for (field in type.fields.get()) {
			auditField(source, field);
		}
		if (type.constructor != null) {
			auditField(source, type.constructor.get());
		}
		if (type.init != null) {
			auditExpression(source, type.init);
		}
	}

	static function audit(types:Array<ModuleType>):Void {
		if (conflicts.length > 0) {
			final conflict = conflicts[0];
			fail("NXHX-BOUNDARY-METADATA-0001", conflict.message, conflict.position);
		}
		for (type in types) {
			switch type {
				case TClassDecl(reference):
					auditClass(reference.get());
				case _:
			}
		}
	}
	#end

	/** Installs one fail-closed module-classification pass for the compilation. */
	public static function install():Void {
		#if macro
		if (installed) {
			return;
		}
		installed = true;
		projectRoot = FileSystem.fullPath(Sys.getCwd());
		final configuredOutput = Context.definedValue(OUTPUT_DEFINE);
		outputPath = configuredOutput == null ? null : validateOutputPath(configuredOutput, Context.currentPos());
		registrations = new Map<String, EnvironmentBoundaryRegistration>();
		conflicts = [];
		dependencies = new Map<String, Map<String, Position>>();
		references = new Map<String, Array<BoundaryReferenceRegistration>>();
		Compiler.addGlobalMetadata("", "@:build(nextjshx.boundary.EnvironmentBoundaryMacro.build())", true, true, false);
		Context.onAfterTyping(audit);
		Context.onAfterGenerate(() -> {
			#if nextjshx_genes_compiler_data
			if (Context.defined(COMPILER_DATA_DEFINE)) {
				// The host receives a byte copy, not a writable path. NextJsHx does
				// not replace the last working generated files until it checks the
				// complete new result.
				writeUtf8(COMPILER_DATA_ID, encodedPlan());
			} else if (outputPath != null) {
				final absolute = Path.join([projectRoot, outputPath]);
				ensureDirectory(Path.directory(absolute));
				File.saveContent(absolute, encodedPlan());
			}
			#else
			if (outputPath != null) {
				final absolute = Path.join([projectRoot, outputPath]);
				ensureDirectory(Path.directory(absolute));
				File.saveContent(absolute, encodedPlan());
			}
			#end
		});
		#end
	}

	/** Records one macro-validated generated boundary reference at its Haxe use site. */
	#if macro
	public static function registerReference(kind:String, targetOwner:String, targetField:String, targetPath:String, position:Position):Void {
		final caller = Context.getLocalClass();
		if (caller == null) {
			return;
		}
		final moduleName = caller.get().module;
		var values = references.get(moduleName);
		if (values == null) {
			values = [];
			references.set(moduleName, values);
		}
		values.push({
			kind: kind,
			targetOwner: targetOwner,
			targetField: targetField,
			targetPath: targetPath,
			position: position
		});
	}
	#end

	/** Registers one semantic boundary owner and injects its native marker import. */
	public static function build():Array<Field> {
		#if macro
		final fields = Context.getBuildFields();
		final localClass = Context.getLocalClass();
		if (localClass == null) {
			return fields;
		}
		final type = localClass.get();
		final signals = boundarySignals(type);
		if (signals.length > 1) {
			conflicts.push({
				message: '${fullTypeName(type)} declares both ${signals[0].metadata.name} and ${signals[1].metadata.name}; one Haxe module may have only one primary boundary.',
				position: signals[1].metadata.pos
			});
			return fields;
		}
		if (signals.length == 1) {
			final signal = signals[0];
			final registered = register(type, signal);
			if (registered && (signal.kind == ServerOnly || signal.kind == ClientOnly)) {
				injectMarker(type, fields, signal);
			}
		}
		return fields;
		#else
		return [];
		#end
	}
}
