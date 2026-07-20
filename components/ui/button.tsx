"use client"

import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { LoadingIndicator } from "./indicator"

const buttonVariants = cva(
  [
    "relative inline-flex items-center justify-center gap-[var(--button-gap-md)]",
    "font-[var(--button-font-weight)] leading-none whitespace-nowrap select-none",
    "transition-[background-color,border-color,color,box-shadow] duration-[var(--transition-duration-basic)]",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-1",
    "disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none",
    "cursor-pointer",
  ],
  {
    variants: {
      variant: {
        solid:   "bg-[var(--color-background-primary-solid)] text-[var(--color-text-primary-solid)] hover:bg-[var(--color-background-primary-solid-hover)] active:bg-[var(--color-background-primary-solid-active)]",
        soft:    "bg-[var(--color-background-primary-soft)] text-[var(--color-text)] hover:bg-[var(--color-background-primary-soft-hover)] active:bg-[var(--color-background-primary-soft-active)]",
        outline: "border border-[var(--color-border-primary-outline)] bg-transparent text-[var(--color-text)] hover:bg-[var(--color-background-primary-outline-hover)] hover:border-[var(--color-border-primary-outline-hover)] active:bg-[var(--color-background-primary-outline-active)]",
        ghost:   "bg-transparent text-[var(--color-text)] hover:bg-[var(--color-background-primary-ghost-hover)] active:bg-[var(--color-background-primary-ghost-active)]",
        danger:  "bg-[var(--color-background-danger-solid)] text-[var(--color-text-danger-solid)] hover:bg-[var(--red-600)] active:bg-[var(--red-700)]",
        success: "bg-[var(--color-background-success-solid)] text-[var(--color-text-success-solid)] hover:bg-[var(--green-600)]",
        info:    "bg-[var(--color-background-info-solid)] text-[var(--color-text-info-solid)] hover:bg-[var(--blue-500)]",
      },
      size: {
        "3xs": "h-[var(--control-size-3xs)] px-[var(--control-gutter-2xs)] text-[var(--control-font-size-sm)] rounded-[var(--control-radius-sm)]",
        "2xs": "h-[var(--control-size-2xs)] px-[var(--control-gutter-xs)]  text-[var(--control-font-size-sm)] rounded-[var(--control-radius-sm)]",
        "xs":  "h-[var(--control-size-xs)]  px-[var(--control-gutter-xs)]  text-[var(--control-font-size-md)] rounded-[var(--control-radius-sm)]",
        "sm":  "h-[var(--control-size-sm)]  px-[var(--control-gutter-sm)]  text-[var(--control-font-size-md)] rounded-[var(--control-radius-md)]",
        "md":  "h-[var(--control-size-md)]  px-[var(--control-gutter-md)]  text-[var(--control-font-size-md)] rounded-[var(--control-radius-md)]",
        "lg":  "h-[var(--control-size-lg)]  px-[var(--control-gutter-md)]  text-[var(--control-font-size-md)] rounded-[var(--control-radius-md)]",
        "xl":  "h-[var(--control-size-xl)]  px-[var(--control-gutter-lg)]  text-[var(--control-font-size-md)] rounded-[var(--control-radius-lg)]",
        "2xl": "h-[var(--control-size-2xl)] px-[var(--control-gutter-xl)]  text-[var(--control-font-size-lg)] rounded-[var(--control-radius-xl)]",
        "3xl": "h-[var(--control-size-3xl)] px-[var(--control-gutter-xl)]  text-[var(--control-font-size-lg)] rounded-[var(--control-radius-xl)]",
      },
      pill: {
        true: "rounded-full",
      },
      block: {
        true: "w-full",
      },
    },
    defaultVariants: {
      variant: "solid",
      size: "md",
    },
  },
)

type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
    loading?: boolean
  }

function Button({
  className,
  variant,
  size,
  pill,
  block,
  asChild = false,
  loading = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : "button"
  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, pill, block }), className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <>
          <span className="invisible flex items-center gap-[var(--button-gap-md)]">{children}</span>
          <span className="absolute inset-0 flex items-center justify-center">
            <LoadingIndicator size={14} strokeWidth={2} />
          </span>
        </>
      ) : children}
    </Comp>
  )
}

export { Button, buttonVariants }
