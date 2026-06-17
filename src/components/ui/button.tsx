import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-md text-sm font-medium outline-none transition-[background-color,border-color,color,box-shadow,opacity] duration-150 focus-visible:ring-2 focus-visible:ring-ring/35 disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-elevation-100 hover:bg-primary/85 active:bg-primary/75",
        destructive:
          "bg-danger text-danger-foreground shadow-elevation-100 hover:bg-danger/85 active:bg-danger/75 focus-visible:ring-danger/30",
        outline:
          "border border-border-strong bg-surface text-foreground hover:bg-accent hover:text-accent-foreground active:bg-secondary",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/75 active:bg-secondary/90",
        soft: "bg-primary/8 text-foreground hover:bg-primary/12 active:bg-primary/16",
        ghost: "text-muted-foreground hover:bg-accent hover:text-foreground active:bg-secondary",
        link: "h-auto gap-1 rounded-sm px-0 text-foreground underline-offset-4 hover:underline focus-visible:ring-offset-2",
      },
      size: {
        default: "h-8 gap-1.5 px-3 has-[>svg]:px-2.5",
        sm: "h-7 gap-1 px-2.5 text-xs has-[>svg]:px-2",
        lg: "h-9 gap-2 px-4 has-[>svg]:px-3",
        icon: "size-8",
        "icon-sm": "size-7",
        "icon-lg": "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
