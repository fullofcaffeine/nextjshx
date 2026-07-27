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
 * Parses the supported Next App Router filesystem grammar.
 *
 * Filesystem topology and public URLs are intentionally separate: route
 * groups and parallel slots are kept in `segments` for adapter ownership but
 * omitted from `publicSegments`, while interception markers resolve to the
 * canonical hard-navigation URL using Next's documented route-segment rules.
 */
class RoutePatternParser {
	static final DRIVE_PATH = ~/^[A-Za-z]:/;
	static final PARAMETER_NAME = ~/^[A-Za-z_][A-Za-z0-9_]*$/;
	static final WINDOWS_NUMBERED_DEVICE = ~/^(COM|LPT)[1-9]$/;
	static final FORBIDDEN_FILESYSTEM_CHARACTERS = '<>:"|?*#%';
	static final SOURCE_EXTENSIONS = [".js", ".jsx", ".ts", ".tsx"];
	// Order is significant: the two-level marker must win over its prefix.
	static final INTERCEPTION_MARKERS:Array<RouteInterceptionMarker> = [
		RouteInterceptionMarker.Grandparent,
		RouteInterceptionMarker.SameLevel,
		RouteInterceptionMarker.Parent,
		RouteInterceptionMarker.Root
	];

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

	static function ordinarySegment(source:String, filesystemSource:String, path:String, segmentIndex:Int,
			?interception:RouteInterceptionMarker):RouteSegmentParseResult {
		if (source.startsWith("[[...")) {
			if (!source.endsWith("]]")) {
				return rejectSegment("NXHX-ROUTE-SEGMENT-0001", 'Optional catch-all segment "$filesystemSource" in route "$path" is malformed.', segmentIndex);
			}
			return switch parameterName(source, 5, 2, path, segmentIndex) {
				case ParameterNameRejected(diagnostic): SegmentRejected(diagnostic);
				case ParameterName(name):
					final parameter = new RouteParameter(name, RouteParameterKind.OptionalCatchAll, segmentIndex);
					SegmentParsed(new RouteSegment(filesystemSource, source, RouteSegmentKind.OptionalCatchAll, segmentIndex, parameter, interception));
			};
		}
		if (source.startsWith("[...")) {
			if (!source.endsWith("]")) {
				return rejectSegment("NXHX-ROUTE-SEGMENT-0001", 'Catch-all segment "$filesystemSource" in route "$path" is malformed.', segmentIndex);
			}
			return switch parameterName(source, 4, 1, path, segmentIndex) {
				case ParameterNameRejected(diagnostic): SegmentRejected(diagnostic);
				case ParameterName(name):
					final parameter = new RouteParameter(name, RouteParameterKind.CatchAll, segmentIndex);
					SegmentParsed(new RouteSegment(filesystemSource, source, RouteSegmentKind.CatchAll, segmentIndex, parameter, interception));
			};
		}
		if (source.startsWith("[") && source.endsWith("]")) {
			return switch parameterName(source, 1, 1, path, segmentIndex) {
				case ParameterNameRejected(diagnostic): SegmentRejected(diagnostic);
				case ParameterName(name):
					final parameter = new RouteParameter(name, RouteParameterKind.Single, segmentIndex);
					SegmentParsed(new RouteSegment(filesystemSource, source, RouteSegmentKind.Dynamic, segmentIndex, parameter, interception));
			};
		}
		if (source.indexOf("[") != -1 || source.indexOf("]") != -1) {
			return rejectSegment("NXHX-ROUTE-SEGMENT-0001", 'Dynamic segment "$filesystemSource" in route "$path" has unmatched or extra brackets.',
				segmentIndex);
		}
		if (source.indexOf("(") != -1 || source.indexOf(")") != -1 || source.indexOf("@") != -1) {
			return rejectSegment("NXHX-ROUTE-SEGMENT-0001", 'Segment "$filesystemSource" in route "$path" has malformed App Router topology syntax.',
				segmentIndex);
		}
		if (source.startsWith("_") || source.startsWith(".")) {
			return rejectSegment("NXHX-ROUTE-RESERVED-0001",
				'Segment "$filesystemSource" in route "$path" names a private or hidden filesystem location and cannot produce the declared public route.',
				segmentIndex);
		}
		if (containsControlOrSpace(source)
			|| containsForbiddenFilesystemCharacter(source)
			|| source.endsWith(".")
			|| isWindowsDeviceName(source)) {
			return rejectSegment("NXHX-ROUTE-PATH-0001", 'Segment "$filesystemSource" in route "$path" is not a portable App Router directory name.',
				segmentIndex);
		}
		if (isSourceShaped(source)) {
			return rejectSegment("NXHX-ROUTE-PATH-0001",
				'Segment "$filesystemSource" in route "$path" looks like a source filename; declaration paths omit extensions and generated special filenames.',
				segmentIndex);
		}
		return SegmentParsed(new RouteSegment(filesystemSource, source, RouteSegmentKind.Static, segmentIndex, null, interception));
	}

