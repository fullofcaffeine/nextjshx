package nextjshx.adapter;

#if macro
import haxe.io.Path;
import haxe.io.Bytes;
import haxe.macro.Context;
import haxe.macro.Expr.Position;
import haxe.macro.PositionTools;
import nextjshx.adapter.AdapterConfig.AdapterConfigValue;
import nextjshx.adapter.AdapterExport.AdapterExportKind;
import sys.FileSystem;
import sys.io.File;

using StringTools;

/** Macro-facing input captured before an immutable adapter intent is created. */
typedef AdapterIntentRegistration = {
	var kind:AdapterKind;
	var sourceType:String;
	var sourceField:String;
	var typePosition:Position;
	var fieldPosition:Position;
	var metadataPosition:Position;
	var segmentPath:String;
	var targetPath:String;
	var implementation:AdapterImplementation;
	var imports:Array<AdapterImport>;
	var directives:Array<String>;
	var exports:Array<AdapterExport>;
	var config:Array<AdapterConfig>;
}

private typedef RegisteredIntent = {
	final intent:AdapterIntent;
	final diagnosticPosition:Position;
}
#end

/**
 * Collects, validates, and emits adapter intent during Haxe compilation.
 *
 * Why: build macros run while individual declarations are typed, but adapter
 * collisions and deterministic ordering can only be decided with the complete
 * set. Writing convention files from each macro would make partial output and
 * discovery order observable.
 *
 * What: later NextJsHx build macros call `register` with typed source positions
 * and literal-only intent. `install` schedules one after-typing finalization
 * pass that canonicalizes nested collections, rejects duplicate targets, and
 * emits a versioned JSON plan.
 *
 * How: the registry stores data only. It never evaluates a Haxe field, renders
 * an adapter, or mutates the App Router tree. Publication and ownership remain
 * separate tooling phases.
 */
class AdapterPlanRegistry {
	#if macro
	static var installed:Bool = false;
	static var registrations:Array<AdapterIntentRegistration> = [];
	static var generation:Int = 0;
	static var projectRoot:String = "";

