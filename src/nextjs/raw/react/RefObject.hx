package nextjs.raw.react;

/** Faithful mutable object returned by React `useRef`. */
@:ts.type("import('react').RefObject<$0>")
extern class RefObject<Value> {
	var current:Value;
}
