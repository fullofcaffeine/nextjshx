package nextjs.raw.navigation;

import haxe.extern.EitherType;

/** Closed redirect history behaviors exported by `next/navigation`. */
@:ts.type("'push' | 'replace'")
enum abstract RedirectType(String) to String {
	final Push = "push";
	final Replace = "replace";
}

/** Runtime shape of Next's `RedirectType` value export. */
typedef RedirectTypes = {
	final push:RedirectPush;
	final replace:RedirectReplace;
}

/** Exact type of the runtime `RedirectType.push` property. */
@:ts.type("'push'")
extern class RedirectPush {}

/** Exact type of the runtime `RedirectType.replace` property. */
@:ts.type("'replace'")
extern class RedirectReplace {}

/** Exact union carried by the two properties of Next's runtime value export. */
@:ts.type("'push' | 'replace'")
typedef RedirectRuntimeType = EitherType<RedirectPush, RedirectReplace>;
