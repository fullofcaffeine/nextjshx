package nextjshx.adapter;

/** Identifies the reviewed Next-native adapter shapes represented by a plan. */
enum abstract AdapterKind(String) to String {
	var Page = "page";
	var Layout = "layout";
	var RouteHandler = "route-handler";
	var ClientComponent = "client-component";
	var ServerFunction = "server-function";
	var Proxy = "proxy";
}
