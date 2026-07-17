package nextjshx.adapter;

/** Connects one adapter request to its Haxe declaration and metadata. */
@:structInit
class AdapterSource {
	public final typeName:String;
	public final fieldName:String;
	public final typePosition:AdapterSourcePosition;
	public final fieldPosition:AdapterSourcePosition;
	public final metadataPosition:AdapterSourcePosition;

	public function new(typeName:String, fieldName:String, typePosition:AdapterSourcePosition, fieldPosition:AdapterSourcePosition,
			metadataPosition:AdapterSourcePosition) {
		this.typeName = typeName;
		this.fieldName = fieldName;
		this.typePosition = typePosition;
		this.fieldPosition = fieldPosition;
		this.metadataPosition = metadataPosition;
	}

	public function displayName():String {
		return '$typeName.$fieldName';
	}
}
