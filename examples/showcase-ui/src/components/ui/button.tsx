import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "../../lib/utils";

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap text-sm font-semibold transition-[color,background-color,border-color,box-shadow,transform] outline-none disabled:pointer-events-none disabled:opacity-45 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/35 active:translate-y-px [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-xs hover:bg-primary/88",
        destructive:
          "bg-destructive text-white shadow-xs hover:bg-destructive/88 focus-visible:ring-destructive/25",
        outline:
          "border border-border bg-background/70 shadow-xs hover:border-primary/45 hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/82",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "h-auto rounded-none p-0 text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 rounded-md px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 gap-1.5 rounded-md px-3 has-[>svg]:px-2.5",
        lg: "h-11 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-9 rounded-md",
        "icon-sm": "size-8 rounded-md",
        "icon-lg": "size-11 rounded-md",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

type HaxeAriaButtonProps = {
  ariaLabel?: React.AriaAttributes["aria-label"];
  ariaHasPopup?: React.AriaAttributes["aria-haspopup"];
  ariaPressed?: React.AriaAttributes["aria-pressed"];
};

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ariaLabel,
  ariaHasPopup,
  ariaPressed,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  } & HaxeAriaButtonProps) {
  const Component = asChild ? Slot : "button";

  return (
    <Component
      data-slot="button"
      data-variant={variant}
      data-size={size}
      aria-label={ariaLabel}
      aria-haspopup={ariaHasPopup}
      aria-pressed={ariaPressed}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