	static function interceptionMarker(source:String):Null<RouteInterceptionMarker> {
		for (marker in INTERCEPTION_MARKERS) {
			final value:String = marker;
			if (source.startsWith(value)) {
				return marker;
			}
		}
		return null;
	}

	static function parseGroup(source:String, path:String, segmentIndex:Int):RouteSegmentParseResult {
		final name = source.substr(1, source.length - 2);
		if (name == ""
			|| name.startsWith("_")
			|| ~/^\.+$/.match(name)
			|| name.indexOf("(") != -1
			|| name.indexOf(")") != -1
			|| name.indexOf("[") != -1
			|| name.indexOf("]") != -1
			|| name.indexOf("@") != -1
			|| containsControlOrSpace(name)
			|| containsForbiddenFilesystemCharacter(name)
			|| isWindowsDeviceName(name)) {
			return rejectSegment("NXHX-ROUTE-GROUP-0001",
				'Route-group segment "$source" in route "$path" must contain one named, portable group such as (marketing).', segmentIndex);
		}
		return SegmentParsed(new RouteSegment(source, null, RouteSegmentKind.Group, segmentIndex));
	}

	static function parseSlot(source:String, path:String, segmentIndex:Int):RouteSegmentParseResult {
		final name = source.substr(1);
		if (!PARAMETER_NAME.match(name) || name == "children") {
			return rejectSegment("NXHX-ROUTE-SLOT-0001",
				'Parallel-route segment "$source" in route "$path" must name one slot field such as @modal; @children is reserved by Next.', segmentIndex);
		}
		return SegmentParsed(new RouteSegment(source, null, RouteSegmentKind.ParallelSlot, segmentIndex));
	}

	static function publicSource(segment:RouteSegment):String {
		return switch segment.publicSource {
			case null: "";
			case value: value;
		};
	}

	static function pathname(segments:Array<RouteSegment>):String {
		return segments.length == 0 ? "/" : "/" + segments.map(publicSource).join("/");
	}

	static function canonicalSegments(segments:Array<RouteSegment>):Array<RouteSegment> {
		final result:Array<RouteSegment> = [];
		for (index in 0...segments.length) {
			final source = segments[index];
			final parameter = switch source.parameter {
				case null: null;
				case value: new RouteParameter(value.name, value.kind, index + 1);
			};
			result.push(new RouteSegment(source.source, source.publicSource, source.kind, index + 1, parameter, source.interception));
		}
		return result;
	}

