package commerce.client;

import commerce.app.ProductPage;
import commerce.client.CartHook.CartLine;
import commerce.client.CartHook.CartModel;
import commerce.client.CartHook.CartProduct;
import commerce.client.CartHook.CartProductCategory;
import commerce.client.CartHook.CatalogFilter;
import genes.react.Element;
import nextjs.components.NextImage;
import nextjs.components.NextLink;
import nextjs.raw.components.ImageProps;
import showcase.ui.Badge;
import showcase.ui.Badge.BadgeProps;
import showcase.ui.Badge.BadgeVariant;
import showcase.ui.Button.ButtonProps;
import showcase.ui.Button.ButtonSize;
import showcase.ui.Button.ButtonType;
import showcase.ui.Button.ButtonVariant;
import showcase.ui.Button.UiButton;
import showcase.ui.Card;
import showcase.ui.Card.CardContent;
import showcase.ui.Card.CardFooter;
import showcase.ui.Card.CardHeader;
import showcase.ui.Card.CardProps;
import showcase.ui.Icons.IconProps;
import showcase.ui.Icons.Minus;
import showcase.ui.Icons.Plus;
import showcase.ui.Icons.ShoppingBag;
import showcase.ui.Sheet;
import showcase.ui.Sheet.SheetContent;
import showcase.ui.Sheet.SheetContentProps;
import showcase.ui.Sheet.SheetDescription;
import showcase.ui.Sheet.SheetFooter;
import showcase.ui.Sheet.SheetHeader;
import showcase.ui.Sheet.SheetPartProps;
import showcase.ui.Sheet.SheetSide;
import showcase.ui.Sheet.SheetTitle;
import showcase.ui.Sheet.SlottedSheetClose;
import showcase.ui.Sheet.SlottedSheetTrigger;

typedef ShopClientProps = {
	final products:Array<CartProduct>;
}

/**
 * `@:next.clientComponent` establishes the ordinary Next `"use client"`
 * boundary. Haxe checks the props, Hooks, events, and HXX; a thin generated
 * adapter gives Next the directive and canonical module shape it expects.
 */
@:next.clientComponent
class ShopClient {
	/**
	 * Composes filtering, cart controls, product cards, and the native Sheet.
	 *
	 * `useShopCart` owns the state transition model; this component projects it
	 * into HXX with exact package props. React still schedules updates and Radix
	 * still owns accessible Sheet behavior.
	 */
	public static function render(props:ShopClientProps):Element {
		final cart = CartHook.useShopCart(props.products);
		final visible = switch cart.filter {
			case CatalogFilter.All: props.products;
			case CatalogFilter.Systems: props.products.filter(product -> product.category == CartProductCategory.Systems);
			case CatalogFilter.Tools: props.products.filter(product -> product.category == CartProductCategory.Tools);
		};
		final cards = visible.map(product -> renderProduct(product, cart));
		final trigger:ButtonProps = {
			variant: ButtonVariant.Outline,
			size: ButtonSize.Large,
			type: ButtonType.Button,
			className: "cart-trigger"
		};
		final content:SheetContentProps = {side: SheetSide.Right, className: "cart-sheet", showCloseButton: true};
		final header:SheetPartProps = {className: "cart-sheet-header"};
		final footer:SheetPartProps = {className: "cart-sheet-footer"};
		final icon:IconProps = {size: 18, strokeWidth: 1.6};
		final lines = cart.lines.map(line -> renderCartLine(line, cart));
		final cartContents:Element = cart.lines.length == 0 ? <div className="empty-bag"><ShoppingBag {...icon} /><p>Nothing planted yet.</p><span>Add an object from the catalogue.</span></div> : <div className="cart-line-list">{lines}</div>;
		return <section id="shop-catalog" className="shop-catalog">
			<div className="catalog-toolbar">
				<div><span>CATALOGUE / 03 OBJECTS</span><p>Filter the current growing season.</p></div>
				<div className="catalog-filters" role="group" aria-label="Filter products">
					{filterButton("All", CatalogFilter.All, cart)}
					{filterButton("Systems", CatalogFilter.Systems, cart)}
					{filterButton("Tools", CatalogFilter.Tools, cart)}
				</div>
				<Sheet>
					<SlottedSheetTrigger asChild><UiButton {...trigger}><ShoppingBag {...icon} /> Bag <span id="cart-count">{cart.count}</span></UiButton></SlottedSheetTrigger>
					<SheetContent {...content}>
						<SheetHeader {...header}><span className="receipt-kicker">COMMON GROUND / ORDER NOTE</span><SheetTitle>Your growing bag</SheetTitle><SheetDescription>Tools selected for the next small harvest.</SheetDescription></SheetHeader>
						<div id="cart-lines" className="cart-lines">{cartContents}</div>
						<SheetFooter {...footer}>
							<div className="receipt-total"><span>ESTIMATED TOTAL</span><strong id="cart-total">{money(cart.totalCents)}</strong></div>
							<UiButton className="checkout-button" disabled={cart.count == 0}>Review order</UiButton>
							<SlottedSheetClose asChild><UiButton variant={ButtonVariant.Outline} type={ButtonType.Button}>Keep shopping</UiButton></SlottedSheetClose>
							<button className="clear-bag" type="button" onClick={_ -> cart.clear()}>Clear bag</button>
						</SheetFooter>
					</SheetContent>
				</Sheet>
			</div>
			<div className="product-grid">{cards}</div>
		</section>;
	}

