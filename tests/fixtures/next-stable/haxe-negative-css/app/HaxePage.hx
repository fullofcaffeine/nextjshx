package app;

import app.styles.HaxePageStyles;
import genes.css.CssModule.imported;

/** Proves that the generated companion rejects an unknown CSS class in Haxe. */
function main():Void {
	final styles:HaxePageStyles = imported("./haxe-page.module.css", "styles");
	trace(styles.missing);
}
