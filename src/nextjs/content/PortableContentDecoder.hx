package nextjs.content;

import genes.ts.Unknown;
import genes.ts.JsonCodec;
import nextjs.codec.Decode;
import nextjs.codec.DecodeIssueCode;
import nextjs.codec.DecodeResult;
import nextjs.codec.Decoder;
import nextjs.codec.Decoders;
import nextjs.codec.JsonFields;

using nextjs.codec.DecodeResultTools;
using StringTools;

/**
 * Converts untrusted JSON values into the closed portable content algebra.
 *
 * This decoder never accepts MDX, JSX, HTML, component names, imports, or
 * executable expressions. Those belong only to trusted repository source.
 */
class PortableContentDecoder {
	static final ALL_FIELDS = [
		"alt",
		"attribution",
		"body",
		"caption",
		"detail",
		"height",
		"kind",
		"label",
		"language",
		"level",
		"paragraphs",
		"points",
		"source",
		"src",
		"text",
		"title",
		"tone",
		"unit",
		"value",
		"width"
	];

	public static function document(value:Unknown, path:String = "$"):DecodeResult<Array<ContentBlock>> {
		return Decoders.array(block)(value, path)
			.flatMap(blocks -> blocks.length > 64 ? Decode.reject(DecodeIssueCode.InvalidValue, path,
				"portable documents support at most 64 blocks") : Decode.accept(blocks));
	}

	/** Parses JSON text and immediately applies the closed document decoder. */
	public static function json(source:String, path:String = "$"):DecodeResult<Array<ContentBlock>> {
		return switch JsonCodec.parse(source) {
			case Ok(value):
				// JsonCodec already proved a native JSON value; Unknown marks the
				// exact point where the closed content decoder takes ownership.
				document(Unknown.fromBoundary(value), path);
			case Error(error):
				Decode.reject(DecodeIssueCode.InvalidJson, path, error.message);
		};
	}

	public static function block(value:Unknown, path:String):DecodeResult<ContentBlock> {
		return Decoders.object(value, path, ALL_FIELDS, fields -> fields.required("kind", Decoders.string).flatMap(kind -> switch kind {
			case "heading": heading(value, path);
			case "prose": prose(value, path);
			case "callout": callout(value, path);
			case "quote": quote(value, path);
			case "code": code(value, path);
			case "data-series": dataSeries(value, path);
			case "media": media(value, path);
			case "metric": metric(value, path);
			case _:
				Decode.reject(DecodeIssueCode.InvalidValue, Decode.fieldPath(path, "kind"),
					"expected heading, prose, callout, quote, code, data-series, media, or metric; executable MDX and JSX are never accepted");
		}));
	}

	static function heading(value:Unknown, path:String):DecodeResult<ContentBlock> {
		return exact(value, path, ["kind", "level", "text"],
			fields -> fields.required("level", headingLevel).flatMap(level -> fields.required("text", text(160)).map(value -> ContentBlock.Heading({
				level: level,
				text: value
			}))));
	}

	static function prose(value:Unknown, path:String):DecodeResult<ContentBlock> {
		return exact(value, path, ["kind", "paragraphs"],
			fields -> fields.required("paragraphs", boundedArray(text(1600), 1, 16)).map(paragraphs -> ContentBlock.Prose({
				paragraphs: paragraphs
			})));
	}

	static function callout(value:Unknown, path:String):DecodeResult<ContentBlock> {
		return exact(value, path, ["body", "kind", "title", "tone"],
			fields -> fields.required("tone", calloutTone)
				.flatMap(tone -> fields.required("title", text(120)).flatMap(title -> fields.required("body", text(1200)).map(body -> ContentBlock.Callout({
					tone: tone,
					title: title,
					body: body
				})))));
	}

	static function quote(value:Unknown, path:String):DecodeResult<ContentBlock> {
		return exact(value, path, ["attribution", "kind", "text"],
			fields -> fields.required("text", text(1000)).flatMap(value -> fields.optional("attribution", text(160)).map(attribution -> ContentBlock.Quote({
				text: value,
				attribution: attribution
			}))));
	}

	static function code(value:Unknown, path:String):DecodeResult<ContentBlock> {
		return exact(value, path, ["caption", "kind", "language", "source"],
			fields -> fields.required("language", codeLanguage)
				.flatMap(language -> fields.required("source", sourceText)
					.flatMap(source -> fields.optional("caption", text(160)).map(caption -> ContentBlock.Code({
						language: language,
						source: source,
						caption: caption
					})))));
	}

	static function dataSeries(value:Unknown, path:String):DecodeResult<ContentBlock> {
		return exact(value, path, ["kind", "points", "title", "unit"],
			fields -> fields.required("title", text(120))
				.flatMap(title -> fields.required("unit", text(24))
					.flatMap(unit -> fields.required("points", boundedArray(dataPoint, 1, 16)).map(points -> ContentBlock.DataSeries({
						title: title,
						unit: unit,
						points: points
					})))));
	}

