package nextjs.raw.react;

typedef SuspenseProps = {
	@:ts.optional
	@:optional var children:ReactNode;
	@:ts.optional
	@:optional var fallback:ReactNode;
	@:ts.optional
	@:optional var name:String;
}

/** Direct public React Suspense boundary with its closed stable props. */
@:jsRequire("react", "Suspense")
@:genes.jsxComponentProps("nextjs.raw.react.Suspense.SuspenseProps")
extern class Suspense {}
