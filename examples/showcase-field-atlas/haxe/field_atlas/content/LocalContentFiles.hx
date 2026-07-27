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

/**
 * Reads the example's CMS-like payload through a minimal typed Node boundary.
 *
 * The function is module-scoped because there is no file-service instance or
 * class identity. It returns raw text deliberately: `BriefingPage` must decode
 * that external value before it can become trusted portable content.
 */
function readBrief():String {
	return NodeFiles.readFileSync(NodePath.join(NodeProcess.cwd(), "content", "remote-brief.json"), "utf8");
}
