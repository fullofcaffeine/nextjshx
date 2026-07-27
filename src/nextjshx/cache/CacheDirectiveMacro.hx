package nextjshx.cache;

#if macro
import haxe.macro.Context;
import haxe.macro.Expr.MetadataEntry;
import haxe.macro.Expr.Position;
import haxe.macro.Type.ClassType;

using Lambda;

typedef CacheDirectiveDeclaration = {
	final kind:CacheDirectiveKind;
	final metadata:MetadataEntry;
	final directive:String;
}
#end

/** Closed cache variants understood by the semantic Haxe layer. */
enum abstract CacheDirectiveKind(String) to String {
	var Shared = "shared";
	var Private = "private";
	var Remote = "remote";
}

/** Parses cache metadata and enforces project capability opt-ins. */
class CacheDirectiveMacro {
	#if macro
	public static inline final CACHE_COMPONENTS_DEFINE:String = "nextjshx.cache-components";
	public static inline final PRIVATE_CACHE_DEFINE:String = "nextjshx.experimental.cache-private";
	public static inline final REMOTE_CACHE_DEFINE:String = "nextjshx.experimental.cache-remote";

	public static final METADATA = [":next.cache", ":next.cachePrivate", ":next.cacheRemote"];

	static function fail<T>(code:String, message:String, position:Position):T {
		return Context.fatalError('[$code] $message', position);
	}

	static function fullTypeName(type:ClassType):String {
		return type.pack.concat([type.name]).join(".");
	}

	static function declarationFor(metadata:MetadataEntry):CacheDirectiveDeclaration {
		return switch metadata.name {
			case ":next.cache":
				{kind: Shared, metadata: metadata, directive: "use cache"};
			case ":next.cachePrivate":
				{kind: Private, metadata: metadata, directive: "use cache: private"};
			case ":next.cacheRemote":
				{kind: Remote, metadata: metadata, directive: "use cache: remote"};
			case _:
				fail("NXHX-CACHE-METADATA-0002", 'Unsupported cache annotation ${metadata.name}.', metadata.pos);
		};
	}

	static function requireCapabilities(type:ClassType, value:CacheDirectiveDeclaration):Void {
		if (!Context.defined(CACHE_COMPONENTS_DEFINE)) {
			fail("NXHX-CACHE-CAPABILITY-0001",
				'${value.metadata.name} on ${fullTypeName(type)} requires Cache Components. Set $.next.cacheComponents to true in nextjshx.config.json; the CLI owns -D $CACHE_COMPONENTS_DEFINE.',
				value.metadata.pos);
		}
		switch value.kind {
			case Shared:
			case Private:
				if (!Context.defined(PRIVATE_CACHE_DEFINE)) {
					fail("NXHX-CACHE-CAPABILITY-0001",
						'${value.metadata.name} is an explicit experimental capability. Add "private" to $.next.experimentalCacheDirectives; the CLI owns -D $PRIVATE_CACHE_DEFINE.',
						value.metadata.pos);
				}
			case Remote:
				if (!Context.defined(REMOTE_CACHE_DEFINE)) {
					fail("NXHX-CACHE-CAPABILITY-0001",
						'${value.metadata.name} is an explicit experimental capability. Add "remote" to $.next.experimentalCacheDirectives; the CLI owns -D $REMOTE_CACHE_DEFINE.',
						value.metadata.pos);
				}
		}
	}

	/** Returns the type's one cache annotation, if present. */
	public static function find(type:ClassType):Null<CacheDirectiveDeclaration> {
		final entries = type.meta.get().filter(entry -> METADATA.contains(entry.name));
		if (entries.length == 0) {
			return null;
		}
		if (entries.length != 1) {
			return fail("NXHX-CACHE-METADATA-0002",
				'${fullTypeName(type)} declares multiple cache variants; choose exactly one of @:next.cache, @:next.cachePrivate, or @:next.cacheRemote.',
				entries[1].pos);
		}
		final value = declarationFor(entries[0]);
		requireCapabilities(type, value);
		return value;
	}

	/** Requires the zero-argument form used as a page/layout module modifier. */
	public static function modifier(type:ClassType):Null<CacheDirectiveDeclaration> {
		final value = find(type);
		if (value == null) {
			return null;
		}
		if (value.metadata.params.length != 0) {
			return fail("NXHX-CACHE-METADATA-0002",
				'${value.metadata.name} modifies ${fullTypeName(type)} at module scope and therefore accepts no path argument.', value.metadata.pos);
		}
		return value;
	}
	#end
}
