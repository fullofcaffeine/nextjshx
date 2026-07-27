package nextjs.app;

/** Exact props supplied to an App Router `error.tsx` component. */
typedef ErrorProps = {
	final error:ErrorBoundaryError;
	final reset:Void->Void;
}
