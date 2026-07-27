package showcase_ui;

import genes.react.Element;
import showcase.ui.Badge;
import showcase.ui.Badge.BadgeVariant;
import showcase.ui.Badge.SlottedBadge;
import showcase.ui.Button.ButtonSize;
import showcase.ui.Button.ButtonType;
import showcase.ui.Button.ButtonVariant;
import showcase.ui.Button.SlottedButton;
import showcase.ui.Button.UiButton;
import showcase.ui.Card.Card;
import showcase.ui.Card.CardAction;
import showcase.ui.Card.CardContent;
import showcase.ui.Card.CardDescription;
import showcase.ui.Card.CardFooter;
import showcase.ui.Card.CardHeader;
import showcase.ui.Card.CardTitle;
import showcase.ui.Command.UiCommand;
import showcase.ui.Command.UiCommandDialog;
import showcase.ui.Command.UiCommandEmpty;
import showcase.ui.Command.UiCommandGroup;
import showcase.ui.Command.UiCommandInput;
import showcase.ui.Command.UiCommandItem;
import showcase.ui.Command.UiCommandList;
import showcase.ui.Command.UiCommandSeparator;
import showcase.ui.Command.UiCommandShortcutLabel;
import showcase.ui.Icons.ArrowUpRight;
import showcase.ui.Input.InputType;
import showcase.ui.Input.UiInput;
import showcase.ui.Separator.Separator;
import showcase.ui.Separator.SeparatorOrientation;
import showcase.ui.Sheet.SlottedSheetClose;
import showcase.ui.Sheet.SlottedSheetTrigger;
import showcase.ui.Sheet.Sheet;
import showcase.ui.Sheet.SheetContent;
import showcase.ui.Sheet.SheetDescription;
import showcase.ui.Sheet.SheetFooter;
import showcase.ui.Sheet.SheetHeader;
import showcase.ui.Sheet.SheetSide;
import showcase.ui.Sheet.SheetTitle;
import showcase.ui.Slot;
import showcase.ui.Textarea.Textarea;

/**
 * Focused type and syntax contract for the source-owned shadcn surface.
 *
 * The spread on ArrowUpRight is intentionally kept here: Haxe must parse the
 * HXX attribute expression and strict TypeScript must accept the emitted TSX.
 */
class SurfaceConsumer {
	public static function main():Void {
		render();
	}

	public static function render():Element {
		final card = {className: "contract-card"};
		final input = {
			type: InputType.Search,
			name: "query",
			placeholder: "Search the field notes"
		};
		final textarea = {
			name: "note",
			rows: 4,
			maxLength: 240,
			placeholder: "Add a bounded field note"
		};
		final sheet = {
			open: true,
			onOpenChange: function(_open:Bool):Void {}
		};
		final part = {className: "contract-part"};
		final icon = {size: 16, strokeWidth: 1.5};
		final commandDialog = {
			open: true,
			onOpenChange: function(_open:Bool):Void {},
			label: "Compiler command contract"
		};

		return <main>
			<Badge variant={BadgeVariant.Secondary}>Checked</Badge>
			<SlottedBadge variant={BadgeVariant.Outline} asChild><a href="#contract-badge">Linked badge</a></SlottedBadge>
			<Slot className="contract-slot" onClick={event -> event.preventDefault()}><a href="#contract-slot">Direct slot</a></Slot>
			<Card {...card}>
				<CardHeader {...part}>
					<CardTitle>Compiler surface</CardTitle>
					<CardDescription>Haxe-authored, strict-TSX checked.</CardDescription>
					<CardAction><ArrowUpRight {...icon} /></CardAction>
				</CardHeader>
				<CardContent {...part}><UiInput {...input} /><Textarea {...textarea} /></CardContent>
				<CardFooter {...part}>
					<UiButton variant={ButtonVariant.Outline} size={ButtonSize.Small} type={ButtonType.Button} onClick={event -> event.preventDefault()}>Continue</UiButton>
					<SlottedButton variant={ButtonVariant.Link} size={ButtonSize.Small} asChild><a href="#contract-button">Open work</a></SlottedButton>
				</CardFooter>
			</Card>
			<Separator orientation={SeparatorOrientation.Horizontal} decorative />
			<Sheet {...sheet}>
				<SlottedSheetTrigger asChild><UiButton>Open</UiButton></SlottedSheetTrigger>
				<SheetContent side={SheetSide.Right} showCloseButton onEscapeKeyDown={event -> event.preventDefault()}>
					<SheetHeader {...part}>
						<SheetTitle>Typed sheet</SheetTitle>
						<SheetDescription>No unchecked prop escape hatch.</SheetDescription>
					</SheetHeader>
					<SheetFooter {...part}><SlottedSheetClose asChild><UiButton>Close</UiButton></SlottedSheetClose></SheetFooter>
				</SheetContent>
			</Sheet>
			<UiCommand label="Inline compiler commands" loop>
				<UiCommandInput placeholder="Search commands" />
				<UiCommandList label="Compiler commands">
					<UiCommandEmpty>No command found.</UiCommandEmpty>
					<UiCommandGroup heading="Contract">
						<UiCommandItem value="open-contract" keywords={["open", "contract"]} focusTargetId="contract-trigger" onSelect={function(_value:String):Void {}}>
							<span>Open contract</span><UiCommandShortcutLabel>⌘K</UiCommandShortcutLabel>
						</UiCommandItem>
					</UiCommandGroup>
					<UiCommandSeparator alwaysRender />
				</UiCommandList>
			</UiCommand>
			<UiCommandDialog {...commandDialog} modKShortcut returnFocusId="contract-trigger">
				<UiCommandInput placeholder="Search dialog commands" autoFocus />
				<UiCommandList><UiCommandEmpty>Nothing here.</UiCommandEmpty></UiCommandList>
			</UiCommandDialog>
		</main>;
	}
}
