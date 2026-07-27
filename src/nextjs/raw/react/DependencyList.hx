package nextjs.raw.react;

/**
 * Readonly TypeScript projection over an ordinary JavaScript array.
 *
 * The closed element type is narrower than React's broad `unknown`, while
 * remaining assignable to React's `DependencyList`. No mutating Array methods
 * are forwarded through this raw view.
 */
@:ts.type("readonly $0[]")
abstract DependencyList<Value>(Array<Value>) from Array<Value> {}