	static function filterButton(label:String, filter:CatalogFilter, cart:CartModel):Element {
		final select = switch filter {
			case CatalogFilter.All: cart.showAll;
			case CatalogFilter.Systems: cart.showSystems;
			case CatalogFilter.Tools: cart.showTools;
		};
		final button:ButtonProps = {
			variant: ButtonVariant.Ghost,
			type: ButtonType.Button,
			className: "filter-button" + (cart.filter == filter ? " active" : ""),
			ariaPressed: cart.filter == filter,
			onClick: _ -> select()
		};
		return <UiButton {...button}>{label}</UiButton>;
	}

	/** Renders one typed product and wires its nominal slug to the cart Hook. */
	static function renderProduct(product:CartProduct, cart:CartModel):Element {
		final image:ImageProps = {
			src: product.image,
			alt: product.alt,
			width: 720,
			height: 720,
			sizes: "(max-width: 700px) 100vw, 33vw"
		};
		final card:CardProps = {className: "product-card"};
		final badge:BadgeProps = {variant: BadgeVariant.Outline};
		final add:ButtonProps = {
			variant: ButtonVariant.Outline,
			type: ButtonType.Button,
			className: "add-button",
			onClick: _ -> cart.add(product.slug)
		};
		final icon:IconProps = {size: 17, strokeWidth: 1.7};
		return <Card {...card}>
			<div className="product-visual"><NextLink href={ProductPage.href({slug: product.slug})}><NextImage {...image} /></NextLink><Badge {...badge}>{product.category == CartProductCategory.Systems ? "Growing system" : "Seed tool"}</Badge></div>
			<CardHeader><div><span>{product.edition}</span><strong>{product.price}</strong></div><NextLink href={ProductPage.href({slug: product.slug})}><h2>{product.name}</h2></NextLink></CardHeader>
			<CardContent><p>{product.tagline}</p></CardContent>
			<CardFooter><UiButton {...add}>Add to bag <Plus {...icon} /></UiButton></CardFooter>
		</Card>;
	}

	/** Renders one derived cart line with bounded increment/decrement actions. */
	static function renderCartLine(line:CartLine, cart:CartModel):Element {
		final remove:ButtonProps = {
			variant: ButtonVariant.Ghost,
			size: ButtonSize.IconSmall,
			type: ButtonType.Button,
			className: "line-remove",
			ariaLabel: "Remove one " + line.product.name,
			onClick: _ -> cart.remove(line.product.slug)
		};
		final add:ButtonProps = {
			variant: ButtonVariant.Ghost,
			size: ButtonSize.IconSmall,
			type: ButtonType.Button,
			className: "line-add",
			ariaLabel: "Add one " + line.product.name,
			onClick: _ -> cart.add(line.product.slug)
		};
		final icon:IconProps = {size: 14, strokeWidth: 1.8};
		return <article className="cart-line">
			<img src={line.product.image} alt="" /><div><span>{line.product.edition}</span><strong>{line.product.name}</strong><small>{line.product.price}</small></div>
			<div className="line-quantity"><UiButton {...remove}><Minus {...icon} /></UiButton><b>{line.quantity}</b><UiButton {...add}><Plus {...icon} /></UiButton></div>
		</article>;
	}

	static function money(cents:Int):String {
		final dollars = Std.int(cents / 100);
		final remainder = cents % 100;
		return "$" + dollars + "." + (remainder < 10 ? "0" : "") + remainder;
	}
}
