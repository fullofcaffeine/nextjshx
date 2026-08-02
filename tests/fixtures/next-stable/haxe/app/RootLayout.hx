package app;

import genes.react.Element;
import nextjs.app.LayoutProps;
import nextjs.raw.react.ReactNode;
import nextjs.route.NoParams;

/** Closed projection of the root layout's immediate `@modal` slot. */
@:next.layoutSlots
typedef RootLayoutProps = {
	> LayoutProps<NoParams>,
	final modal:ReactNode;
}

/**
 * Haxe-owned root shell reached through a generated Next-native adapter.
 *
 * This fixture deliberately keeps the compatibility class form so it also
 * protects class-backed layouts. New application layouts should normally use
 * the module-level function form shown in `docs/pages-and-layouts.md`.
 */
// `@:next.css` asks NextJsHx to place a normal `import "./globals.css"` in the
// generated root layout. Next.js still owns CSS ordering, bundling, and browser
// updates; this does not copy CSS, add a runtime `<link>`, or start another watcher.

@:next.layout("") @:next.css("./globals.css")
class RootLayout {
	public static function render(props:RootLayoutProps):Element {
		return <html lang="en">
      <body>
        <header id="nextjshx-fixture">
          <h1>Haxe → genes-ts → Next.js</h1>
        </header>
        {props.children}
				<div id="parallel-modal-slot">{props.modal}</div>
      </body>
    </html>;
	}
}
