package nextjs.codec;

/** Haxe-native composition without exceptions or nullable success values. */
class DecodeResultTools {
	public static function map<T, U>(result:DecodeResult<T>, transform:T->U):DecodeResult<U> {
		return switch result {
			case Decoded(value): Decoded(transform(value));
			case Rejected(issues): Rejected(issues);
		};
	}

	public static function flatMap<T, U>(result:DecodeResult<T>, transform:T->DecodeResult<U>):DecodeResult<U> {
		return switch result {
			case Decoded(value): transform(value);
			case Rejected(issues): Rejected(issues);
		};
	}
}
