package nextjs.codec;

import genes.ts.Unknown;
import genes.ts.UnknownNarrow;
import nextjs.raw.server.WebFormData;
import nextjs.raw.server.WebFormData.WebFormDataEntry;

/** Exact, text-only reads from a native `FormData` object. */
class FormFields {
	final data:WebFormData;

	@:allow(nextjs.codec.FormDataDecoder)
	private function new(data:WebFormData) {
		this.data = data;
	}

	public function required<T>(name:String, decoder:TextDecoder<T>):DecodeResult<T> {
		final values = data.getAll(name);
		final path = Decode.fieldPath("form", name);
		if (values.length == 0) {
			return Decode.reject(DecodeIssueCode.MissingField, path, 'required field "$name" is missing');
		}
		if (values.length != 1) {
			return Decode.reject(DecodeIssueCode.ExpectedSingleValue, path, 'field "$name" must occur exactly once');
		}
		final text = textEntry(values[0]);
		return text == null ? Decode.reject(DecodeIssueCode.ExpectedText, path, 'field "$name" must be text, not a file') : decoder(text, path);
	}

	public function optional<T>(name:String, decoder:TextDecoder<T>):DecodeResult<Null<T>> {
		final values = data.getAll(name);
		final path = Decode.fieldPath("form", name);
		if (values.length == 0) {
			return Decoded(null);
		}
		if (values.length != 1) {
			return Decode.reject(DecodeIssueCode.ExpectedSingleValue, path, 'field "$name" must occur at most once');
		}
		final text = textEntry(values[0]);
		if (text == null) {
			return Decode.reject(DecodeIssueCode.ExpectedText, path, 'field "$name" must be text, not a file');
		}
		return switch decoder(text, path) {
			case Decoded(value): Decoded(value);
			case Rejected(issues): Rejected(issues);
		};
	}

	public function many<T>(name:String, decoder:TextDecoder<T>):DecodeResult<Array<T>> {
		final values = data.getAll(name);
		final decoded:Array<T> = [];
		final issues:Array<DecodeIssue> = [];
		for (index in 0...values.length) {
			final path = Decode.indexPath(Decode.fieldPath("form", name), index);
			final text = textEntry(values[index]);
			if (text == null) {
				issues.push({code: DecodeIssueCode.ExpectedText, path: path, message: 'field "$name" must contain text, not a file'});
			} else {
				switch decoder(text, path) {
					case Decoded(value):
						decoded.push(value);
					case Rejected(itemIssues):
						for (issue in itemIssues) {
							issues.push(issue);
						}
				}
			}
		}
		return issues.length == 0 ? Decoded(decoded) : Rejected(issues);
	}

	static function textEntry(value:WebFormDataEntry):Null<String> {
		// Haxe's extern EitherType has no checked branch operation. Mark this one
		// closed DOM union value as unknown only while the runtime string guard
		// validates it; callers receive a String or null, never the broad value.
		return UnknownNarrow.string(Unknown.fromBoundary(value));
	}
}
