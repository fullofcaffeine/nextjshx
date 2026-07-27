package nextjs.codec;

import genes.ts.JsonCodec;
import genes.ts.Unknown;
import genes.ts.UnknownNarrow;

/** Composable runtime guards for JSON values received as `genes.ts.Unknown`. */
class Decoders {
	public static function string(value:Unknown, path:String):DecodeResult<String> {
		final decoded = UnknownNarrow.string(value);
		return decoded == null ? Decode.reject(DecodeIssueCode.ExpectedString, path, "expected a string") : Decoded(decoded);
	}

	public static function bool(value:Unknown, path:String):DecodeResult<Bool> {
		final decoded = UnknownNarrow.bool(value);
		return decoded == null ? Decode.reject(DecodeIssueCode.ExpectedBoolean, path, "expected a boolean") : Decoded(decoded);
	}

	public static function finiteNumber(value:Unknown, path:String):DecodeResult<Float> {
		final decoded = UnknownNarrow.finiteNumber(value);
		return decoded == null ? Decode.reject(DecodeIssueCode.ExpectedNumber, path, "expected a finite number") : Decoded(decoded);
	}

	public static function int32(value:Unknown, path:String):DecodeResult<Int> {
		final decoded = UnknownNarrow.int32(value);
		return decoded == null ? Decode.reject(DecodeIssueCode.ExpectedInteger, path, "expected a signed 32-bit integer") : Decoded(decoded);
	}

	public static function nullable<T>(decoder:Decoder<T>):Decoder<Null<T>> {
		return (value, path) -> {
			if (UnknownNarrow.isNull(value)) {
				return Decoded(null);
			}
			return switch decoder(value, path) {
				case Decoded(decoded): Decoded(decoded);
				case Rejected(issues): Rejected(issues);
			};
		};
	}

	public static function array<T>(item:Decoder<T>):Decoder<Array<T>> {
		return (value, path) -> {
			final input = UnknownNarrow.array(value);
			if (input == null) {
				return Decode.reject(DecodeIssueCode.ExpectedArray, path, "expected an array");
			}

			final decoded:Array<T> = [];
			final issues:Array<DecodeIssue> = [];
			for (index in 0...input.length) {
				switch item(input.get(index), Decode.indexPath(path, index)) {
					case Decoded(value): decoded.push(value);
					case Rejected(itemIssues):
						for (issue in itemIssues) {
							issues.push(issue);
						}
				}
			}
			return issues.length == 0 ? Decoded(decoded) : Rejected(issues);
		};
	}

	public static function object<T>(value:Unknown, path:String, allowedFields:Array<String>, build:JsonFields->DecodeResult<T>):DecodeResult<T> {
		if (JsonCodec.narrowObject(value) == null) {
			return Decode.reject(DecodeIssueCode.ExpectedObject, path, "expected a JSON object");
		}
		final record = UnknownNarrow.record(value);
		if (record == null) {
			return Decode.reject(DecodeIssueCode.ExpectedObject, path, "expected a JSON object");
		}

		final unexpected = unexpectedFields(record.keys(), allowedFields);
		if (unexpected.length > 0) {
			final issues:Array<DecodeIssue> = [];
			for (name in unexpected) {
				issues.push({
					code: DecodeIssueCode.UnexpectedField,
					path: Decode.fieldPath(path, name),
					message: 'field "$name" is not allowed'
				});
			}
			return Rejected(issues);
		}
		return build(new JsonFields(record, path));
	}

	static function unexpectedFields(actual:Array<String>, allowed:Array<String>):Array<String> {
		final result:Array<String> = [];
		for (name in actual) {
			if (allowed.indexOf(name) == -1 && result.indexOf(name) == -1) {
				result.push(name);
			}
		}
		result.sort((left, right) -> left < right ? -1 : left > right ? 1 : 0);
		return result;
	}
}
