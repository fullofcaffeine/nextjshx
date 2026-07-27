package nextjs.codec;

import nextjs.raw.server.WebFormData;

using StringTools;

/** Closed-schema decoder entry point for native request and action form data. */
class FormDataDecoder {
	public static function object<T>(data:WebFormData, allowedFields:Array<String>, build:FormFields->DecodeResult<T>):DecodeResult<T> {
		return decode(data, allowedFields, false, build);
	}

	/**
	 * Decodes a Next/React Server Action form while hiding its reserved transport
	 * fields. User-controlled names remain closed-schema checked.
	 *
	 * Next supplies `$ACTION_*` entries alongside application fields. Treating
	 * those framework-owned names as application input makes an otherwise valid
	 * action fail, while allowing arbitrary extra names would weaken validation.
	 */
	public static function serverAction<T>(data:WebFormData, allowedFields:Array<String>, build:FormFields->DecodeResult<T>):DecodeResult<T> {
		return decode(data, allowedFields, true, build);
	}

	static function decode<T>(data:WebFormData, allowedFields:Array<String>, ignoreActionTransport:Bool, build:FormFields->DecodeResult<T>):DecodeResult<T> {
		final actual = collectKeys(data.keys());
		final unexpected:Array<String> = [];
		for (name in actual) {
			final frameworkOwned = ignoreActionTransport && name.startsWith("$ACTION_");
			if (!frameworkOwned && allowedFields.indexOf(name) == -1 && unexpected.indexOf(name) == -1) {
				unexpected.push(name);
			}
		}
		unexpected.sort((left, right) -> left < right ? -1 : left > right ? 1 : 0);
		if (unexpected.length > 0) {
			final issues:Array<DecodeIssue> = [];
			for (name in unexpected) {
				issues.push({
					code: DecodeIssueCode.UnexpectedField,
					path: Decode.fieldPath("form", name),
					message: 'field "$name" is not allowed'
				});
			}
			return Rejected(issues);
		}
		return build(new FormFields(data));
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
