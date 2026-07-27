package commerce.app;

import genes.react.Element;
import nextjs.app.LayoutProps;
import nextjs.raw.metadata.Metadata;
import nextjs.route.NoParams;

/**
 * `@:next.layout("")` maps this checked class to the root `app/layout.tsx`.
 * Its children and metadata remain native Next layout/export semantics.
 */
@:next.layout("")
class RootLayout {
	public static final metadata:Metadata = {
		title: "Common Ground — Grow beautifully indoors",
		description: "Modular indoor growing systems and durable seed tools, authored as a Haxe/NextJsHx commerce showcase."
	};

	public static function render(props:LayoutProps<NoParams>):Element {
		return <html lang="en">
			<head>
				<meta name="theme-color" content="#f4f3cf" />
				<link rel="stylesheet" href="/styles.css" />
				<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='14' fill='%2327182e'/%3E%3Cpath d='M32 50V25m0 10c-13 0-17-9-17-17 12 0 17 6 17 17Zm0-3c12 0 17-8 17-16-11 0-17 6-17 16Z' fill='none' stroke='%23e8ff49' stroke-width='4'/%3E%3C/svg%3E" />
			</head>
			<body>{props.children}</body>
		</html>;
	}
}
