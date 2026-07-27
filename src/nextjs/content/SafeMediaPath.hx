package nextjs.content;

import genes.ts.Unknown;
import nextjs.codec.Decode;
import nextjs.codec.DecodeIssueCode;
import nextjs.codec.DecodeResult;
import nextjs.codec.Decoders;

using nextjs.codec.DecodeResultTools;
using Lambda;
using StringTools;

/**
 * Root-relative media owned by the consuming Next.js application.
 *
 * Remote protocols, protocol-relative URLs, traversal, query strings, and
 * fragments are rejected at the content boundary. Applications that
 * deliberately support remote images should model a separate allowlisted
 * domain type rather than weakening this one.
 */
abstract SafeMediaPath(String) {
	private inline function new(value:String) {
		this = value;
	}

	public inline function value():String {
		return this;
	}

	public static function decoder(value:Unknown, path:String):DecodeResult<SafeMediaPath> {
		return Decoders.string(value, path).flatMap(decoded -> {
			final segments = decoded.split("/");
			if (!decoded.startsWith("/")
				|| decoded.startsWith("//")
				|| decoded.indexOf("//") != -1
				|| decoded.length > 512
				|| decoded.indexOf("?") != -1
				|| decoded.indexOf("#") != -1
				|| decoded.indexOf("%") != -1
				|| decoded.indexOf("\\") != -1
				|| segments.exists(segment -> segment == "." || segment == "..")) {
				return Decode.reject(DecodeIssueCode.InvalidValue, path,
					"expected a normalized root-relative media path without a protocol, encoded segment, traversal, query, or fragment");
			}
			return Decode.accept(new SafeMediaPath(decoded));
		});
	}
}
