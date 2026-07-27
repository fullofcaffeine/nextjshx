import {Register} from "../genes/Register"

/**
 * Closed outbound query schema shared by the generated ProductPage companion.
 */
export class ProductQuery extends Register.inherits() {
	constructor(page: number, preview: boolean | undefined, tags: string[]) {
		super(page, preview, tags);
	}
	declare page: number;
	declare preview: boolean | undefined;
	declare tags: string[];
	[Register.new](...args: never[]): void;
	[Register.new](page: number, preview: boolean | undefined, tags: string[]): void {
		this.page = page;
		this.preview = preview;
		this.tags = tags;
	}
	static get __name__(): string {
		return "app.ProductQuery"
	}
	get __class__(): Function {
		return ProductQuery
	}
}
Register.setHxClass("app.ProductQuery", ProductQuery);

Register.seedProtoField(ProductQuery, "page");

Register.seedProtoField(ProductQuery, "preview");

Register.seedProtoField(ProductQuery, "tags");
