package nextjshx.adapter;

/** Separates default and named Next exports without accepting raw TS snippets. */
enum abstract AdapterExportKind(String) to String {
	var Default = "default";
	var Named = "named";
}

/** Maps one generated export to a validated Haxe source field. */
@:structInit
class AdapterExport {
	public final kind:AdapterExportKind;
	public final name:String;
	public final sourceField:String;
	public final signature:String;

	public function new(kind:AdapterExportKind, name:String, sourceField:String, signature:String) {
		this.kind = kind;
		this.name = name;
		this.sourceField = sourceField;
		this.signature = signature;
	}
}
