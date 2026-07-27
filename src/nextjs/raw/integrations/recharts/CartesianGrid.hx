package nextjs.raw.integrations.recharts;

/** Closed reviewed subset of Recharts `CartesianGrid` props. */
typedef CartesianGridProps = {
	@:ts.optional
	final ?horizontal:Bool;
	@:ts.optional
	final ?stroke:String;
	@:ts.optional
	final ?strokeDasharray:String;
	@:ts.optional
	final ?vertical:Bool;
}

/** Direct named component import from Recharts' public entrypoint. */
@:jsRequire("recharts", "CartesianGrid")
@:genes.jsxComponentProps("nextjs.raw.integrations.recharts.CartesianGrid.CartesianGridProps")
extern class CartesianGrid {}
