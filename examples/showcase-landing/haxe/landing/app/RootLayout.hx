package landing.app;

import genes.react.Element;
import nextjs.app.LayoutProps;
import nextjs.raw.metadata.Metadata;
import nextjs.route.NoParams;

@:next.layout("")
class RootLayout {
	public static final metadata:Metadata = {
		title: "Pelagic Signal — Coastal intelligence, made legible",
		description: "A Haxe-authored Next.js landing experience for a fictional coastal intelligence platform."
	};

	public static function render(props:LayoutProps<NoParams>):Element {
		return <html lang="en">
			<head>
				<meta name="theme-color" content="#07191d" />
				<link rel="stylesheet" href="/styles.css" />
				<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='12' fill='%2307191d'/%3E%3Cpath d='M8 37c10-14 17 13 27-1s13 3 21 8' fill='none' stroke='%237df9e7' stroke-width='6' stroke-linecap='round'/%3E%3C/svg%3E" />
			</head>
			<body>{props.children}</body>
		</html>;
	}
}
