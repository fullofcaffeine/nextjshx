package client_components.client;

import js.html.URLSearchParams;
import js.lib.Promise;
import nextjs.integrations.nuqs.Nuqs;
import nextjs.integrations.nuqs.Parsers;

/** Closed URL domain shared by Haxe callers and generated TypeScript. */
enum abstract QueryView(String) to String {
	final All = "all";
	final Active = "active";
	final Done = "done";
}

typedef TodoQueryModel = {
	final view:QueryView;
	final search:Null<String>;
	final page:Int;
	final progress:Float;
	final archived:Bool;
	final showAll:Void->Void;
	final showActive:Void->Void;
	final showDone:Void->Void;
	final searchForHaxe:Void->Void;
	final clearSearch:Void->Void;
	final nextPage:Void->Void;
	final increaseProgress:Void->Void;
	final toggleArchived:Void->Void;
}

typedef NativeQueryLabel = {
	final value:String;
	final replace:String->Promise<URLSearchParams>;
	final clear:Void->Promise<URLSearchParams>;
}

/** Precise TypeScript-authored Hook consumed from Haxe. */
extern class NativeQueryHooks {
	@:next.hook
	@:jsRequire("@nextjshx/client-fixture-hook", "useNativeQueryLabel")
	static function useNativeQueryLabel(key:String):NativeQueryLabel;
}

/** Haxe-authored URL-state Hook exported back to ordinary TypeScript. */
@:keep
class QueryHooks {
	@:next.hook
	@:next.exportHook
	public static function useTodoQuery():TodoQueryModel {
		final view = Nuqs.useQueryState("view", Parsers.stringLiteral([QueryView.All, QueryView.Active, QueryView.Done], QueryView.All));
		final search = Nuqs.useQueryState("search", Parsers.string());
		final page = Nuqs.useQueryState("page", Parsers.integer(1));
		final progress = Nuqs.useQueryState("progress", Parsers.float(0.5));
		final archived = Nuqs.useQueryState("archived", Parsers.boolean(false));
		return {
			view: view.value,
			search: search.value,
			page: page.value,
			progress: progress.value,
			archived: archived.value,
			showAll: () -> view.set(QueryView.All),
			showActive: () -> view.set(QueryView.Active),
			showDone: () -> view.set(QueryView.Done),
			searchForHaxe: () -> search.update(current -> current == null ? "haxe" : current + "!"),
			clearSearch: () -> search.clear(),
			nextPage: () -> page.update(current -> current + 1),
			increaseProgress: () -> progress.update(current -> current + 0.1),
			toggleArchived: () -> archived.update(current -> !current)
		};
	}
}
