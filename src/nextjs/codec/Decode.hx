package nextjs.codec;

#if macro
import haxe.macro.Expr;
#end

/** Small constructors shared by the JSON, form, and query decoders. */
class Decode {
	/**
	 * Constructs a decoded value while preserving its Haxe-proven closed type.
	 *
	 * The compile-time witness matters for values such as String-backed domain
	 * abstracts: Haxe checks the closed type before its runtime representation
	 * becomes `String`, and genes emits that exact type argument on the ordinary
	 * generated call. The witness is never evaluated or present at runtime.
	 */
	public static macro function accept(value:Expr):Expr {
		return macro genes.ts.TypeArguments.call(nextjs.codec.Decode.acceptTyped($value), $value);
	}

	/**
	 * Runtime implementation selected by `accept`.
	 *
	 * Application code uses `accept`; this directly emitted generic callable is
	 * public only so the expanded typed call retains stable declaration identity.
	 */
	@:noCompletion
	@:ts.explicitTypeArguments
	public static function acceptTyped<T>(value:T):DecodeResult<T> {
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
