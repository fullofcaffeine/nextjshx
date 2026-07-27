package nextjs.codec;

import nextjs.raw.server.WebSearchParams;

/** Closed-schema decoder entry point for `NextRequest.nextUrl.searchParams`. */
class QueryDecoder {
	public static function object<T>(params:WebSearchParams, allowedFields:Array<String>, build:QueryFields->DecodeResult<T>):DecodeResult<T> {
		final actual = collectKeys(params.keys());
		final unexpected:Array<String> = [];
		for (name in actual) {
			if (allowedFields.indexOf(name) == -1 && unexpected.indexOf(name) == -1) {
				unexpected.push(name);
			}
		}
		unexpected.sort((left, right) -> left < right ? -1 : left > right ? 1 : 0);
		if (unexpected.length > 0) {
			final issues:Array<DecodeIssue> = [];
			for (name in unexpected) {
				issues.push({
					code: DecodeIssueCode.UnexpectedField,
					path: Decode.fieldPath("query", name),
					message: 'field "$name" is not allowed'
				});
			}
			return Rejected(issues);
		}
		return build(new QueryFields(params));
	}

	static function collectKeys(iterator:js.lib.Iterator<String>):Array<String> {
		final keys:Array<String> = [];
		var step = iterator.next();
		while (!step.done) {
			if (step.value != null) {
				keys.push(step.value);
			}
			step = iterator.next();
		}
		return keys;
	}
}
