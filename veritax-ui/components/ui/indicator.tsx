import { cn } from "@/lib/utils"

/** Three animated dots — OAI LoadingDots */
function LoadingDots({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex items-center justify-start gap-1",
        "h-[var(--font-text-md-line-height,1.5rem)]",
        className,
      )}
      {...props}
    >
      {[0, 200, 400].map((delay) => (
        <span
          key={delay}
          className="block size-2 rounded-full bg-current"
          style={{ animation: `oai-pulse 1s ${delay}ms infinite both` }}
        />
      ))}
    </div>
  )
}

/** Circular spinner — OAI LoadingIndicator */
function LoadingIndicator({
  className,
  size = "1em",
  strokeWidth = 2,
  style,
  ...props
}: React.ComponentProps<"span"> & { size?: number | string; strokeWidth?: number }) {
  const sz = typeof size === "number" ? `${size}px` : size
  return (
    <span
      className={cn("inline-block", className)}
      style={{
        width: sz, height: sz,
        borderRadius: "9999px",
        border: `${strokeWidth}px solid var(--alpha-20)`,
        borderTopColor: "currentcolor",
        animation: "oai-spin 0.65s linear infinite",
        ...style,
      }}
      {...props}
    />
  )
}

export { LoadingDots, LoadingIndicator }
