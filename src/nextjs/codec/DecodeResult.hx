package nextjs.codec;

/** A decoded domain value or one or more typed input issues. */
enum DecodeResult<T> {
	Decoded(value:T);
	Rejected(issues:Array<DecodeIssue>);
}
