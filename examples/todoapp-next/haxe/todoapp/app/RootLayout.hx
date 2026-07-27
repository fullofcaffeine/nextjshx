package todoapp.app;

import genes.react.Element;
import nextjs.app.LayoutProps;
import nextjs.raw.components.Link;
import nextjs.raw.metadata.Metadata;
import nextjs.route.NoParams;
import todoapp.ui.TodoStyles;

/**
 * `@:next.layout("")` owns the root `app/layout.tsx` adapter and validates the
 * required children contract. Static metadata and the document shell remain
 * ordinary Next layout exports and markup.
 */
@:next.layout("")
class RootLayout {
	public static final metadata:Metadata = {
		title: "Field Ledger — NextJsHx",
		description: "A server-rendered todo ledger authored in typed Haxe and executed by Next.js."
	};

	public static function render(props:LayoutProps<NoParams>):Element {
		return <html lang="en">
			<head>
				<meta name="theme-color" content="#f3eddf" />
				<link rel="stylesheet" href="/styles.css" />
				<style>{TodoStyles.css()}</style>
			</head>
			<body>
				<div className="shell">
					<header className="masthead">
						<Link className="brand" href={TodoListPage.href()}>Field Ledger</Link>
						<span className="edition">NextJsHx / action edition</span>
					</header>
					{props.children}
				</div>
			</body>
		</html>;
	}
}
