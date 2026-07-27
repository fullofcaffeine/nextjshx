package nextjs.raw.server;

import haxe.extern.EitherType;
import js.lib.Promise;

/**
 * Explicit middleware result view.
 *
 * Return `null` to continue without a response; this avoids conflating Haxe
 * `Void` with JavaScript `undefined` while remaining assignable to Next's full
 * public result union.
 */
typedef NextMiddlewareResult = Null<WebResponse>;

typedef NextMiddlewareReturn = EitherType<NextMiddlewareResult, Promise<NextMiddlewareResult>>;
typedef NextMiddlewareFunction = (request:NextRequest, event:NextFetchEvent) -> NextMiddlewareReturn;

/** Deprecated middleware callable retained for migration compatibility. */
@:ts.type("import('next/server').NextMiddleware")
abstract NextMiddleware(NextMiddlewareFunction) from NextMiddlewareFunction {}
