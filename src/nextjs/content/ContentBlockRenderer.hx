package nextjs.content;

import genes.react.Element;

/** Default semantic HTML renderer for the complete portable block algebra. */
class ContentBlockRenderer {
	public static function render(blocks:Array<ContentBlock>):Element {
		final children = blocks.map(renderBlock);
		return <div className="portable-content">{children}</div>;
	}

	public static function renderBlock(block:ContentBlock):Element {
		return switch block {
			case Heading(value): renderHeading(value);
			case Prose(value):
				final paragraphs = value.paragraphs.map(paragraph -> <p>{paragraph}</p>);
				<section className="content-prose">{paragraphs}</section>;
			case Callout(value):
				<aside className="content-callout" data-tone={value.tone}>
					<strong>{value.title}</strong>
					<p>{value.body}</p>
				</aside>;
			case Quote(value):
				<blockquote className="content-quote">
					<p>{value.text}</p>
					{value.attribution == null ? null : <cite>{value.attribution}</cite>}
				</blockquote>;
			case Code(value):
				<figure className="content-code">
					{value.caption == null ? null : <figcaption>{value.caption}</figcaption>}
					<pre><code data-language={value.language}>{value.source}</code></pre>
				</figure>;
			case DataSeries(value): renderDataSeries(value);
			case Media(value):
				<figure className="content-media">
					<img src={value.src.value()} alt={value.alt} width={value.width} height={value.height}/>
					{value.caption == null ? null : <figcaption>{value.caption}</figcaption>}
				</figure>;
			case Metric(value):
				<figure className="content-metric">
					<figcaption>{value.label}</figcaption>
					<strong>{value.value}</strong>
					{value.detail == null ? null : <p>{value.detail}</p>}
				</figure>;
		};
	}

	static function renderHeading(value:HeadingBlock):Element {
		return switch value.level {
			case HeadingLevel.Section: <h2>{value.text}</h2>;
			case HeadingLevel.Subsection: <h3>{value.text}</h3>;
			case HeadingLevel.Detail: <h4>{value.text}</h4>;
		};
	}

	static function renderDataSeries(value:DataSeriesBlock):Element {
		var maximum = 0.0;
		for (point in value.points) {
			final magnitude = Math.abs(point.value);
			if (magnitude > maximum) {
				maximum = magnitude;
			}
		}
		final rows = value.points.map(point -> {
			final width = maximum == 0 ? "0%" : (Math.abs(point.value) / maximum * 100) + "%";
			return <li>
				<span className="content-data-label">{point.label}</span>
				<span className="content-data-track"><span className="content-data-bar" style={{width: width}}></span></span>
				<strong>{point.value + " " + value.unit}</strong>
			</li>;
		});
		return <figure className="content-data-series">
			<figcaption>{value.title}</figcaption>
			<ul>{rows}</ul>
		</figure>;
	}
}
