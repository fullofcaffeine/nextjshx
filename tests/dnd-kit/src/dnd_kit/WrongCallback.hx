package dnd_kit;

import genes.react.Element;
import nextjs.raw.integrations.dndkit.DragDropProvider;

/** Provider callbacks receive the reviewed drag-end event, not an open value. */
class WrongCallback {
	static function main():Void {
		consume(render());
	}

	public static function render():Element {
		final callback = (label:String) -> {};
		return <DragDropProvider onDragEnd={callback}><p>Invalid callback</p></DragDropProvider>;
	}

	static function consume<T>(_value:T):Void {}
}