	static function fail(code:String, message:String, position:Position):Void {
		Context.error('[$code] $message', position);
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

	static function canonicalKind(value:AdapterKind, position:Position):AdapterKind {
		final name:String = value;
		return switch name {
			case "page": AdapterKind.Page;
			case "layout": AdapterKind.Layout;
			case "route-handler": AdapterKind.RouteHandler;
			case "client-component": AdapterKind.ClientComponent;
			case "server-function": AdapterKind.ServerFunction;
			case "proxy": AdapterKind.Proxy;
			case _:
				fail("NXHX-PLAN-KIND-0001", 'Unsupported adapter kind "$name".', position);
				AdapterKind.Page;
		};
	}

	static function normalizedSlashes(value:String):String {
		return Path.normalize(value).split("\\").join("/");
	}

	static function portableSourcePath(value:String, position:Position):String {
		final absolute = normalizedSlashes(FileSystem.fullPath(Path.isAbsolute(value) ? value : Path.join([projectRoot, value])));
		final normalizedRoot = normalizedSlashes(FileSystem.fullPath(projectRoot));
		final prefix = normalizedRoot + "/";
		if (!absolute.startsWith(prefix)) {
			fail("NXHX-PLAN-SOURCE-0001",
				'The adapter source "$value" is outside the configured project root. Compile from the workspace root or configure discovery before registering the declaration.',
				position);
		}
		return absolute.substr(prefix.length);
	}

	static function sourcePosition(position:Position):AdapterSourcePosition {
		final location = PositionTools.toLocation(position);
		return new AdapterSourcePosition(portableSourcePath(location.file.toString(), position), location.range.start.line, location.range.start.character,
			location.range.end.line, location.range.end.character);
	}

	static function validateRelativePath(value:String, label:String, allowEmpty:Bool, position:Position):String {
		if (value == "" && allowEmpty) {
			return value;
		}
		if (value == "" || value != value.split("\\").join("/") || Path.isAbsolute(value)) {
			fail("NXHX-PLAN-PATH-0001", '$label "$value" must be a non-absolute, slash-normalized path relative to the discovered App Router root.', position);
		}
		final parts = value.split("/");
		for (part in parts) {
			if (part == "" || part == "." || part == "..") {
				fail("NXHX-PLAN-PATH-0001", '$label "$value" contains an empty, current-directory, or parent-directory segment.', position);
			}
		}
		return parts.join("/");
	}

	static function requireText(value:String, label:String, position:Position):String {
		if (StringTools.trim(value) == "") {
			fail("NXHX-PLAN-VALUE-0001", '$label must be a non-empty string.', position);
		}
		return value;
	}

	static function canonicalImports(values:Array<AdapterImport>, position:Position):Array<AdapterImport> {
		final result = values.copy();
		final seen = new Map<String, Bool>();
		for (value in result) {
			requireText(value.modulePath, "Adapter import module", position);
			requireText(value.symbol, "Adapter import symbol", position);
			if (value.alias != null) {
				requireText(value.alias, "Adapter import alias", position);
			}
			final alias = value.alias == null ? "" : value.alias;
			final key = '${value.modulePath}\x00${value.symbol}\x00$alias\x00${value.typeOnly}';
			if (seen.exists(key)) {
				fail("NXHX-PLAN-IMPORT-0001", 'Adapter import ${value.symbol} from "${value.modulePath}" is duplicated.', position);
			}
			seen.set(key, true);
		}
		result.sort((left, right) -> {
			final leftAlias = left.alias == null ? "" : left.alias;
			final rightAlias = right.alias == null ? "" : right.alias;
			final leftKey = '${left.modulePath}\x00${left.symbol}\x00$leftAlias\x00${left.typeOnly}';
			final rightKey = '${right.modulePath}\x00${right.symbol}\x00$rightAlias\x00${right.typeOnly}';
			return compareString(leftKey, rightKey);
		});
		return result;
	}

	static function canonicalDirectives(values:Array<String>, position:Position):Array<String> {
		final result = values.copy();
		final seen = new Map<String, Bool>();
		for (value in result) {
			requireText(value, "Adapter directive", position);
			if (seen.exists(value)) {
				fail("NXHX-PLAN-DIRECTIVE-0001", 'Adapter directive "$value" is duplicated.', position);
			}
			seen.set(value, true);
		}
		return result;
	}

	static function canonicalExports(values:Array<AdapterExport>, position:Position):Array<AdapterExport> {
		final result = values.copy();
		final seen = new Map<String, Bool>();
		for (value in result) {
			requireText(value.name, "Adapter export name", position);
			requireText(value.sourceField, "Adapter export source field", position);
			requireText(value.signature, "Adapter export signature", position);
			if ((value.kind == AdapterExportKind.Default) != (value.name == "default")) {
				fail("NXHX-PLAN-EXPORT-0001", 'Adapter export "${value.name}" has an inconsistent ${value.kind} kind.', position);
			}
			if (seen.exists(value.name)) {
				fail("NXHX-PLAN-EXPORT-0001", 'Adapter export "${value.name}" is duplicated.', position);
			}
			seen.set(value.name, true);
		}
		result.sort((left, right) -> {
			final leftRank = left.kind == AdapterExportKind.Default ? "0" : "1";
			final rightRank = right.kind == AdapterExportKind.Default ? "0" : "1";
			return compareString('$leftRank\x00${left.name}', '$rightRank\x00${right.name}');
		});
		return result;
	}

	static function copiedConfigValue(value:AdapterConfigValue, position:Position):AdapterConfigValue {
		return switch value {
			case StringValue(value):
				requireText(value, "Adapter config string", position);
				StringValue(value);
			case IntegerValue(value):
				IntegerValue(value);
			case BooleanValue(value):
				BooleanValue(value);
			case StringArrayValue(values):
				final copied = values.copy();
				for (entry in copied) {
					requireText(entry, "Adapter config string-array entry", position);
				}
				StringArrayValue(copied);
		};
	}

	static function canonicalConfig(values:Array<AdapterConfig>, position:Position):Array<AdapterConfig> {
		final result:Array<AdapterConfig> = [];
		final seen = new Map<String, Bool>();
		for (value in values) {
			requireText(value.name, "Adapter config name", position);
			if (seen.exists(value.name)) {
				fail("NXHX-PLAN-CONFIG-0001", 'Adapter config "${value.name}" is duplicated.', position);
			}
			seen.set(value.name, true);
			result.push(new AdapterConfig(value.name, copiedConfigValue(value.value, position)));
		}
		result.sort((left, right) -> compareString(left.name, right.name));
		return result;
	}

	static function canonicalIntent(registration:AdapterIntentRegistration):RegisteredIntent {
		final position = registration.metadataPosition;
		final kind = canonicalKind(registration.kind, position);
		final sourceType = requireText(registration.sourceType, "Adapter source type", position);
		final sourceField = requireText(registration.sourceField, "Adapter source field", position);
		final segmentPath = validateRelativePath(registration.segmentPath, "Adapter segment path", true, position);
		final targetPath = validateRelativePath(registration.targetPath, "Adapter target path", false, position);
		requireText(registration.implementation.modulePath, "Adapter implementation module", position);
		requireText(registration.implementation.symbol, "Adapter implementation symbol", position);
		final source = new AdapterSource(sourceType, sourceField, sourcePosition(registration.typePosition), sourcePosition(registration.fieldPosition),
			sourcePosition(registration.metadataPosition));
		return {
			intent: new AdapterIntent(kind, source, segmentPath, targetPath,
				new AdapterImplementation(registration.implementation.modulePath, registration.implementation.symbol),
				canonicalImports(registration.imports, position), canonicalDirectives(registration.directives, position),
				canonicalExports(registration.exports, position), canonicalConfig(registration.config, position)),
			diagnosticPosition: position
		};
	}

	static function ensureDirectory(directory:String):Void {
		if (directory == "" || FileSystem.exists(directory)) {
			return;
		}
		ensureDirectory(Path.directory(directory));
		FileSystem.createDirectory(directory);
	}

	static function finalizePlan(outputPath:String, toolchain:AdapterToolchain):Void {
		final values = [for (registration in registrations) canonicalIntent(registration)];
		values.sort((left, right) -> {
			final target = compareString(left.intent.targetPath, right.intent.targetPath);
			if (target != 0) {
				return target;
			}
			final kind = compareString(left.intent.kind, right.intent.kind);
			if (kind != 0) {
				return kind;
			}
			return compareString(left.intent.source.displayName(), right.intent.source.displayName());
		});
		for (index in 1...values.length) {
			final previous = values[index - 1];
			final current = values[index];
			if (previous.intent.targetPath == current.intent.targetPath) {
				fail("NXHX-PLAN-DUPLICATE-0001",
					'Adapter target "${current.intent.targetPath}" is requested by both ${previous.intent.source.displayName()} at ${previous.intent.source.metadataPosition.displayStart()} and ${current.intent.source.displayName()}. Choose one Haxe declaration for each generated file.',
					current.diagnosticPosition);
			}
		}
		final plan = new AdapterPlan(toolchain, [for (value in values) value.intent]);
		final absoluteOutput = Path.join([projectRoot, outputPath]);
		ensureDirectory(Path.directory(absoluteOutput));
		File.saveContent(absoluteOutput, AdapterPlanJson.encode(plan));
	}

	/** Installs one deterministic registry and JSON emission pass. */
	public static function install(outputPath:String, nextjshxVersion:String, haxeVersion:String, genesTsVersion:String, nextVersion:String):Void {
		projectRoot = FileSystem.fullPath(Sys.getCwd());
		final portableOutput = validateRelativePath(outputPath, "Adapter plan output", false, Context.currentPos());
		if (!portableOutput.endsWith(".json")) {
			fail("NXHX-PLAN-PATH-0001", 'Adapter plan output "$outputPath" must use a .json extension.', Context.currentPos());
		}
		final toolchain = new AdapterToolchain(requireText(nextjshxVersion, "NextJsHx version", Context.currentPos()),
			requireText(haxeVersion, "Haxe version", Context.currentPos()), requireText(genesTsVersion, "genes-ts version", Context.currentPos()),
			requireText(nextVersion, "Next.js version", Context.currentPos()));
		registrations = [];
		installed = true;
		generation++;
		final currentGeneration = generation;
		var finalized = false;
		Context.onAfterTyping(_ -> {
			if (!finalized && currentGeneration == generation) {
				finalized = true;
				finalizePlan(portableOutput, toolchain);
			}
		});
	}

	/** Registers one typed intent from a NextJsHx declaration build macro. */
	public static function register(registration:AdapterIntentRegistration):Void {
		if (!installed) {
			fail("NXHX-PLAN-INSTALL-0001", "The adapter-plan registry was not installed. Add the NextJsHx plan macro before typing annotated declarations.",
				registration.metadataPosition);
		}
		registrations.push({
			kind: registration.kind,
			sourceType: registration.sourceType,
			sourceField: registration.sourceField,
			typePosition: registration.typePosition,
			fieldPosition: registration.fieldPosition,
			metadataPosition: registration.metadataPosition,
			segmentPath: registration.segmentPath,
			targetPath: registration.targetPath,
			implementation: registration.implementation,
			imports: registration.imports.copy(),
			directives: registration.directives.copy(),
			exports: registration.exports.copy(),
			config: registration.config.copy()
		});
	}
	#end
}
