package todoapp.app;

import genes.react.Element;
import nextjs.app.LayoutProps;
import nextjs.raw.components.Link;
import nextjs.raw.metadata.Metadata;
import nextjs.route.NoParams;
import todoapp.ui.TodoStyles;

/** Haxe-owned document shell and visual system for the maintained evidence app. */
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
