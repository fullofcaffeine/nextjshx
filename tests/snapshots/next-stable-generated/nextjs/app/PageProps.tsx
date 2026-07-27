import {Register} from "../../genes/Register"

/**
 * Haxe-facing props for one App Router page declaration.
 *
 * The declaration macro validates `Params` against the annotated route and
 * currently requires `Query` to be the faithful raw `SearchParams` shape.
 * Both values remain Promise-shaped to match current Next.js behavior.
 */
export type PageProps<Params, Query> = {
	params: Promise<Params>,
	searchParams: Promise<Query>
}
