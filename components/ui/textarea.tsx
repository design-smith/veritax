import { cn } from "@/lib/utils"

type TextareaProps = React.ComponentProps<"textarea"> & {
  variant?: "outline" | "soft"
  invalid?: boolean
}

function Textarea({ className, variant = "outline", invalid, ...props }: TextareaProps) {
  return (
    <textarea
      data-slot="textarea"
      data-invalid={invalid ? "" : undefined}
      className={cn(
        "w-full min-h-[5rem] px-[var(--control-gutter-md)] py-[0.5rem]",
        "rounded-[var(--control-radius-md)] outline-none resize-y",
        "text-[var(--font-text-sm-size)] text-[var(--input-text-color)]",
        "placeholder:text-[var(--input-placeholder-text-color)]",
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
        invalid && "!border-[var(--input-border-color-invalid)]",
        className,
      )}
      {...props}
    />
  )
}

export { Textarea }
