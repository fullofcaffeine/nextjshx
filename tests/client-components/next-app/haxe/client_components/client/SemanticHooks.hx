package client_components.client;

import nextjs.client.React;

typedef SemanticCounter = {
	final value:Int;
	final doubled:Int;
	final mode:CounterMode;
	final set:Int->Void;
	final increment:Void->Void;
	final activate:Void->Void;
}

enum abstract CounterMode(String) to String {
	final Idle = "idle";
	final Active = "active";
}

typedef LabelFormatter = String->String;

typedef SemanticFormatter = {
	final format:LabelFormatter;
	final replace:LabelFormatter->Void;
}

typedef OptimisticCount = {
	final value:Int;
	final incrementBy:Int->Void;
}

/** Positive evidence for allocation-free Haxe-authored React state Hooks. */
@:keep
class SemanticHooks {
	@:next.hook
	@:next.exportHook
	public static function useSemanticCounter(initial:Int):SemanticCounter {
		final count = React.useState(initial);
		final mode = React.useState(CounterMode.Idle);
		final doubled = React.useMemo((current) -> current * 2, React.deps(count.value));
		return {
			value: count.value,
			doubled: doubled,
			mode: mode.value,
			set: next -> count.set(next),
			increment: () -> count.update(previous -> previous + 1),
			activate: () -> mode.set(CounterMode.Active)
		};
	}

	@:next.hook
	public static function useFormatter(initial:LabelFormatter):SemanticFormatter {
		final formatter = React.useStateLazy(() -> initial);
		return {
			format: formatter.value,
			replace: next -> formatter.set(next)
		};
	}

	@:next.hook
	public static function useLabeler(suffix:String):String->String {
		return React.useCallback((label:String) -> label + suffix, React.deps(suffix));
	}

	@:next.hook
	public static function useOptimisticCount(passthrough:Int):OptimisticCount {
		final count = React.useOptimistic(passthrough, (current:Int, amount:Int) -> current + amount);
		return {
			value: count.value,
			incrementBy: amount -> React.startTransition(() -> count.apply(amount))
		};
	}
}
