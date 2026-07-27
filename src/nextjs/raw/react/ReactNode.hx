package nextjs.raw.react;

import genes.react.Element;
import haxe.extern.EitherType;

@:genes.compilerInternal
@:genes.semanticOnly
private typedef ReactNodeValue = EitherType<Element, EitherType<String, EitherType<Float, Bool>>>;

/**
 * Values React can render as children.
 *
 * The focused value union keeps common non-HXX callback returns ergonomic.
 * `@:genes.jsxNode` delegates nested HXX validation to Genes' closed child
 * algebra, so arrays and nullable children remain checked without a broad type.
 */
@:ts.type("import('react').ReactNode")
@:genes.jsxNode
abstract ReactNode(ReactNodeValue) from Element from String from Float from Bool {}
