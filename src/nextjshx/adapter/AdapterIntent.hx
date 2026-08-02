package nextjshx.adapter;

import haxe.ds.ReadOnlyArray;

/**
 * An immutable request to render one Next-native adapter file.
 *
 * Registration and validation happen during Haxe typing. This value contains
 * no callbacks or application values, so serializing it cannot execute app
 * code and does not imply permission to publish its target.
 */
@:structInit
class AdapterIntent {
	public final kind:AdapterKind;
	public final source:AdapterSource;
	public final segmentPath:String;
	public final targetPath:String;
	public final implementation:AdapterImplementation;
	public final sideEffectImports:ReadOnlyArray<String>;
	public final imports:ReadOnlyArray<AdapterImport>;
	public final directives:ReadOnlyArray<String>;
	public final exports:ReadOnlyArray<AdapterExport>;
	public final config:ReadOnlyArray<AdapterConfig>;

	public function new(kind:AdapterKind, source:AdapterSource, segmentPath:String, targetPath:String, implementation:AdapterImplementation,
			sideEffectImports:Array<String>, imports:Array<AdapterImport>, directives:Array<String>, exports:Array<AdapterExport>,
			config:Array<AdapterConfig>) {
		this.kind = kind;
		this.source = source;
		this.segmentPath = segmentPath;
		this.targetPath = targetPath;
		this.implementation = implementation;
		this.sideEffectImports = sideEffectImports.copy();
		this.imports = imports.copy();
		this.directives = directives.copy();
		this.exports = exports.copy();
		this.config = config.copy();
	}
}
