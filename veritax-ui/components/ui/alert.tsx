import { cn } from "@/lib/utils"

type AlertColor = "info" | "success" | "warning" | "caution" | "danger" | "discovery" | "default"

const colorMap: Record<AlertColor, { bg: string; border: string; text: string }> = {
  default:   { bg: "var(--color-background-primary-soft)",   border: "var(--color-border)",                text: "var(--color-text)" },
  info:      { bg: "var(--color-background-info-soft)",      border: "var(--color-border-info-surface)",   text: "var(--color-text-info-soft)" },
  success:   { bg: "var(--color-background-success-soft)",   border: "var(--color-border-success-surface)", text: "var(--color-text-success-soft)" },
  warning:   { bg: "var(--color-background-warning-soft)",   border: "var(--color-border-warning-surface)", text: "var(--color-text-warning-soft)" },
  caution:   { bg: "var(--color-background-caution-soft)",   border: "var(--color-border-caution-surface)", text: "var(--color-text-caution-soft)" },
  danger:    { bg: "var(--color-background-danger-soft)",    border: "var(--color-border-danger-surface)",  text: "var(--color-text-danger-soft)" },
  discovery: { bg: "var(--color-background-discovery-soft)", border: "var(--color-border-discovery-surface)", text: "var(--color-text-discovery-soft)" },
}

type AlertProps = React.ComponentProps<"div"> & {
  color?: AlertColor
  title?: React.ReactNode
  icon?: React.ReactNode
}

function Alert({ className, color = "default", title, icon, children, ...props }: AlertProps) {
  const c = colorMap[color]
  return (
    <div
      data-slot="alert"
      role="alert"
      className={cn(
        "flex gap-[var(--alert-gap)] rounded-[var(--alert-border-radius)]",
        "p-[var(--alert-gutter)] border",
        "text-[var(--alert-font-size)] leading-[var(--alert-line-height)]",
        className,
      )}
      style={{ background: c.bg, borderColor: c.border, color: c.text }}
      {...props}
    >
      {icon && <span className="mt-0.5 shrink-0">{icon}</span>}
      <div className="flex flex-col gap-1 min-w-0">
        {title && (
          <p className="font-[var(--alert-title-font-weight)] leading-snug">{title}</p>
        )}
        {children && <div className="opacity-90">{children}</div>}
      </div>
    </div>
  )
}

export { Alert }
