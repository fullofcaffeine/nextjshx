import * as React from "react";

import { cn } from "../../lib/utils";

type HaxeAriaTextareaProps = {
  ariaInvalid?: React.AriaAttributes["aria-invalid"];
};

function Textarea({
  className,
  ariaInvalid,
  ...props
}: React.ComponentProps<"textarea"> & HaxeAriaTextareaProps) {
  return (
    <textarea
      data-slot="textarea"
      aria-invalid={ariaInvalid}
      className={cn(
        "min-h-24 w-full resize-y border border-input bg-transparent px-3 py-2 text-base shadow-xs outline-none transition-[color,box-shadow,border-color] placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/35 aria-invalid:border-destructive aria-invalid:ring-destructive/20",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
