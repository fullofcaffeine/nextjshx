package metadata_segment;

#if macro
import haxe.macro.Context;
import haxe.macro.Expr;
import nextjshx.adapter.AdapterPlanRegistry;
import nextjshx.app.PageLayoutMacro;

class MetadataSegmentFixture {
	public static macro function install(outputPath:String):Expr {
		AdapterPlanRegistry.install(outputPath, "0.0.0-development", "4.3.7", "1.49.0+19c9fb7197b38b5035ef286786dec71f74fabb2c", "16.2.12");
		PageLayoutMacro.install();
		return macro null;
	}

	public static macro function reject():Expr {
		final name = Context.definedValue("metadata_segment_case");
		if (name == null) {
			Context.fatalError("The metadata_segment_case define is required by the negative metadata/segment fixture.", Context.currentPos());
		}
		final typeName = switch name {
			case "static-type": "WrongStaticMetadata";
			case "metadata-conflict": "ConflictingMetadata";
			case "metadata-props": "WrongMetadataProps";
			case "metadata-parent": "WrongMetadataParent";
			case "static-params": "WrongStaticParams";
			case "static-route-params": "StaticRouteParams";
			case "runtime": "ExperimentalRuntime";
			case "revalidate": "TrueRevalidate";
			case "max-duration": "ZeroMaxDuration";
			case "region": "EmptyRegions";
			case "unknown-config": "UnknownConfig";
			case "runtime-config": "RuntimeConfigExpression";
			case "lookalike-config": "LookalikeSegmentConfig";
			case "lookalike-runtime": "LookalikeSegmentRuntime";
			case _:
				Context.fatalError('Unknown metadata/segment fixture case "$name".', Context.currentPos());
		};
		Context.getType('metadata_segment.negative.$typeName');
		return macro null;
	}
}
#end
