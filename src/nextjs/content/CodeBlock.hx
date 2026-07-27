package nextjs.content;

/** Display-only source text; it is rendered as text and never executed. */
typedef CodeBlock = {
	final language:CodeLanguage;
	final source:String;
	final caption:Null<String>;
}
