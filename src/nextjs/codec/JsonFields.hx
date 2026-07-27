package nextjs.codec;

import genes.ts.UnknownRecord;

/** Read-only field access available only inside an exact JSON object decoder. */
class JsonFields {
	final record:UnknownRecord;
	final parentPath:String;

	@:allow(nextjs.codec.Decoders)
	private function new(record:UnknownRecord, parentPath:String) {
		this.record = record;
		this.parentPath = parentPath;
	}

	public function required<T>(name:String, decoder:Decoder<T>):DecodeResult<T> {
		final path = Decode.fieldPath(parentPath, name);
		if (!record.hasOwn(name)) {
			return Decode.reject(DecodeIssueCode.MissingField, path, 'required field "$name" is missing');
		}
		return decoder(record.get(name), path);
	}

	public function optional<T>(name:String, decoder:Decoder<T>):DecodeResult<Null<T>> {
		if (!record.hasOwn(name)) {
			return Decoded(null);
		}
		return switch decoder(record.get(name), Decode.fieldPath(parentPath, name)) {
			case Decoded(value): Decoded(value);
			case Rejected(issues): Rejected(issues);
		};
	}
}
