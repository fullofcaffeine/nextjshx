package client_components.client;

import genes.react.React.useState;
import genes.react.React.useMemo;
import genes.react.React.deps;

typedef DependencyProps = {
	final label:String;
}

/** Positive controls for closed, heterogeneous, inline dependency packaging. */
@:keep
class DependencyHooks {
	@:next.hook
	public static function useConstant():Int {
		return useMemo(() -> 42, deps());
	}

	@:next.hook
	public static function useSummary(value:Int, label:String, enabled:Bool):String {
		return useMemo((value, label, enabled) -> enabled ? '$label:$value' : label, deps(value, label, enabled));
	}

	@:next.hook
	public static function useRange(first:Int, second:Int):Int {
		return useMemo((first, second) -> second - first, deps(first, second));
	}

	@:next.hook
	public static function useProperty(props:DependencyProps):String {
		return useMemo(() -> props.label.toUpperCase(), deps(props.label));
	}

	@:next.hook
	public static function useDuplicate(value:Int):Int {
		return useMemo((first, second) -> first + second, deps(value, value));
	}

	@:next.hook
	public static function useNullableSnapshot(initial:Null<String>):Null<String> {
		final label = useState(initial);
		return useMemo((current) -> current, deps(label.value));
	}

	@:next.hook
	public static function useObserved(first:Void->Int, second:Void->String):String {
		return useMemo((number, label) -> '$number:$label', deps(first(), second()));
	}

	@:next.hook
	public static function useRepeatedSnapshots(first:Int, second:Int):Int {
		final firstState = useState(first);
		final firstMemo = useMemo((current) -> current * 2, deps(firstState.value));
		final secondState = useState(second);
		final secondMemo = useMemo((current) -> current * 3, deps(secondState.value));
		return firstMemo + secondMemo;
	}

	@:next.hook
	public static function useNullableLabel():Null<String> {
		final label = useState((null : Null<String>));
		label.set("ready");
		return label.value;
	}
}
