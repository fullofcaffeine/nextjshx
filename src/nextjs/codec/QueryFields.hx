package nextjs.codec;

import nextjs.raw.server.WebSearchParams;

/** Exact scalar, optional, and repeated reads from native URL search params. */
class QueryFields {
	final params:WebSearchParams;

	@:allow(nextjs.codec.QueryDecoder)
	private function new(params:WebSearchParams) {
		this.params = params;
	}

	public function required<T>(name:String, decoder:TextDecoder<T>):DecodeResult<T> {
		final values = params.getAll(name);
		final path = Decode.fieldPath("query", name);
		if (values.length == 0) {
			return Decode.reject(DecodeIssueCode.MissingField, path, 'required field "$name" is missing');
		}
		return values.length == 1 ? decoder(values[0],
			path) : Decode.reject(DecodeIssueCode.ExpectedSingleValue, path, 'field "$name" must occur exactly once');
	}

	public function optional<T>(name:String, decoder:TextDecoder<T>):DecodeResult<Null<T>> {
		final values = params.getAll(name);
		final path = Decode.fieldPath("query", name);
		if (values.length == 0) {
			return Decoded(null);
		}
		if (values.length != 1) {
			return Decode.reject(DecodeIssueCode.ExpectedSingleValue, path, 'field "$name" must occur at most once');
		}
		return switch decoder(values[0], path) {
			case Decoded(value): Decoded(value);
			case Rejected(issues): Rejected(issues);
		};
	}

	public function many<T>(name:String, decoder:TextDecoder<T>):DecodeResult<Array<T>> {
		final values = params.getAll(name);
		final decoded:Array<T> = [];
		final issues:Array<DecodeIssue> = [];
		for (index in 0...values.length) {
			switch decoder(values[index], Decode.indexPath(Decode.fieldPath("query", name), index)) {
				case Decoded(value):
					decoded.push(value);
				case Rejected(itemIssues):
					for (issue in itemIssues) {
						issues.push(issue);
					}
			}
		}
		return issues.length == 0 ? Decoded(decoded) : Rejected(issues);
	}
}
