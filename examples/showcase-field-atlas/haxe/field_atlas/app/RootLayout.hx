package field_atlas.app;

import genes.react.Element;
import nextjs.app.LayoutProps;
import nextjs.raw.metadata.Metadata;
import nextjs.route.NoParams;

@:next.layout("")
class RootLayout {
	public static final metadata:Metadata = {
		title: "Field Atlas — Signals from living systems",
		description: "An editorial research atlas authored in Haxe, local MDX, and closed portable content blocks."
	};

	public static function render(props:LayoutProps<NoParams>):Element {
		return <html lang="en">
			<head>
				<meta name="theme-color" content="#e8e4d8" />
				<link rel="stylesheet" href="/styles.css" />
				<link rel="icon" href="/atlas-mark.svg" />
			</head>
			<body>{props.children}</body>
		</html>;
	}
}
