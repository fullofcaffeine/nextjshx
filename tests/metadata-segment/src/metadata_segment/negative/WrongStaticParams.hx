package metadata_segment.negative;

import genes.react.Element;
import nextjs.app.PageProps;
import nextjs.route.SearchParams;

typedef ExpectedParams = {
	final id:String;
}

typedef ReturnedParams = {
	final slug:String;
}

@:next.page("negative/params/[id]")
class WrongStaticParams {
	public static function generateStaticParams():Array<ReturnedParams> {
		return [{slug: "wrong"}];
	}

	public static function render(props:PageProps<ExpectedParams, SearchParams>):Element {
		return <main>invalid</main>;
	}
}