	static function media(value:Unknown, path:String):DecodeResult<ContentBlock> {
		return exact(value, path, ["alt", "caption", "height", "kind", "src", "width"],
			fields -> fields.required("src", SafeMediaPath.decoder)
				.flatMap(src -> fields.required("alt", text(240))
					.flatMap(alt -> fields.optional("caption", text(240))
						.flatMap(caption -> fields.required("width", positiveInt)
							.flatMap(width -> fields.required("height", positiveInt).map(height -> ContentBlock.Media({
								src: src,
								alt: alt,
								caption: caption,
								width: width,
								height: height
							})))))));
	}

	static function metric(value:Unknown, path:String):DecodeResult<ContentBlock> {
		return exact(value, path, ["detail", "kind", "label", "value"],
			fields -> fields.required("label", text(120))
				.flatMap(label -> fields.required("value", text(80)).flatMap(value -> fields.optional("detail", text(240)).map(detail -> ContentBlock.Metric({
					label: label,
					value: value,
					detail: detail
				})))));
	}

	static function dataPoint(value:Unknown, path:String):DecodeResult<DataPoint> {
		return Decoders.object(value, path, ["label", "value"],
			fields -> fields.required("label", text(80)).flatMap(label -> fields.required("value", Decoders.finiteNumber).map(value -> {
				label: label,
				value: value
			})));
	}

	static function exact<T>(value:Unknown, path:String, fields:Array<String>, build:JsonFields->DecodeResult<T>):DecodeResult<T> {
		return Decoders.object(value, path, fields, build);
	}

	static function text(maxLength:Int):Decoder<String> {
		return (value, path) -> Decoders.string(value, path).flatMap(decoded -> {
			final normalized = decoded.trim();
			return normalized.length == 0
				|| normalized.length > maxLength ? Decode.reject(DecodeIssueCode.InvalidValue, path,
					'expected non-empty text of at most $maxLength characters') : Decode.accept(normalized);
		});
	}

	static function boundedArray<T>(item:Decoder<T>, minimum:Int, maximum:Int):Decoder<Array<T>> {
		return (value,
			path) -> Decoders.array(item)(value, path)
				.flatMap(items -> items.length < minimum
					|| items.length > maximum ? Decode.reject(DecodeIssueCode.InvalidValue, path,
						'expected between $minimum and $maximum items') : Decode.accept(items));
	}

	static function headingLevel(value:Unknown, path:String):DecodeResult<HeadingLevel> {
		return Decoders.int32(value, path).flatMap(level -> switch level {
			case 2: Decode.accept(HeadingLevel.Section);
			case 3: Decode.accept(HeadingLevel.Subsection);
			case 4: Decode.accept(HeadingLevel.Detail);
			case _: Decode.reject(DecodeIssueCode.InvalidValue, path, "expected heading level 2, 3, or 4");
		});
	}

	static function calloutTone(value:Unknown, path:String):DecodeResult<CalloutTone> {
		return Decoders.string(value, path).flatMap(tone -> switch tone {
			case "note": Decode.accept(CalloutTone.Note);
			case "insight": Decode.accept(CalloutTone.Insight);
			case "caution": Decode.accept(CalloutTone.Caution);
			case _: Decode.reject(DecodeIssueCode.InvalidValue, path, "expected note, insight, or caution");
		});
	}

	static function codeLanguage(value:Unknown, path:String):DecodeResult<CodeLanguage> {
		return Decoders.string(value, path).flatMap(language -> switch language {
			case "haxe": Decode.accept(CodeLanguage.Haxe);
			case "typescript": Decode.accept(CodeLanguage.TypeScript);
			case "tsx": Decode.accept(CodeLanguage.Tsx);
			case "json": Decode.accept(CodeLanguage.Json);
			case "bash": Decode.accept(CodeLanguage.Bash);
			case "text": Decode.accept(CodeLanguage.Text);
			case _: Decode.reject(DecodeIssueCode.InvalidValue, path, "expected haxe, typescript, tsx, json, bash, or text");
		});
	}

	static function sourceText(value:Unknown, path:String):DecodeResult<String> {
		return Decoders.string(value, path)
			.flatMap(source -> source.length == 0
				|| source.length > 12000 ? Decode.reject(DecodeIssueCode.InvalidValue, path,
					"expected display-only source text of 1 to 12000 characters") : Decode.accept(source));
	}

	static function positiveInt(value:Unknown, path:String):DecodeResult<Int> {
		return Decoders.int32(value, path)
			.flatMap(number -> number < 1
				|| number > 8192 ? Decode.reject(DecodeIssueCode.InvalidValue, path, "expected an integer from 1 through 8192") : Decode.accept(number));
	}
}
