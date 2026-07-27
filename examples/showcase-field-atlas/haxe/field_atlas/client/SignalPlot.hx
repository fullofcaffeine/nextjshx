package field_atlas.client;

import genes.react.Element;
import nextjs.integrations.recharts.StackedBars;
import nextjs.raw.integrations.recharts.Bar;
import nextjs.raw.integrations.recharts.BarChart;
import nextjs.raw.integrations.recharts.CartesianGrid;
import nextjs.raw.integrations.recharts.ChartTypes.AxisType;
import nextjs.raw.integrations.recharts.ChartTypes.BarChartLayout;
import nextjs.raw.integrations.recharts.ChartTypes.StackedBarCategoryKey;
import nextjs.raw.integrations.recharts.XAxis;
import nextjs.raw.integrations.recharts.YAxis;

typedef SignalPlotProps = {
	final label:String;
	final values:Array<Int>;
}

/**
 * `@:next.clientComponent` creates the same boundary as `"use client"`.
 * Recharts stays native React; its reviewed Haxe props and data keys are
 * checked in this HXX before Next receives a directive-first adapter.
 */
@:next.clientComponent
class SignalPlot {
	public static function render(props:SignalPlotProps):Element {
		var plot = 0;
		final values = props.values;
		final rows = values.map(value -> {
			plot++;
			return StackedBars.row("PLOT " + plot, value, 100 - value);
		});
		final model = StackedBars.create(rows, "Signal", "var(--atlas-blue)", "Range", "var(--atlas-track)");
		final tableRows = rows.map(row -> <tr key={row.category}><th scope="row">{row.category}</th><td>{row.primary}</td><td>{row.secondary}</td></tr>);
		return <section className="signal-plot">
			<header><span>LIVE COMPONENT / HAXE</span><h3>{props.label}</h3><p>Normalized field signal against the remaining observed range.</p></header>
			<div className="signal-chart">
				<BarChart data={model.rows} responsive={true} accessibilityLayer={true} layout={BarChartLayout.Vertical} className="signal-chart-graph" desc={props.label}>
					<CartesianGrid horizontal={false} vertical={true} stroke="var(--atlas-rule)" strokeDasharray="2 4" />
					<XAxis type={AxisType.Number} allowDecimals={false} axisLine={false} tickLine={false} />
					<YAxis type={AxisType.Category} dataKey={StackedBarCategoryKey.Category} axisLine={false} tickLine={false} width={72} />
					<Bar dataKey={model.primary.key} name={model.primary.label} fill={model.primary.color} stackId="signal" barSize={18} isAnimationActive={false} />
					<Bar dataKey={model.secondary.key} name={model.secondary.label} fill={model.secondary.color} stackId="signal" barSize={18} isAnimationActive={false} />
				</BarChart>
			</div>
			<table><caption>{props.label + " values"}</caption><thead><tr><th>Plot</th><th>Signal</th><th>Range</th></tr></thead><tbody>{tableRows}</tbody></table>
		</section>;
	}
}
