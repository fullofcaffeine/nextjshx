package nextjs.content;

/** Reviewed syntax labels accepted from portable content sources. */
enum abstract CodeLanguage(String) to String {
	final Haxe = "haxe";
	final TypeScript = "typescript";
	final Tsx = "tsx";
	final Json = "json";
	final Bash = "bash";
	final Text = "text";
}
