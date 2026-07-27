package nextjs.navigation;

#if macro
import haxe.macro.Expr;
#end

/** Explicit literal constructor for a full-page transition to another zone. */
class CrossZone {
	public static macro function href(value:Expr):Expr {
		return nextjshx.route.NavigationHrefMacro.crossZone(value);
	}
}
