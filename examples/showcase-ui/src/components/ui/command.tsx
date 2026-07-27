"use client";

import * as React from "react";
import {
  Command as CommandPrimitive,
  CommandDialog as CommandDialogPrimitive,
  CommandEmpty as CommandEmptyPrimitive,
  CommandGroup as CommandGroupPrimitive,
  CommandInput as CommandInputPrimitive,
  CommandItem as CommandItemPrimitive,
  CommandList as CommandListPrimitive,
  CommandSeparator as CommandSeparatorPrimitive,
} from "cmdk";
import { Search } from "lucide-react";

import { cn } from "../../lib/utils";

function useGlobalShortcut(
  enabled: boolean | undefined,
  open: boolean | undefined,
  onOpenChange: ((open: boolean) => void) | undefined,
) {
  React.useEffect(() => {
    if (enabled !== true || onOpenChange === undefined) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.key.toLowerCase() === "k" &&
        (event.metaKey || event.ctrlKey) &&
        !event.altKey
      ) {
        event.preventDefault();
        onOpenChange(!open);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [enabled, onOpenChange, open]);
}

function Command({ className, ...props }: React.ComponentProps<typeof CommandPrimitive>) {
  return (
    <CommandPrimitive
      data-slot="command"
      className={cn("flex size-full flex-col overflow-hidden", className)}
      {...props}
    />
  );
}

function CommandDialog({
  className,
  contentClassName,
  modKShortcut,
  onOpenChange,
  overlayClassName,
  returnFocusId,
  ...props
}: React.ComponentProps<typeof CommandDialogPrimitive> & {
  modKShortcut?: boolean;
  returnFocusId?: string;
}) {
  const handleOpenChange = React.useCallback(
    (next: boolean) => {
      onOpenChange?.(next);
      if (!next && returnFocusId !== undefined) focusCommandTarget(returnFocusId);
    },
    [onOpenChange, returnFocusId],
  );

  useGlobalShortcut(modKShortcut, props.open, handleOpenChange);

  return (
    <CommandDialogPrimitive
      data-slot="command-dialog"
      className={cn("flex size-full flex-col overflow-hidden", className)}
      contentClassName={cn("overflow-hidden p-0", contentClassName)}
      overlayClassName={cn(overlayClassName)}
      onOpenChange={handleOpenChange}
      {...props}
    />
  );
}

function CommandInput({ className, ...props }: React.ComponentProps<typeof CommandInputPrimitive>) {
  return (
    <div data-slot="command-input-wrapper" className="flex items-center border-b px-3">
      <Search className="mr-2 size-4 shrink-0 opacity-60" aria-hidden="true" />
      <CommandInputPrimitive
        data-slot="command-input"
        className={cn(
          "flex h-12 w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      />
    </div>
  );
}

function CommandList({ className, ...props }: React.ComponentProps<typeof CommandListPrimitive>) {
  return (
    <CommandListPrimitive
      data-slot="command-list"
      className={cn("max-h-[min(60vh,28rem)] overflow-x-hidden overflow-y-auto", className)}
      {...props}
    />
  );
}

function CommandEmpty(props: React.ComponentProps<typeof CommandEmptyPrimitive>) {
  return <CommandEmptyPrimitive data-slot="command-empty" {...props} />;
}

function CommandGroup({ className, ...props }: React.ComponentProps<typeof CommandGroupPrimitive>) {
  return (
    <CommandGroupPrimitive
      data-slot="command-group"
      className={cn("overflow-hidden p-1", className)}
      {...props}
    />
  );
}

function CommandItem({
  className,
  focusTargetId,
  onSelect,
  ...props
}: React.ComponentProps<typeof CommandItemPrimitive> & { focusTargetId?: string }) {
  const handleSelect = React.useCallback(
    (value: string) => {
      onSelect?.(value);
      if (focusTargetId !== undefined) focusCommandTarget(focusTargetId);
    },
    [focusTargetId, onSelect],
  );

  return (
    <CommandItemPrimitive
      data-slot="command-item"
      className={cn(
        "relative flex cursor-default select-none items-center gap-3 px-3 py-2.5 outline-none data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50 data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground",
        className,
      )}
      onSelect={handleSelect}
      {...props}
    />
  );
}

function CommandSeparator({
  className,
  ...props
}: React.ComponentProps<typeof CommandSeparatorPrimitive>) {
  return (
    <CommandSeparatorPrimitive
      data-slot="command-separator"
      className={cn("-mx-1 h-px bg-border", className)}
      {...props}
    />
  );
}

function CommandShortcutLabel({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="command-shortcut"
      className={cn("ml-auto text-xs tracking-widest text-muted-foreground", className)}
      {...props}
    />
  );
}

/**
 * Normalizes the browser's nullable lookup while preserving post-dialog focus
 * timing for the typed Haxe intent layer.
 */
function focusCommandTarget(elementId: string) {
  window.setTimeout(() => document.getElementById(elementId)?.focus(), 0);
}

export {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcutLabel,
};
