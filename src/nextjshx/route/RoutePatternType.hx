package nextjshx.route;

#if macro
import haxe.Json;

using StringTools;
using Lambda;
#end

/** Shared safe TypeScript literal projection for one parser-validated route. */
class RoutePatternType {
	#if macro
	static function escapedTemplateText(value:String):String {
		return value.split("`").join("\\`").split("${").join("\\${");
	}

	static function template(pattern:RoutePattern, includeOptional:Bool):String {
		var result = "";
		for (segment in pattern.publicSegments) {
			if (segment.kind == RouteSegmentKind.OptionalCatchAll && !includeOptional) {
				continue;
			}
			result += "/";
			final source = switch segment.publicSource {
				case null: "";
				case value: value;
			};
			result += segment.parameter == null ? escapedTemplateText(source) : "$" + "{string}";
		}
		if (!includeOptional && pattern.publicSegments.exists(segment -> segment.kind == RouteSegmentKind.OptionalCatchAll)) {
			result += "/";
		}
		return result == "" ? "/" : result;
	}

	/** Returns a closed TS literal/template union without accepting raw TS input. */
	public static function typeScript(pattern:RoutePattern):String {
		if (pattern.parameters.length == 0) {
			return Json.stringify(pattern.publicPath);
		}
		final present = '`' + template(pattern, true) + '`';
		if (!pattern.publicSegments.exists(segment -> segment.kind == RouteSegmentKind.OptionalCatchAll)) {
			return present;
		}
		final absentValue = template(pattern, false);
		final absent = absentValue.indexOf("${string}") == -1 ? Json.stringify(absentValue) : '`$absentValue`';
		return '$absent | $present';
	}
	#end
}
