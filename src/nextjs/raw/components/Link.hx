package nextjs.raw.components;

@:genes.compilerInternal
@:genes.semanticOnly
typedef LinkComponentProps = nextjs.raw.components.LinkProps.LinkPropsFields<String>;

/** Current transition state exposed by `useLinkStatus`. */
typedef LinkStatus = {
	final pending:Bool;
}

/** Faithful default-import component binding for `next/link`. */
@:jsRequire("next/link", "default")
@:genes.jsxComponentProps("nextjs.raw.components.Link.LinkComponentProps")
extern class Link {
	@:next.hook
	@:jsRequire("next/link", "useLinkStatus")
	static function useLinkStatus():LinkStatus;
}
