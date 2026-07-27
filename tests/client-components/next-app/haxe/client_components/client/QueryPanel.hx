package client_components.client;

import genes.react.Element;
import client_components.client.QueryHooks.NativeQueryHooks;

typedef QueryPanelProps = {}

/** Hydrated proof for typed Haxe and native TypeScript nuqs Hooks. */
@:next.clientComponent
class QueryPanel {
	public static function render(_props:QueryPanelProps):Element {
		final query = QueryHooks.useTodoQuery();
		final native = NativeQueryHooks.useNativeQueryLabel("nativeLabel");
		final searchLabel = query.search == null ? "none" : query.search;
		final archivedLabel = query.archived ? "yes" : "no";
		return <section id="query-panel">
			<p>URL view: <strong id="query-view">{query.view}</strong></p>
			<p>Search: <strong id="query-search">{searchLabel}</strong></p>
			<p>Page: <strong id="query-page">{query.page}</strong></p>
			<p>Progress: <strong id="query-progress">{query.progress}</strong></p>
			<p>Archived: <strong id="query-archived">{archivedLabel}</strong></p>
			<p>Native Hook: <strong id="native-query-label">{native.value}</strong></p>
			<button id="query-all" type="button" onClick={query.showAll}>All</button>
			<button id="query-active" type="button" onClick={query.showActive}>Active</button>
			<button id="query-done" type="button" onClick={query.showDone}>Done</button>
			<button id="query-search-haxe" type="button" onClick={query.searchForHaxe}>Search Haxe</button>
			<button id="query-search-clear" type="button" onClick={query.clearSearch}>Clear search</button>
			<button id="query-next-page" type="button" onClick={query.nextPage}>Next page</button>
			<button id="query-increase-progress" type="button" onClick={query.increaseProgress}>Increase progress</button>
			<button id="query-toggle-archived" type="button" onClick={query.toggleArchived}>Toggle archived</button>
			<button id="native-query-change" type="button" onClick={() -> native.replace("typed")}>Update native Hook</button>
			<button id="native-query-clear" type="button" onClick={native.clear}>Clear native Hook</button>
		</section>;
	}
}