	/** Parses one App-Router-root-relative declaration path without side effects. */
	public static function parse(path:String):RoutePatternParseResult {
		if (path == "") {
			return Parsed(new RoutePattern("", "/", [], [], [], RouteTopologyKind.Canonical, []));
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
		final routable:Array<RouteSegment> = [];
		final parallelSlots:Array<String> = [];
		final seenSlots = new Map<String, Bool>();
		final seenParameters = new Map<String, Bool>();
		var interceptionIndex = -1;
		var interceptionValue:Null<RouteInterceptionMarker> = null;
		for (index in 0...sources.length) {
			final source = sources[index];
			final segmentIndex = index + 1;
			var parsed:RouteSegmentParseResult;
			if (source.startsWith("@")) {
				parsed = parseSlot(source, path, segmentIndex);
			} else {
				final marker = interceptionMarker(source);
				if (marker != null) {
					if (interceptionIndex != -1) {
						return reject("NXHX-ROUTE-INTERCEPTION-0001",
							'Route "$path" contains more than one interception marker; Next permits one resolved interception target.', segmentIndex);
					}
					final markerSource:String = marker;
					final target = source.substr(markerSource.length);
					if (target == "") {
						return reject("NXHX-ROUTE-INTERCEPTION-0001",
							'Intercepting-route segment "$source" in route "$path" must attach its marker directly to a static or dynamic target segment.',
							segmentIndex);
					}
					interceptionIndex = routable.length;
					interceptionValue = marker;
					parsed = ordinarySegment(target, source, path, segmentIndex, marker);
				} else if (source.startsWith("(") && source.endsWith(")")) {
					parsed = parseGroup(source, path, segmentIndex);
				} else {
					parsed = ordinarySegment(source, source, path, segmentIndex);
				}
			}
			switch parsed {
				case SegmentRejected(diagnostic):
					return Rejected(diagnostic);
				case SegmentParsed(segment):
					segments.push(segment);
					if (segment.kind == RouteSegmentKind.ParallelSlot) {
						final slot = segment.source.substr(1);
						if (seenSlots.exists(slot)) {
							return reject("NXHX-ROUTE-SLOT-0001", 'Route "$path" repeats parallel slot @$slot; slot ancestry must be unambiguous.',
								segmentIndex);
						}
						seenSlots.set(slot, true);
						parallelSlots.push(slot);
					}
					if (segment.publicSource != null) {
						routable.push(segment);
					}
					switch segment.parameter {
						case null:
						case parameter:
							if (seenParameters.exists(parameter.name)) {
								return reject("NXHX-ROUTE-PARAM-DUPLICATE-0001",
									'Route "$path" repeats dynamic parameter "${parameter.name}"; each parameter name must be unique.', segmentIndex);
							}
							seenParameters.set(parameter.name, true);
					}
			}
		}

		for (index in 0...routable.length) {
			final segment = routable[index];
			if ((segment.kind == RouteSegmentKind.CatchAll || segment.kind == RouteSegmentKind.OptionalCatchAll)
				&& index != routable.length - 1) {
				return reject("NXHX-ROUTE-PARAM-PLACEMENT-0001", 'Catch-all segment "${segment.source}" in route "$path" must be the final URL segment.',
					segment.segmentIndex);
			}
		}

		var resolved = routable.copy();
		var interception:Null<RouteInterception> = null;
		if (interceptionValue != null) {
			final before = routable.slice(0, interceptionIndex);
			final target = routable.slice(interceptionIndex);
			final marker:RouteInterceptionMarker = interceptionValue;
			final keep = switch marker {
				case RouteInterceptionMarker.SameLevel: before.length;
				case RouteInterceptionMarker.Parent:
					if (before.length == 0) {
						return reject("NXHX-ROUTE-INTERCEPTION-0001", 'Route "$path" cannot use (..) at the App Router root; use (.) for a root sibling.',
							segments.filter(value -> value.interception != null)[0].segmentIndex);
					}
					before.length - 1;
				case RouteInterceptionMarker.Grandparent:
					if (before.length < 2) {
						return reject("NXHX-ROUTE-INTERCEPTION-0001", 'Route "$path" cannot use (..)(..) with fewer than two preceding route segments.',
							segments.filter(value -> value.interception != null)[0].segmentIndex);
					}
					before.length - 2;
				case RouteInterceptionMarker.Root: 0;
			};
			resolved = before.slice(0, keep).concat(target);
			final canonical = canonicalSegments(resolved);
			final interceptingPath = pathname(canonicalSegments(before));
			final interceptedPath = pathname(canonical);
			final filesystemIndex = segments.filter(value -> value.interception != null)[0].segmentIndex;
			interception = new RouteInterception(marker, filesystemIndex, interceptingPath, interceptedPath);
		}

		final publicSegments = canonicalSegments(resolved);
		final parameters:Array<RouteParameter> = [];
		for (segment in publicSegments) {
			switch segment.parameter {
				case null:
				case parameter:
					parameters.push(parameter);
			}
		}
		final publicPath = pathname(publicSegments);
		final topology = interception != null ? RouteTopologyKind.InterceptedView : parallelSlots.length == 0 ? RouteTopologyKind.Canonical : RouteTopologyKind.ParallelView;
		return Parsed(new RoutePattern(path, publicPath, segments, publicSegments, parameters, topology, parallelSlots, interception));
	}
}
