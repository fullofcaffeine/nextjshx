package nextjs.raw.react;

import nextjs.raw.types.Tuple3;

/** Exact positional result returned by React `useActionState`. */
typedef UseActionStateResult<State, Payload> = Tuple3<State, Payload->Void, Bool>;
