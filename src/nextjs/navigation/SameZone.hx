package nextjs.navigation;

#if macro
import haxe.macro.Expr;
#end

/** Explicit literal constructor for a same-zone Next client transition. */
class SameZone {
	public static macro function href(value:Expr):Expr {
		return nextjshx.route.NavigationHrefMacro.sameZone(value);
	}
}
