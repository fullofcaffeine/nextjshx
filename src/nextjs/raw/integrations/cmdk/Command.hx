package nextjs.raw.integrations.cmdk;

import nextjs.raw.react.ReactNode;

typedef CommandProps = {
	@:ts.optional
	final ?className:String;
	@:ts.optional
	final ?label:String;
	@:ts.optional
	final ?shouldFilter:Bool;
	@:ts.optional
	final ?defaultValue:String;
	@:ts.optional
	final ?value:String;
	@:ts.optional
	final ?onValueChange:String->Void;
	@:ts.optional
	final ?loop:Bool;
	@:ts.optional
	final ?disablePointerSelection:Bool;
	@:ts.optional
	final ?vimBindings:Bool;
	@:ts.optional
	final ?children:ReactNode;
}

typedef CommandDialogProps = {
	> CommandProps,
	@:ts.optional
	final ?open:Bool;
	@:ts.optional
	final ?defaultOpen:Bool;
	@:ts.optional
	final ?modal:Bool;
	@:ts.optional
	final ?onOpenChange:Bool->Void;
	@:ts.optional
	final ?overlayClassName:String;
	@:ts.optional
	final ?contentClassName:String;
}

typedef CommandInputProps = {
	@:ts.optional
	final ?className:String;
	@:ts.optional
	final ?placeholder:String;
	@:ts.optional
	final ?value:String;
	@:ts.optional
	final ?onValueChange:String->Void;
	@:ts.optional
	final ?disabled:Bool;
	@:ts.optional
	final ?autoFocus:Bool;
}

typedef CommandListProps = {
	@:ts.optional
	final ?className:String;
	@:ts.optional
	final ?label:String;
	@:ts.optional
	final ?children:ReactNode;
}

typedef CommandItemProps = {
	@:ts.optional
	final ?className:String;
	@:ts.optional
	final ?disabled:Bool;
	@:ts.optional
	final ?onSelect:String->Void;
	@:ts.optional
	final ?value:String;
	@:ts.optional
	final ?keywords:Array<String>;
	@:ts.optional
	final ?forceMount:Bool;
	@:ts.optional
	final ?children:ReactNode;
}

typedef CommandGroupProps = {
	@:ts.optional
	final ?className:String;
	@:ts.optional
	final ?heading:ReactNode;
	@:ts.optional
	final ?value:String;
	@:ts.optional
	final ?forceMount:Bool;
	@:ts.optional
	final ?children:ReactNode;
}

typedef CommandPartProps = {
	@:ts.optional
	final ?className:String;
	@:ts.optional
	final ?children:ReactNode;
}

typedef CommandSeparatorProps = {
	@:ts.optional
	final ?className:String;
	@:ts.optional
	final ?alwaysRender:Bool;
}

/** Faithful supported slice of cmdk's named root component export. */
@:jsRequire("cmdk", "CommandRoot")
@:genes.jsxComponentProps("nextjs.raw.integrations.cmdk.Command.CommandProps")
extern class CommandRoot {}

/** Radix-backed cmdk dialog with controlled open state and focus restoration. */
@:jsRequire("cmdk", "CommandDialog")
@:genes.jsxComponentProps("nextjs.raw.integrations.cmdk.Command.CommandDialogProps")
extern class CommandDialog {}

/** Search input whose value callback receives cmdk's normalized search text. */
@:jsRequire("cmdk", "CommandInput")
@:genes.jsxComponentProps("nextjs.raw.integrations.cmdk.Command.CommandInputProps")
extern class CommandInput {}

/** Accessible command result list. */
@:jsRequire("cmdk", "CommandList")
@:genes.jsxComponentProps("nextjs.raw.integrations.cmdk.Command.CommandListProps")
extern class CommandList {}

/** Selectable command with a stable explicit value and optional search aliases. */
@:jsRequire("cmdk", "CommandItem")
@:genes.jsxComponentProps("nextjs.raw.integrations.cmdk.Command.CommandItemProps")
extern class CommandItem {}

/** Labelled group of related commands. */
@:jsRequire("cmdk", "CommandGroup")
@:genes.jsxComponentProps("nextjs.raw.integrations.cmdk.Command.CommandGroupProps")
extern class CommandGroup {}

/** Automatically visible empty-search result. */
@:jsRequire("cmdk", "CommandEmpty")
@:genes.jsxComponentProps("nextjs.raw.integrations.cmdk.Command.CommandPartProps")
extern class CommandEmpty {}

/** Semantic divider between command groups. */
@:jsRequire("cmdk", "CommandSeparator")
@:genes.jsxComponentProps("nextjs.raw.integrations.cmdk.Command.CommandSeparatorProps")
extern class CommandSeparator {}
