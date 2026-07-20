import { cn } from "@/lib/utils"
import Link from "next/link"
import type { ComponentProps } from "react"

type TextLinkProps = {
  href?: string
  children: React.ReactNode
  primary?: boolean
  underline?: boolean
  external?: boolean
  className?: string
} & Omit<ComponentProps<"a">, "href">

function TextLink({ href, children, primary = false, underline, external, className, ...rest }: TextLinkProps) {
  const isExternal = external ?? (href ? /^https?:\/\//.test(href) : false)
  const showUnderline = underline ?? !primary

  const cls = cn(
    "inline-flex items-center gap-[var(--link-gap,0.125rem)]",
    "rounded-[var(--link-radius)] cursor-pointer",
    "transition-[opacity,color,text-decoration-color] duration-[var(--transition-duration-basic)]",
    "focus-visible:outline-2 focus-visible:outline-[var(--color-ring)] focus-visible:outline-offset-1",
    "hover:opacity-80",
    showUnderline && "underline [text-underline-offset:var(--link-underline-decoration-offset,0.1em)] [text-decoration-color:color-mix(in_oklab,currentcolor_70%,transparent)]",
    primary && "text-[var(--link-primary-text-color)] hover:!text-[var(--link-primary-text-color-hover)] hover:!opacity-100",
    className,
  )

  if (!href) return <span {...rest} className={cls} role="button">{children}</span>

  if (isExternal) return (
    <a {...rest} href={href} target="_blank" rel="noopener noreferrer" className={cls}>{children}</a>
  )

  return <Link {...(rest as ComponentProps<typeof Link>)} href={href} className={cls}>{children}</Link>
}

export { TextLink }
