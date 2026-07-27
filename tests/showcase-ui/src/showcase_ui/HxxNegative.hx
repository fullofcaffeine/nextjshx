package showcase_ui;

import genes.react.Element;
import showcase.ui.Button.SlottedButton;
import showcase.ui.Button.UiButton;
import showcase.ui.Command.UiCommandDialog;
import showcase.ui.Command.UiCommandItem;
import showcase.ui.Separator.Separator;
import showcase.ui.Sheet.Sheet;
import showcase.ui.Sheet.SlottedSheetTrigger;
import showcase.ui.Slot;

typedef RequiredLabelProps = {
	final label:String;
}

/**
 * Downstream proof that the pinned compiler rejects invalid HXX in Haxe.
 *
 * Each build define selects exactly one authored mistake. The harness checks
 * the source-positioned Genes diagnostic and verifies that no TSX is committed.
 */
class HxxNegative {
	static function RequiredLabel(props:RequiredLabelProps):Element {
		return <span>{props.label}</span>;
	}

	public static function main():Void {
		#if hxx_unknown_intrinsic
		final value = <buton />;
		#elseif hxx_missing_required
		final value = <RequiredLabel />;
		#elseif hxx_unknown_component_prop
		final value = <UiButton heroic />;
		#elseif hxx_wrong_component_prop
		final value = <UiButton size={123} />;
		#elseif hxx_invalid_component_child
		final value = <Separator>not allowed</Separator>;
		#elseif hxx_invalid_spread
		final props = {heroic: true};
		final value = <UiButton {...props} />;
		#elseif hxx_invalid_handler
		final value = <button onClick="not a handler">Invalid</button>;
		#elseif hxx_slot_text_child
		final value = <Slot>not an element</Slot>;
		#elseif hxx_slot_multiple_children
		final value = <Slot><button>One</button><button>Two</button></Slot>;
		#elseif hxx_slotted_button_multiple_children
		final value = <SlottedButton asChild><a href="#one">One</a><span>Two</span></SlottedButton>;
		#elseif hxx_sheet_trigger_missing_child
		final value = <SlottedSheetTrigger asChild />;
		#elseif hxx_sheet_wrong_callback
		final value = <Sheet onOpenChange={function(_value:String):Void {}} />;
		#elseif hxx_plain_button_as_child
		final value = <UiButton asChild><a href="#plain">Plain identity</a></UiButton>;
		#elseif hxx_slotted_button_missing_flag
		final value = <SlottedButton><a href="#slotted">Missing flag</a></SlottedButton>;
		#elseif hxx_command_wrong_select
		final value = <UiCommandItem onSelect={function(_value:Int):Void {}}>Wrong callback</UiCommandItem>;
		#elseif hxx_command_wrong_keywords
		final value = <UiCommandItem keywords={[1, 2]}>Wrong keywords</UiCommandItem>;
		#elseif hxx_command_wrong_shortcut
		final value = <UiCommandDialog modKShortcut="yes" />;
		#end
		trace(value);
	}
}
