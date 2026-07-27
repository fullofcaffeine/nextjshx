package server_functions.app;

import genes.react.Element;
import nextjs.app.LayoutProps;
import nextjs.route.NoParams;

/** Haxe-owned root layout for the production action fixture. */
@:next.layout("")
class RootLayout {
	public static function render(props:LayoutProps<NoParams>):Element {
		return <html lang={"en"}>
			<head><link rel={"icon"} href={"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='16' fill='%232b241b'/%3E%3Cpath d='M18 32h28M32 18v28' stroke='%23f1ece2' stroke-width='6'/%3E%3C/svg%3E"} /></head>
			<body style={{margin: "0", background: "#f1ece2", color: "#2b241b", fontFamily: "Avenir Next, sans-serif"}}>{props.children}</body>
		</html>;
	}
}
