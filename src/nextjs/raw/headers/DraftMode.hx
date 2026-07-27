package nextjs.raw.headers;

/** Async draft-mode controller exposed by `next/headers`. */
@:ts.type("Awaited<ReturnType<typeof import('next/headers').draftMode>>")
extern class DraftMode {
	final isEnabled:Bool;
	function disable():Void;
	function enable():Void;
}
