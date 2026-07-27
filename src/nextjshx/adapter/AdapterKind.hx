package nextjshx.adapter;

/** Identifies the reviewed Next-native adapter shapes represented by a plan. */
enum abstract AdapterKind(String) to String {
	var Page = "page";
	var Layout = "layout";
	var Loading = "loading";
	var Error = "error";
	var NotFound = "not-found";
	var DefaultFallback = "default";
	var RouteHandler = "route-handler";
	var ClientComponent = "client-component";
	var ReactHook = "react-hook";
	var ServerFunction = "server-function";
	var CacheFunction = "cache-function";
	var Proxy = "proxy";
	var MdxComponents = "mdx-components";
}
