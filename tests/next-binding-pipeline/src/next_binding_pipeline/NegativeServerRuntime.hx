package next_binding_pipeline;

import nextjs.raw.ServerRuntime.ServerRuntimeValue;

class NegativeServerRuntime {
	static function main():Void {
		final invalid:ServerRuntimeValue = "deno";
		trace(invalid);
	}
}
