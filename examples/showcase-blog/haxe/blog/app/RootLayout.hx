package blog.app;

import genes.react.Element;
import nextjs.app.LayoutProps;
import nextjs.raw.metadata.Metadata;
import nextjs.route.NoParams;

/**
 * `@:next.layout("")` maps this class to `app/layout.tsx` and checks the
 * required root layout/children contract before the adapter is published.
 */
@:next.layout("")
class RootLayout {
	public static final metadata:Metadata = {
		title: "Moraine — Notes from the long trail",
		description: "A conservation field journal authored in Haxe and published through the Next.js App Router."
	};

	public static function render(props:LayoutProps<NoParams>):Element {
		return <html lang="en">
			<head>
				<meta name="theme-color" content="#f1eadb" />
				<link rel="stylesheet" href="/styles.css" />
				<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='32' fill='%2327392f'/%3E%3Cpath d='M13 43 29 17l8 13 5-7 10 20Z' fill='none' stroke='%23f1eadb' stroke-width='4' stroke-linejoin='round'/%3E%3C/svg%3E" />
			</head>
			<body>{props.children}</body>
		</html>;
	}
}
