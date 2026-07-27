package nextjs.app;

import js.lib.Promise;

/**
 * Optional props received by a parallel route's `default.tsx` fallback.
 *
 * Next supplies dynamic parameters from the App Router root down to the slot,
 * and Next 16 exposes them asynchronously. A zero-argument default render is
 * also valid when the fallback does not need route parameters.
 */
typedef DefaultProps<Params> = {
	final params:Promise<Params>;
}
