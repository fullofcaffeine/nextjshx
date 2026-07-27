package client_components.server;

import genes.react.Element;

/** Ordinary reusable Server Component: no NextJsHx base class or marker. */
class ServerSummary {
	public static function render(label:String):Element {
		return <aside id={"server-summary"}>{label}</aside>;
	}
}
