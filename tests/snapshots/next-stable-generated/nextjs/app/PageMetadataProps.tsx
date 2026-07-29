import {Register} from "../../genes/Register"

/**
 * Page-specific `generateMetadata` props with Promise-shaped search params.
 */
export type PageMetadataProps<Params, Query> = {
	params: globalThis.Promise<Params>,
	searchParams: globalThis.Promise<Query>
}
