package nextjs.codec;

/** Stable machine-readable reasons produced at external input boundaries. */
enum abstract DecodeIssueCode(String) to String {
	final InvalidJson = "invalid_json";
	final InvalidFormData = "invalid_form_data";
	final ExpectedObject = "expected_object";
	final ExpectedArray = "expected_array";
	final ExpectedString = "expected_string";
	final ExpectedBoolean = "expected_boolean";
	final ExpectedNumber = "expected_number";
	final ExpectedInteger = "expected_integer";
	final ExpectedText = "expected_text";
	final ExpectedSingleValue = "expected_single_value";
	final MissingField = "missing_field";
	final UnexpectedField = "unexpected_field";
	final InvalidValue = "invalid_value";
}
