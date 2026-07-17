package nextjshx.route;

#if macro
import haxe.macro.Context;
import haxe.macro.Expr.Position;
#end

/** Attaches pure route-parser failures to the owning Haxe declaration. */
class RoutePatternMacro {
	#if macro
	public static function parse(path:String, position:Position):RoutePattern {
		return switch RoutePatternParser.parse(path) {
			case Parsed(pattern): pattern;
			case Rejected(diagnostic):
				Context.error('[${diagnostic.code}] ${diagnostic.message}', position);
				new RoutePattern("", "/", [], []);
		};
	}
	#end
}
