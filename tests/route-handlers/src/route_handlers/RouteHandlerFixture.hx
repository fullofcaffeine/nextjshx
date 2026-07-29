package route_handlers;

#if macro
import haxe.macro.Context;
import haxe.macro.Expr;
import nextjshx.adapter.AdapterPlanRegistry;
import nextjshx.route.RouteHandlerMacro;

class RouteHandlerFixture {
	public static macro function install(outputPath:String):Expr {
		AdapterPlanRegistry.install(outputPath, "0.0.0-development", "4.3.7", "1.41.0+1ead794285d4f43cbbc96078d4eac4a4d8bf6cce", "16.2.12");
		RouteHandlerMacro.install();
		return macro null;
	}

	public static macro function reject():Expr {
		final name = Context.definedValue("route_handler_case");
		if (name == null) {
			Context.fatalError("The route_handler_case define is required by the negative Route Handler fixture.", Context.currentPos());
		}
		final typeName = switch name {
			case "duplicate": "DuplicateHandlers";
			case "unsupported": "UnsupportedHandler";
			case "context": "NonRouteContextHandler";
			case "params": "WrongParamsHandler";
			case "response": "WrongResponseHandler";
			case "topology": "ParallelRouteHandler";
			case _:
				Context.fatalError('Unknown Route Handler fixture case "$name".', Context.currentPos());
		};
		Context.getType('route_handlers.negative.$typeName');
		return macro null;
	}
}
#end
