package page_layouts.positive;

import genes.react.Element;
import nextjs.app.LayoutProps;
import nextjs.route.NoParams;

/**
 * Owns one App Router layout as a normal Haxe module function.
 *
 * The annotation is compile-time ownership metadata; the generated native
 * adapter still exposes the exact default `layout.tsx` function expected by
 * Next.js, and no runtime class is introduced for namespacing.
 * `@:next.css` adds a normal CSS import to that adapter after checking that the
 * co-located stylesheet exists. Next still owns the CSS build and browser update.
 */
@:next.layout("module-shell")
@:next.css("./shell.css")
@:next.css("design-system/theme.css")
function render(props:LayoutProps<NoParams>):Element {
	return <section data-module-layout="true">{props.children}</section>;
}
