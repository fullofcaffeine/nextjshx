package nextjs.codec;

using StringTools;

/** Reusable text validators for form and URL query fields. */
class TextDecoders {
	public static function string(value:String, path:String):DecodeResult<String> {
		return Decoded(value);
	}

	public static function nonEmpty(maximumLength:Int):TextDecoder<String> {
		if (maximumLength < 1) {
			throw new js.lib.Error("nonEmpty maximumLength must be positive");
		}
		return (value,
			path) -> value == ""
				|| value.trim() != value
				|| value.length > maximumLength ? Decode.reject(DecodeIssueCode.InvalidValue, path,
					'expected non-empty trimmed text of at most $maximumLength characters') : Decoded(value);
	}

	public static function int32(value:String, path:String):DecodeResult<Int> {
		if (!~/^-?(?:0|[1-9][0-9]*)$/.match(value)) {
			return Decode.reject(DecodeIssueCode.ExpectedInteger, path, "expected a signed 32-bit integer");
		}
		final decoded = Std.parseFloat(value);
		if (decoded < -2147483648 || decoded > 2147483647) {
			return Decode.reject(DecodeIssueCode.ExpectedInteger, path, "expected a signed 32-bit integer");
		}
		return Decoded(Std.int(decoded));
	}

	public static function bool(value:String, path:String):DecodeResult<Bool> {
		return switch value {
			case "true": Decoded(true);
			case "false": Decoded(false);
			case _: Decode.reject(DecodeIssueCode.ExpectedBoolean, path, "expected true or false");
		};
	}

	public static function oneOf(values:Array<String>):TextDecoder<String> {
		final accepted = values.copy();
		return (value,
			path) -> accepted.indexOf(value) == -1 ? Decode.reject(DecodeIssueCode.InvalidValue, path,
				"expected one of " + accepted.join(", ")) : Decoded(value);
	}
}
