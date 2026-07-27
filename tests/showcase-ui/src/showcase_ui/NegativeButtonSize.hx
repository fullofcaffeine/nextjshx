package showcase_ui;

import showcase.ui.Button.ButtonProps;

/** Proves arbitrary strings cannot widen the reviewed shadcn size union. */
class NegativeButtonSize {
	public static function main():Void {
		final props:ButtonProps = {size: "heroic"};
		trace(props);
	}
}
