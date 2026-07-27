package next_binding_pipeline;

import genes.ts.Undefinable;
import nextjs.raw.ServerRuntime;
import nextjs.raw.ServerRuntime.ServerRuntimeValue;

class GeneratedConsumer {
	static function main():Void {
		final nodeValue:ServerRuntimeValue = ServerRuntimeValue.NodeJs;
		final edgeValue:ServerRuntimeValue = ServerRuntimeValue.Edge;
		final node:ServerRuntime = nodeValue;
		final edge:ServerRuntime = edgeValue;
		final absent:ServerRuntime = Undefinable.absent();

		consume(node);
		consume(edge);
		consume(absent);
	}

	static function consume(_:ServerRuntime):Void {}
}
