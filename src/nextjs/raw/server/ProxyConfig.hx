package nextjs.raw.server;

import nextjs.raw.server.MiddlewareConfig.MiddlewareConfigFields;

/** Current configuration name for Next's request proxy boundary. */
@:ts.type("import('next/server').ProxyConfig")
abstract ProxyConfig(MiddlewareConfigFields) from MiddlewareConfigFields {}
