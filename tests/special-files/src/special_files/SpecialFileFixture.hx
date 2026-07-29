package special_files;

#if macro
import haxe.macro.Context;
import haxe.macro.Expr;
import nextjshx.adapter.AdapterPlanRegistry;
import nextjshx.app.SpecialFileMacro;

class SpecialFileFixture {
	public static macro function install(outputPath:String):Expr {
		AdapterPlanRegistry.install(outputPath, "0.0.0-development", "4.3.7", "1.41.0+1ead794285d4f43cbbc96078d4eac4a4d8bf6cce", "16.2.12");
		SpecialFileMacro.install();
		return macro null;
	}

	public static macro function reject():Expr {
		final name = Context.definedValue("special_file_case");
		if (name == null) {
			Context.fatalError("The special_file_case define is required by the negative special-file fixture.", Context.currentPos());
		}
		final typeName = switch name {
			case "missing-render": "MissingRender";
			case "loading-props": "LoadingProps";
			case "error-props": "StructuralErrorProps";
			case "async-error": "AsyncError";
			case "not-found-props": "NotFoundProps";
			case "return": "WrongReturn";
			case "reset-argument": "ResetArgument";
			case "default-props": "DefaultPropsLookalike";
			case "default-path": "DefaultOutsideSlot";
			case "default-params": "DefaultWrongParams";
			case _:
				Context.fatalError('Unknown special-file fixture case "$name".', Context.currentPos());
		};
		Context.getType('special_files.negative.$typeName');
		return macro null;
	}
}
#end
