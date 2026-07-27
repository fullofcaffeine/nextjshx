package page_layouts;

#if macro
import haxe.macro.Context;
import haxe.macro.Expr;
import nextjshx.adapter.AdapterPlanRegistry;
import nextjshx.app.PageLayoutMacro;

class PageLayoutFixture {
	public static macro function install(outputPath:String):Expr {
		AdapterPlanRegistry.install(outputPath, "0.0.0-development", "4.3.7", "1.38.2+f0ffa29e6d49fe81541977c6a3aae6b80000cec6", "16.2.12");
		PageLayoutMacro.install();
		return macro null;
	}

	public static macro function reject():Expr {
		final name = Context.definedValue("page_layout_case");
		if (name == null) {
			Context.fatalError("The page_layout_case define is required by the negative page/layout fixture.", Context.currentPos());
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
