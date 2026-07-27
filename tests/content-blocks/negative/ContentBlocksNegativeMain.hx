import genes.react.Element;
import nextjs.content.ContentBlock;

/** Negative control proving renderers cannot silently omit a block variant. */
class ContentBlocksNegativeMain {
	static function incomplete(block:ContentBlock):Element {
		return switch block {
			case Heading(value): <h2>{value.text}</h2>;
			case Prose(value): <p>{value.paragraphs.join(" ")}</p>;
			case Callout(value): <aside>{value.body}</aside>;
			case Quote(value): <blockquote>{value.text}</blockquote>;
			case Code(value): <pre>{value.source}</pre>;
			case DataSeries(value): <figure>{value.title}</figure>;
			case Media(value): <img src={value.src.value()} alt={value.alt}/>;
		};
	}

	static function main():Void {}
}
