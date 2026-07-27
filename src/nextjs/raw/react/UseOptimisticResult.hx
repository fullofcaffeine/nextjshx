package nextjs.raw.react;

import nextjs.raw.types.Tuple2;

/** Exact positional result returned by React `useOptimistic`. */
typedef UseOptimisticResult<State, Action> = Tuple2<State, Dispatch<Action>>;
