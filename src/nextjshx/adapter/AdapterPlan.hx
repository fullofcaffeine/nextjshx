package nextjshx.adapter;

import haxe.ds.ReadOnlyArray;

/** Canonical, versioned input for adapter rendering and ownership preflight. */
@:structInit
class AdapterPlan {
	public static inline final SCHEMA_VERSION:Int = 1;
	public static inline final SCHEMA_ID:String = "https://nextjshx.dev/schemas/adapter-plan.schema.json";

	public final toolchain:AdapterToolchain;
	public final intents:ReadOnlyArray<AdapterIntent>;

	public function new(toolchain:AdapterToolchain, intents:Array<AdapterIntent>) {
		this.toolchain = toolchain;
		this.intents = intents.copy();
	}
}
