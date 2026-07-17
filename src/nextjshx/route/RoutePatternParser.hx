package nextjshx.route;

using StringTools;

private enum RouteParameterNameResult {
	ParameterName(name:String);
	ParameterNameRejected(diagnostic:RouteParseDiagnostic);
}

private enum RouteSegmentParseResult {
	SegmentParsed(segment:RouteSegment);
	SegmentRejected(diagnostic:RouteParseDiagnostic);
}

/**
 * Parses the conservative P0 NextJsHx route grammar.
 *
 * Unsupported Next syntax is rejected rather than normalized away because a
 * changed public URL or filesystem target is a correctness and ownership bug.
 */
class RoutePatternParser {
	static final DRIVE_PATH = ~/^[A-Za-z]:/;
	static final PARAMETER_NAME = ~/^[A-Za-z_][A-Za-z0-9_]*$/;
	static final WINDOWS_NUMBERED_DEVICE = ~/^(COM|LPT)[1-9]$/;
	static final FORBIDDEN_FILESYSTEM_CHARACTERS = '<>:"|?*#%';
	static final SOURCE_EXTENSIONS = [".js", ".jsx", ".ts", ".tsx"];
	static final INTERCEPTION_MARKERS = ["(..)(..)", "(...)", "(..)", "(.)"];

	static function diagnostic(code:String, message:String, ?segmentIndex:Int):RouteParseDiagnostic {
		return new RouteParseDiagnostic(code, message, segmentIndex);
	}

	static function reject(code:String, message:String, ?segmentIndex:Int):RoutePatternParseResult {
		return Rejected(diagnostic(code, message, segmentIndex));
	}

	static function containsControlOrSpace(value:String):Bool {
		for (index in 0...value.length) {
			final code = StringTools.fastCodeAt(value, index);
			if (code <= 32 || code == 127) {
				return true;
			}
		}
		return false;
	}

	static function containsForbiddenFilesystemCharacter(value:String):Bool {
		for (index in 0...value.length) {
			if (FORBIDDEN_FILESYSTEM_CHARACTERS.indexOf(value.charAt(index)) != -1) {
				return true;
			}
		}
		return false;
	}

	static function isWindowsDeviceName(value:String):Bool {
		final basename = value.split(".")[0].toUpperCase();
		return switch basename {
			case "CON" | "PRN" | "AUX" | "NUL": true;
			case _: WINDOWS_NUMBERED_DEVICE.match(basename);
		};
	}

	static function isSourceShaped(value:String):Bool {
		final lower = value.toLowerCase();
		for (extension in SOURCE_EXTENSIONS) {
			if (lower.endsWith(extension)) {
				return true;
			}
		}
		return false;
	}

	static function parameterName(source:String, prefixLength:Int, suffixLength:Int, path:String, segmentIndex:Int):RouteParameterNameResult {
		final name = source.substr(prefixLength, source.length - prefixLength - suffixLength);
		if (name.indexOf("…") != -1) {
			return ParameterNameRejected(diagnostic("NXHX-ROUTE-SEGMENT-0001",
				'Dynamic segment "$source" in route "$path" uses the single ellipsis character; use three periods (...).', segmentIndex));
		}
		if (!PARAMETER_NAME.match(name)) {
			return ParameterNameRejected(diagnostic("NXHX-ROUTE-SEGMENT-0001",
				'Dynamic segment "$source" in route "$path" must contain one non-empty Haxe field identifier.', segmentIndex));
		}
		return ParameterName(name);
	}

	static function rejectSegment(code:String, message:String, segmentIndex:Int):RouteSegmentParseResult {
		return SegmentRejected(diagnostic(code, message, segmentIndex));
	}

