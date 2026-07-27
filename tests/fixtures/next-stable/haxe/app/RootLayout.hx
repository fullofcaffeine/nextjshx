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

/** Haxe-owned root shell reached through a generated Next-native adapter. */
@:next.layout("")
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
