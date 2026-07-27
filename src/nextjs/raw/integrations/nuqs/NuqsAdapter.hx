package nextjs.raw.integrations.nuqs;

import js.html.URLSearchParams;
import nextjs.raw.react.ReactNode;

/** Closed public props supported by the Next App Router adapter binding. */
typedef NuqsAdapterProps = {
	final children:ReactNode;
	@:ts.optional
	final ?defaultOptions:QueryOptions;
	@:ts.optional
	final ?processUrlSearchParams:URLSearchParams->URLSearchParams;
}

/** Direct named component import from nuqs's public App Router entrypoint. */
@:jsRequire("nuqs/adapters/next/app", "NuqsAdapter")
@:genes.jsxComponentProps("nextjs.raw.integrations.nuqs.NuqsAdapter.NuqsAdapterProps")
extern class NuqsAdapter {}
