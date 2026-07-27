package content_blocks;

import genes.react.Element;

/** Precise test-only binding for React's server-rendering proof. */
extern class ReactDomServer {
	@:jsRequire("react-dom/server", "renderToStaticMarkup")
	static function renderToStaticMarkup(element:Element):String;
}
