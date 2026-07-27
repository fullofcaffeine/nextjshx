package nextjs.codec;

/** Small constructors shared by the JSON, form, and query decoders. */
class Decode {
	/**
	 * Constructs a decoded value while preserving its Haxe-proven closed type.
	 *
	 * The named generic boundary matters for values such as String-backed domain
	 * abstracts whose runtime representation is a string but whose public
	 * TypeScript type must remain the closed literal union.
	 */
	public static function accept<T>(value:T):DecodeResult<T> {
		return Decoded(value);
	}

	public static function reject<T>(code:DecodeIssueCode, path:String, message:String):DecodeResult<T> {
		return Rejected([{code: code, path: path, message: message}]);
	}

	public static function rejected<T>(issues:Array<DecodeIssue>):DecodeResult<T> {
		return Rejected(issues);
	}

	public static inline function fieldPath(parent:String, name:String):String {
		return parent + "." + name;
	}

	public static inline function indexPath(parent:String, index:Int):String {
		return parent + "[" + index + "]";
	}
}