	static function parseSegment(source:String, path:String, segmentIndex:Int):RouteSegmentParseResult {
		if (source.startsWith("@")) {
			return rejectSegment("NXHX-ROUTE-SLOT-0001",
				'Parallel-route segment "$source" in route "$path" is not supported by the P0 Haxe route grammar; keep this route native until slot semantics are implemented.',
				segmentIndex);
		}
		for (marker in INTERCEPTION_MARKERS) {
			if (source.startsWith(marker)) {
				return rejectSegment("NXHX-ROUTE-INTERCEPTION-0001",
					'Intercepting-route segment "$source" in route "$path" is not supported by the P0 Haxe route grammar.', segmentIndex);
			}
		}
		if (source.startsWith("(") && source.endsWith(")")) {
			return rejectSegment("NXHX-ROUTE-GROUP-0001",
				'Route-group segment "$source" in route "$path" is deferred by ADR 0002; it cannot be silently removed from the public URL.', segmentIndex);
		}
		if (source.startsWith("(") || source.endsWith(")")) {
			return rejectSegment("NXHX-ROUTE-SEGMENT-0001", 'Segment "$source" in route "$path" has malformed route-group syntax.', segmentIndex);
		}

		if (source.startsWith("[[...")) {
			if (!source.endsWith("]]")) {
				return rejectSegment("NXHX-ROUTE-SEGMENT-0001", 'Optional catch-all segment "$source" in route "$path" is malformed.', segmentIndex);
			}
			return switch parameterName(source, 5, 2, path, segmentIndex) {
				case ParameterNameRejected(diagnostic): SegmentRejected(diagnostic);
				case ParameterName(name):
					final parameter = new RouteParameter(name, RouteParameterKind.OptionalCatchAll, segmentIndex);
					SegmentParsed(new RouteSegment(source, RouteSegmentKind.OptionalCatchAll, segmentIndex, parameter));
			};
		}
		if (source.startsWith("[...")) {
			if (!source.endsWith("]")) {
				return rejectSegment("NXHX-ROUTE-SEGMENT-0001", 'Catch-all segment "$source" in route "$path" is malformed.', segmentIndex);
			}
			return switch parameterName(source, 4, 1, path, segmentIndex) {
				case ParameterNameRejected(diagnostic): SegmentRejected(diagnostic);
				case ParameterName(name):
					final parameter = new RouteParameter(name, RouteParameterKind.CatchAll, segmentIndex);
					SegmentParsed(new RouteSegment(source, RouteSegmentKind.CatchAll, segmentIndex, parameter));
			};
		}
		if (source.startsWith("[") && source.endsWith("]")) {
			return switch parameterName(source, 1, 1, path, segmentIndex) {
				case ParameterNameRejected(diagnostic): SegmentRejected(diagnostic);
				case ParameterName(name):
					final parameter = new RouteParameter(name, RouteParameterKind.Single, segmentIndex);
					SegmentParsed(new RouteSegment(source, RouteSegmentKind.Dynamic, segmentIndex, parameter));
			};
		}
		if (source.indexOf("[") != -1 || source.indexOf("]") != -1) {
			return rejectSegment("NXHX-ROUTE-SEGMENT-0001", 'Dynamic segment "$source" in route "$path" has unmatched or extra brackets.', segmentIndex);
		}
		if (source.startsWith("_") || source.startsWith(".")) {
			return rejectSegment("NXHX-ROUTE-RESERVED-0001",
				'Segment "$source" in route "$path" names a private or hidden filesystem location and cannot produce the declared public route.', segmentIndex);
		}
		if (containsControlOrSpace(source)
			|| containsForbiddenFilesystemCharacter(source)
			|| source.endsWith(".")
			|| isWindowsDeviceName(source)) {
			return rejectSegment("NXHX-ROUTE-PATH-0001", 'Segment "$source" in route "$path" is not a portable App Router directory name.', segmentIndex);
		}
		if (isSourceShaped(source)) {
			return rejectSegment("NXHX-ROUTE-PATH-0001",
				'Segment "$source" in route "$path" looks like a source filename; declaration paths omit extensions and generated special filenames.',
				segmentIndex);
		}
		return SegmentParsed(new RouteSegment(source, RouteSegmentKind.Static, segmentIndex));
	}

	/** Parses one App-Router-root-relative declaration path without side effects. */
	public static function parse(path:String):RoutePatternParseResult {
		if (path == "") {
			return Parsed(new RoutePattern("", "/", [], []));
		}
		if (path.startsWith("/") || DRIVE_PATH.match(path)) {
			return reject("NXHX-ROUTE-PATH-0001", 'Route "$path" must be relative to the discovered App Router root.');
		}
		if (path.indexOf("\\") != -1) {
			return reject("NXHX-ROUTE-PATH-0001", 'Route "$path" must use forward slashes only.');
		}
		final sources = path.split("/");
		for (source in sources) {
			if (source == "" || source == "." || source == "..") {
				return reject("NXHX-ROUTE-PATH-0001", 'Route "$path" contains an empty, current-directory, or parent-directory segment.');
			}
		}

		final segments:Array<RouteSegment> = [];
		final parameters:Array<RouteParameter> = [];
		final seen = new Map<String, Bool>();
		for (index in 0...sources.length) {
			final source = sources[index];
			final segmentIndex = index + 1;
			switch parseSegment(source, path, segmentIndex) {
				case SegmentRejected(diagnostic):
					return Rejected(diagnostic);
				case SegmentParsed(segment):
					segments.push(segment);
					switch segment.parameter {
						case null:
						case parameter:
							if (seen.exists(parameter.name)) {
								return reject("NXHX-ROUTE-PARAM-DUPLICATE-0001",
									'Route "$path" repeats dynamic parameter "${parameter.name}"; each parameter name must be unique.', segmentIndex);
							}
							seen.set(parameter.name, true);
							if (parameter.kind != RouteParameterKind.Single && index != sources.length - 1) {
								return reject("NXHX-ROUTE-PARAM-PLACEMENT-0001",
									'Catch-all segment "$source" in route "$path" must be the final URL segment.', segmentIndex);
							}
							parameters.push(parameter);
					}
			}
		}
		return Parsed(new RoutePattern(path, '/$path', segments, parameters));
	}
}
