package field_atlas.content;

/** Minimal typed Node file boundary for the local remote-content simulation. */
@:jsRequire("node:fs")
private extern class NodeFiles {
	static function readFileSync(path:String, encoding:String):String;
}

@:jsRequire("node:process")
private extern class NodeProcess {
	static function cwd():String;
}

@:jsRequire("node:path")
private extern class NodePath {
	static function join(first:String, second:String, third:String):String;
}

class LocalContentFiles {
	public static function readBrief():String {
		return NodeFiles.readFileSync(NodePath.join(NodeProcess.cwd(), "content", "remote-brief.json"), "utf8");
	}
}
