package nextjshx.route;

#if macro
import haxe.macro.Context;
import haxe.macro.Expr;
#end

using Lambda;
using StringTools;

/** Shared literal validation for explicit same-zone and cross-zone navigation. */
class NavigationHrefMacro {
	#if macro
	static function fail(code:String, message:String, position:Position):Void {
		Context.error('[$code] $message', position);
	}

	static function containsUnsafeCharacter(value:String):Bool {
		for (index in 0...value.length) {
			final code = StringTools.fastCodeAt(value, index);
			if (code <= 32 || code == 34 || code == 39 || code == 92 || code == 127) {
				return true;
			}
		}
		return false;
	}

	static function literal(value:Expr, label:String, code:String):String {
		return switch value.expr {
			case EConst(CString(path, _)):
				if (!path.startsWith("/") || path.startsWith("//")) {
					fail(code, '$label must be one root-relative path beginning with exactly one slash.', value.pos);
				}
				if (containsUnsafeCharacter(path)) {
					fail(code, '$label must not contain whitespace, controls, backslashes, or quotes.', value.pos);
				}
				final pathname = path.split("?")[0].split("#")[0];
				if (pathname.split("/").exists(segment -> segment == "." || segment == "..")) {
					fail(code, '$label must not contain current-directory or parent-directory segments.', value.pos);
				}
				path;
			case _:
				fail(code, '$label requires one compile-time string literal so navigation intent is reviewable.', value.pos);
				"/";
		};
	}

	public static function sameZone(value:Expr):Expr {
		final path = literal(value, "Same-zone href", "NXHX-NAV-SAME-ZONE-0001");
		return macro @:pos(value.pos) @:privateAccess nextjs.route.SameZoneHref.fromValidatedString($v{path});
	}

	public static function crossZone(value:Expr):Expr {
		final path = literal(value, "Cross-zone href", "NXHX-NAV-CROSS-ZONE-0002");
		return macro @:pos(value.pos) @:privateAccess nextjs.route.CrossZoneHref.fromValidatedString($v{path});
	}
	#end
}
