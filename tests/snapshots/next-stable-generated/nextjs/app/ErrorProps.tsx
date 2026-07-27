import {Register} from "../../genes/Register"

/**
 * Exact props supplied to an App Router `error.tsx` component.
 */
export type ErrorProps = {
	error: Error & { digest?: string },
	reset: () => void
}
