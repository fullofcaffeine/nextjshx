package todoapp.persistence;

import genes.ts.Undefinable;

private typedef NodeProcessEnvironment = {
	final NEXTJSHX_TODO_DETAIL_DELAY_MS:Undefinable<String>;
	final NEXTJSHX_TODO_RUN_ID:Undefinable<String>;
}

/** Exact process identity used only to make atomic fixture writes collision-safe. */
@:jsRequire("node:process")
extern class NodeProcess {
	static final pid:Int;
	static final env:NodeProcessEnvironment;
}
