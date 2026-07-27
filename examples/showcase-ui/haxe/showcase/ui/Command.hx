package showcase.ui;

import nextjs.raw.integrations.cmdk.Command.CommandGroupProps;
import nextjs.raw.integrations.cmdk.Command.CommandInputProps;
import nextjs.raw.integrations.cmdk.Command.CommandItemProps;
import nextjs.raw.integrations.cmdk.Command.CommandListProps;
import nextjs.raw.integrations.cmdk.Command.CommandPartProps;
import nextjs.raw.integrations.cmdk.Command.CommandProps;
import nextjs.raw.integrations.cmdk.Command.CommandSeparatorProps;
import nextjs.raw.react.ReactNode;

typedef UiCommandDialogProps = {
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
	@:ts.optional
	final ?modKShortcut:Bool;
	@:ts.optional
	final ?returnFocusId:String;
}

typedef UiCommandItemProps = {
	> CommandItemProps,
	@:ts.optional
	final ?focusTargetId:String;
}

typedef CommandShortcutLabelProps = {
	@:ts.optional
	final ?className:String;
	@:ts.optional
	final ?children:ReactNode;
}

/** Source-owned shadcn command root backed directly by cmdk. */
@:jsRequire("@nextjshx/showcase-ui/command", "Command")
@:genes.jsxComponentProps("nextjs.raw.integrations.cmdk.Command.CommandProps")
extern class UiCommand {}

/** Controlled cmdk/Radix dialog with an explicit optional Mod+K shortcut. */
@:jsRequire("@nextjshx/showcase-ui/command", "CommandDialog")
@:genes.jsxComponentProps("showcase.ui.Command.UiCommandDialogProps")
extern class UiCommandDialog {}

@:jsRequire("@nextjshx/showcase-ui/command", "CommandInput")
@:genes.jsxComponentProps("nextjs.raw.integrations.cmdk.Command.CommandInputProps")
extern class UiCommandInput {}

@:jsRequire("@nextjshx/showcase-ui/command", "CommandList")
@:genes.jsxComponentProps("nextjs.raw.integrations.cmdk.Command.CommandListProps")
extern class UiCommandList {}

@:jsRequire("@nextjshx/showcase-ui/command", "CommandItem")
@:genes.jsxComponentProps("showcase.ui.Command.UiCommandItemProps")
extern class UiCommandItem {}

@:jsRequire("@nextjshx/showcase-ui/command", "CommandGroup")
@:genes.jsxComponentProps("nextjs.raw.integrations.cmdk.Command.CommandGroupProps")
extern class UiCommandGroup {}

@:jsRequire("@nextjshx/showcase-ui/command", "CommandEmpty")
@:genes.jsxComponentProps("nextjs.raw.integrations.cmdk.Command.CommandPartProps")
extern class UiCommandEmpty {}

@:jsRequire("@nextjshx/showcase-ui/command", "CommandSeparator")
@:genes.jsxComponentProps("nextjs.raw.integrations.cmdk.Command.CommandSeparatorProps")
extern class UiCommandSeparator {}

@:jsRequire("@nextjshx/showcase-ui/command", "CommandShortcutLabel")
@:genes.jsxComponentProps("showcase.ui.Command.CommandShortcutLabelProps")
extern class UiCommandShortcutLabel {}
