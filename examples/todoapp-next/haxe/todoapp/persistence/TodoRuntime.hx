package todoapp.persistence;

import js.lib.Error;
import js.lib.Promise;

@:jsRequire("node:timers/promises")
private extern class NodeTimers {
	static function setTimeout(milliseconds:Int):Promise<Void>;
}

/**
 * Waits for one explicitly bounded delay to make loading evidence repeatable.
 *
 * This is a server module function rather than a static utility class. The
 * allowlist prevents arbitrary environment text from becoming a timer value;
 * the native Node promise timer still owns scheduling.
 */
function waitForDetail():Promise<Void> {
	final raw = NodeProcess.env.NEXTJSHX_TODO_DETAIL_DELAY_MS.orNull();
	return switch raw {
		case null, "", "0": NodeTimers.setTimeout(0);
		case "250": NodeTimers.setTimeout(250);
		case "500": NodeTimers.setTimeout(500);
		case "750": NodeTimers.setTimeout(750);
		case "1000": NodeTimers.setTimeout(1000);
		case "2000": NodeTimers.setTimeout(2000);
		case _: throw new Error("NEXTJSHX_TODO_DETAIL_DELAY_MS must be 0, 250, 500, 750, 1000, or 2000");
	};
}
