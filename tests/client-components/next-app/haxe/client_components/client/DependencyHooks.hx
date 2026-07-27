package client_components.client;

import nextjs.client.React;

typedef DependencyProps = {
	final label:String;
}

/** Positive controls for closed, heterogeneous, inline dependency packaging. */
@:keep
class DependencyHooks {
	@:next.hook
	public static function useConstant():Int {
		return React.useMemo(() -> 42, React.deps());
	}

	@:next.hook
	public static function useSummary(value:Int, label:String, enabled:Bool):String {
		return React.useMemo((value, label, enabled) -> enabled ? '$label:$value' : label, React.deps(value, label, enabled));
	}

	@:next.hook
	public static function useRange(first:Int, second:Int):Int {
		return React.useMemo((first, second) -> second - first, React.deps(first, second));
	}

	@:next.hook
	public static function useProperty(props:DependencyProps):String {
		return React.useMemo(() -> props.label.toUpperCase(), React.deps(props.label));
	}

	@:next.hook
	public static function useDuplicate(value:Int):Int {
		return React.useMemo((first, second) -> first + second, React.deps(value, value));
	}

	@:next.hook
	public static function useNullableSnapshot(initial:Null<String>):Null<String> {
		final label = React.useState(initial);
		return React.useMemo((current) -> current, React.deps(label.value));
	}

	@:next.hook
	public static function useObserved(first:Void->Int, second:Void->String):String {
		return React.useMemo((number, label) -> '$number:$label', React.deps(first(), second()));
	}

	@:next.hook
	public static function useRepeatedSnapshots(first:Int, second:Int):Int {
		final firstState = React.useState(first);
		final firstMemo = React.useMemo((current) -> current * 2, React.deps(firstState.value));
		final secondState = React.useState(second);
		final secondMemo = React.useMemo((current) -> current * 3, React.deps(secondState.value));
		return firstMemo + secondMemo;
	}

	@:next.hook
	public static function useNullableLabel():Null<String> {
		final label = React.useState((null : Null<String>));
		label.set("ready");
		return label.value;
	}
}
