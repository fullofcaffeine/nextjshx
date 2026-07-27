package todoapp.persistence;

private typedef NodeWriteOptions = {
	final encoding:String;
	final mode:Int;
}

private typedef NodeDirectoryOptions = {
	final recursive:Bool;
	final mode:Int;
}

/** Minimal typed Node file-system seam required by the Node-runtime example. */
@:jsRequire("node:fs")
extern class NodeFiles {
	static function existsSync(path:String):Bool;
	static function readFileSync(path:String, encoding:String):String;
	static function mkdirSync(path:String, options:NodeDirectoryOptions):Void;
	static function writeFileSync(path:String, data:String, options:NodeWriteOptions):Void;
	static function chmodSync(path:String, mode:Int):Void;
	static function renameSync(oldPath:String, newPath:String):Void;
}
