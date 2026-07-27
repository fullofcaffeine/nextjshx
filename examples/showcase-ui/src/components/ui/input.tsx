import * as React from "react";

import { cn } from "../../lib/utils";

type HaxeAriaInputProps = {
  ariaInvalid?: React.AriaAttributes["aria-invalid"];
};

function Input({
  className,
  type,
  ariaInvalid,
  ...props
}: React.ComponentProps<"input"> & HaxeAriaInputProps) {
  return (
    <input
      type={type}
      data-slot="input"
      aria-invalid={ariaInvalid}
      className={cn(
        "h-10 w-full min-w-0 border border-input bg-transparent px-3 py-1 text-base shadow-xs outline-none transition-[color,box-shadow,border-color] placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/35 aria-invalid:border-destructive aria-invalid:ring-destructive/20",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
