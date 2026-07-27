package nextjs.raw.react;

import nextjs.raw.types.Tuple2;

/** Exact positional result returned by React `useState`. */
typedef UseStateResult<State> = Tuple2<State, Dispatch<SetStateAction<State>>>;
