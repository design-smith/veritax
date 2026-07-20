import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center font-[var(--badge-font-weight,600)] transition-colors",
  {
    variants: {
      variant: {
        solid:   "bg-[var(--color-background-primary-solid)] text-[var(--color-text-primary-solid)]",
        soft:    "bg-[var(--color-background-primary-soft)] text-[var(--color-text)]",
        outline: "border border-[var(--color-border-primary-outline)] text-[var(--color-text)]",
        info:     "bg-[var(--color-background-info-soft)] text-[var(--color-text-info-soft)]",
        success:  "bg-[var(--color-background-success-soft)] text-[var(--color-text-success-soft)]",
        warning:  "bg-[var(--color-background-warning-soft)] text-[var(--color-text-warning-soft)]",
        danger:   "bg-[var(--color-background-danger-soft)] text-[var(--color-text-danger-soft)]",
        discovery:"bg-[var(--color-background-discovery-soft)] text-[var(--color-text-discovery-soft)]",
        caution:  "bg-[var(--color-background-caution-soft)] text-[var(--color-text-caution-soft)]",
      },
      size: {
        sm: "h-[var(--badge-size-sm)] px-[var(--badge-gutter-sm)] text-[var(--badge-font-size-sm)] rounded-[var(--badge-radius-sm)]",
        md: "h-[var(--badge-size-md)] px-[var(--badge-gutter-md)] text-[var(--badge-font-size-md)] rounded-[var(--badge-radius-md)]",
        lg: "h-[var(--badge-size-lg)] px-[var(--badge-gutter-lg)] text-[var(--badge-font-size-lg)] rounded-[var(--badge-radius-lg)]",
      },
    },
    defaultVariants: { variant: "soft", size: "md" },
  },
)

type BadgeProps = React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>

function Badge({ className, variant, size, ...props }: BadgeProps) {
  return (
    <span
      data-slot="badge"
      className={cn(badgeVariants({ variant, size }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
