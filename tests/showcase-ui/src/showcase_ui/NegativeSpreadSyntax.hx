package showcase_ui;

import genes.react.Element;
import showcase.ui.Icons.ArrowUpRight;

/** Proves a spread without an expression is rejected while parsing HXX. */
class NegativeSpreadSyntax {
	public static function main():Void {}

	public static function render():Element {
		return <ArrowUpRight {...} />;
	}
}
