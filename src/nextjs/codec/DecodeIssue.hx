package nextjs.codec;

/** One deterministic, serializable input problem. */
typedef DecodeIssue = {
	final code:DecodeIssueCode;
	final path:String;
	final message:String;
}
