package nextjshx.adapter;

/**
 * A portable Haxe source range retained by the adapter plan.
 *
 * Paths are repository-relative and slash-normalized by the macro registry so
 * emitted plans remain useful without leaking a compiler host's absolute path.
 */
@:structInit
class AdapterSourcePosition {
	public final file:String;
	public final startLine:Int;
	public final startCharacter:Int;
	public final endLine:Int;
	public final endCharacter:Int;

	public function new(file:String, startLine:Int, startCharacter:Int, endLine:Int, endCharacter:Int) {
		this.file = file;
		this.startLine = startLine;
		this.startCharacter = startCharacter;
		this.endLine = endLine;
		this.endCharacter = endCharacter;
	}

	public function displayStart():String {
		return '$file:$startLine:$startCharacter';
	}
}
