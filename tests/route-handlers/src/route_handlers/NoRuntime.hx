package route_handlers;

import route_handlers.positive.EchoHandlers;

class NoRuntime {
	static function retain(value:String):Void {}

	public static function main():Void {
		retain(EchoHandlers.href({id: "hello world"}));
	}
}
