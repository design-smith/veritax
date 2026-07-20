import { cn } from "@/lib/utils"

type AvatarProps = React.ComponentProps<"span"> & {
  src?: string
  alt?: string
  size?: number | string
  fallback?: React.ReactNode
}

function Avatar({ className, src, alt = "", size = "var(--avatar-size)", fallback, style, ...props }: AvatarProps) {
  const sz = typeof size === "number" ? `${size}px` : size
  return (
    <span
      data-slot="avatar"
      className={cn(
        "relative inline-flex items-center justify-center shrink-0 overflow-hidden select-none",
        "rounded-[var(--avatar-radius)] bg-[var(--color-background-primary-soft)]",
        "text-[var(--color-text-secondary)] font-[var(--font-weight-medium)]",
        className,
      )}
      style={{ width: sz, height: sz, fontSize: `calc(${sz} * var(--avatar-font-size-scaling, 0.5))`, ...style }}
      {...props}
    >
      {src ? (
        <img
          src={src}
          alt={alt}
          className="size-full object-cover"
          style={{ border: `var(--hairline) solid var(--avatar-image-border-color)`, borderRadius: "inherit" }}
        />
      ) : (
        <span aria-hidden="true">{fallback}</span>
      )}
    </span>
  )
}

function AvatarGroup({ className, children, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="avatar-group"
      className={cn("flex items-center", className)}
      style={{ gap: "var(--avatar-group-spacing)" }}
      {...props}
    >
      {children}
    </div>
  )
}

export { Avatar, AvatarGroup }
