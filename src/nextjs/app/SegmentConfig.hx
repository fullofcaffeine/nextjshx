package nextjs.app;

#if macro
import haxe.macro.Expr;
#end

/**
 * Compile-time-only segment configuration marker.
 *
 * Assign `SegmentConfig.create({...})` to a page or layout's public static
 * final `segment` field. The declaration macro validates the literal object,
 * records native Next exports, and removes the marker before runtime output.
 */
abstract SegmentConfig(Void) {
	#if macro
	public static macro function create(value:Expr):Expr {
		return nextjshx.app.SegmentConfigMacro.rejectStandalone(value);
	}
	#end
}
