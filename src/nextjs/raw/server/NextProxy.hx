package nextjs.raw.server;

import nextjs.raw.server.NextMiddleware.NextMiddlewareFunction;

/** Current callable name for Next's request interception boundary. */
@:ts.type("import('next/server').NextProxy")
abstract NextProxy(NextMiddlewareFunction) from NextMiddlewareFunction {}
