package content_blocks;

import genes.ts.Unknown;
import js.lib.Error;
import nextjs.codec.DecodeIssueCode;
import nextjs.codec.DecodeResult;
import nextjs.content.ContentBlock;
import nextjs.content.ContentBlockRenderer;
import nextjs.content.PortableContentDecoder;

/** Runtime proof for closed remote-content decoding and exhaustive rendering. */
class ContentBlockRuntime {
	static function boundary(json:String):Unknown {
		return Unknown.fromBoundary(haxe.Json.parse(json));
	}

	static function decoded(json:String):Array<ContentBlock> {
		return switch PortableContentDecoder.document(boundary(json)) {
			case Decoded(value): value;
			case Rejected(issues): throw new Error("expected decoded content, received " + issues[0].code + " at " + issues[0].path);
		};
	}

	static function rejected(json:String, code:DecodeIssueCode, path:String):Void {
		switch PortableContentDecoder.document(boundary(json)) {
			case Decoded(_):
				throw new Error("expected rejected content");
			case Rejected(issues):
				equal(issues[0].code, code, "issue code");
				equal(issues[0].path, path, "issue path");
		}
	}

	static function equal<T>(actual:T, expected:T, label:String):Void {
		if (actual != expected) {
			throw new Error(label + " mismatch");
		}
	}

	static function main():Void {
		final blocks = decoded('[
			{"kind":"heading","level":2,"text":"Field notes"},
			{"kind":"prose","paragraphs":["A portable paragraph.","No executable markup."]},
			{"kind":"callout","tone":"insight","title":"Signal","body":"Types travel with the content."},
			{"kind":"quote","text":"Make invalid content unrepresentable.","attribution":"The field team"},
			{"kind":"code","language":"tsx","source":"<script>alert(1)</script>","caption":"Rendered as text"},
			{"kind":"data-series","title":"Canopy index","unit":"pts","points":[{"label":"North","value":12.5},{"label":"South","value":8}]},
			{"kind":"media","src":"/field/plate-01.svg","alt":"A contour study","caption":"Plate 01","width":1200,"height":800},
			{"kind":"metric","label":"Samples","value":"2,418","detail":"Across six plots"}
		]');
		equal(blocks.length, 8, "decoded block count");
		final html = ReactDomServer.renderToStaticMarkup(ContentBlockRenderer.render(blocks));
		if (html.indexOf("<h2>Field notes</h2>") == -1
			|| html.indexOf("content-data-series") == -1
			|| html.indexOf("&lt;script&gt;alert(1)&lt;/script&gt;") == -1
			|| html.indexOf("<script>") != -1) {
			throw new Error("semantic renderer output mismatch");
		}

		rejected('[{"kind":"mdx","source":"export default function Attack(){}"}]', DecodeIssueCode.InvalidValue, "$[0].kind");
		rejected('[{"kind":"heading","level":"2","text":"Wrong"}]', DecodeIssueCode.ExpectedInteger, "$[0].level");
		rejected('[{"kind":"prose","paragraphs":["Safe"],"jsx":"<Attack />"}]', DecodeIssueCode.UnexpectedField, "$[0].jsx");
		rejected('[{"kind":"media","src":"https://example.test/attack.svg","alt":"Attack","width":10,"height":10}]', DecodeIssueCode.InvalidValue, "$[0].src");
		rejected('[{"kind":"media","src":"/field/%2e%2e/attack.svg","alt":"Attack","width":10,"height":10}]', DecodeIssueCode.InvalidValue, "$[0].src");
		rejected('[{"kind":"data-series","title":"Bad","unit":"pts","points":[{"label":"North","value":"NaN"}]}]', DecodeIssueCode.ExpectedNumber,
			"$[0].points[0].value");
		rejected('[{"kind":"callout","tone":"admin","title":"Bad","body":"Wrong tone"}]', DecodeIssueCode.InvalidValue, "$[0].tone");

		trace("content-blocks-runtime: OK: 8 variants, exhaustive HTML, and 7 malformed controls");
	}
}
