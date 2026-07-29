package page_layouts;

#if macro
import haxe.macro.Context;
import haxe.macro.Expr;
import nextjshx.adapter.AdapterPlanRegistry;
import nextjshx.app.PageLayoutMacro;

class PageLayoutFixture {
	public static macro function install(outputPath:String):Expr {
		AdapterPlanRegistry.install(outputPath, "0.0.0-development", "4.3.7", "1.41.0+8a7f7aaf3227fdee79a3cbd25d90ef2c99975f78", "16.2.12");
		PageLayoutMacro.install();
		return macro null;
	}

	public static macro function reject():Expr {
		final name = Context.definedValue("page_layout_case");
		if (name == null) {
			Context.fatalError("The page_layout_case define is required by the negative page/layout fixture.", Context.currentPos());
		}
		if (name == "module-static-metadata") {
			Context.getModule("page_layouts.negative.ModuleStaticMetadata");
			return macro null;
		}
		final typeName = switch name {
			case "missing-render": "MissingRender";
			case "page-props": "StructuralPageProps";
			case "layout-props": "StructuralLayoutProps";
			case "query": "WrongQuery";
			case "params": "WrongParams";
			case "return": "WrongReturn";
			case "public-field": "UnreviewedField";
			case "query-mutation": "MutableSearchParams";
			case "missing-slot-marker": "MissingSlotMarker";
			case "wrong-slot-type": "WrongSlotType";
			case "optional-slot": "OptionalSlot";
			case "mutable-slot": "MutableSlot";
			case _:
				Context.fatalError('Unknown page/layout fixture case "$name".', Context.currentPos());
		};
		Context.getType('page_layouts.negative.$typeName');
		return macro null;
	}
}
#end
