import { cn } from "@/lib/utils"

type InputVariant = "outline" | "soft"
type ControlSize = "sm" | "md" | "lg" | "xl" | "2xl" | "3xl"

const SIZE_H: Record<ControlSize, string> = {
  sm: "var(--control-size-sm)",   md:  "var(--control-size-md)",
  lg: "var(--control-size-lg)",   xl:  "var(--control-size-xl)",
  "2xl": "var(--control-size-2xl)", "3xl": "var(--control-size-3xl)",
}
const SIZE_PX: Record<ControlSize, string> = {
  sm: "var(--control-gutter-sm)", md:  "var(--control-gutter-md)",
  lg: "var(--control-gutter-md)", xl:  "var(--control-gutter-lg)",
  "2xl": "var(--control-gutter-xl)", "3xl": "var(--control-gutter-xl)",
}
const SIZE_FS: Record<ControlSize, string> = {
  sm: "var(--control-font-size-sm)", md:  "var(--control-font-size-md)",
  lg: "var(--control-font-size-md)", xl:  "var(--control-font-size-md)",
  "2xl": "var(--control-font-size-lg)", "3xl": "var(--control-font-size-lg)",
}
const SIZE_R: Record<ControlSize, string> = {
  sm: "var(--control-radius-sm)", md: "var(--control-radius-md)",
  lg: "var(--control-radius-md)", xl: "var(--control-radius-lg)",
  "2xl": "var(--control-radius-xl)", "3xl": "var(--control-radius-xl)",
}

type InputProps = React.ComponentProps<"input"> & {
  variant?: InputVariant
  controlSize?: ControlSize
  invalid?: boolean
}

function Input({
  className,
  variant = "outline",
  controlSize = "md",
  invalid,
  style,
  ...props
}: InputProps) {
  return (
    <input
      data-slot="input"
      data-invalid={invalid ? "" : undefined}
      className={cn(
        "w-full outline-none",
        "text-[var(--input-text-color)] placeholder:text-[var(--input-placeholder-text-color)]",
        "transition-[border-color,background-color] duration-[var(--transition-duration-basic)]",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        "focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-1",
        variant === "outline" && [
          "border border-[var(--input-outline-border-color)] bg-transparent",
          "hover:border-[var(--input-outline-border-color-hover)]",
          "focus:border-[var(--input-outline-border-color-focus)]",
        ],
        variant === "soft" && [
          "border border-transparent bg-[var(--input-soft-background-color)]",
          "focus:border-[var(--input-soft-border-color-focus)]",
        ],
        invalid && "border-[var(--input-border-color-invalid)]!",
        className,
      )}
      style={{
        height: SIZE_H[controlSize],
        paddingLeft: SIZE_PX[controlSize],
        paddingRight: SIZE_PX[controlSize],
        fontSize: SIZE_FS[controlSize],
        borderRadius: SIZE_R[controlSize],
        ...style,
      }}
      {...props}
    />
  )
}

export { Input }
