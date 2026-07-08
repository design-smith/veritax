"use client";

import * as React from "react";
import { Check, Copy } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import {
  createCanonicalUrl,
  type CanonicalTarget,
} from "@/lib/navigation/canonical-link";
import { cn } from "@/lib/utils";

interface CopyLinkButtonProps
  extends Omit<ButtonProps, "children" | "onClick" | "aria-label"> {
  target?: CanonicalTarget;
  href?: string;
  origin?: string;
  label?: string;
  copiedLabel?: string;
  onCopied?: (href: string) => void;
}

export function CopyLinkButton({
  target,
  href,
  origin,
  label = "Copy link",
  copiedLabel = "Copied",
  className,
  size = "icon-sm",
  variant = "ghost",
  onCopied,
  ...buttonProps
}: CopyLinkButtonProps) {
  const [state, setState] = React.useState<"idle" | "copied" | "failed">("idle");
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  async function copy() {
    const value = resolveHref({ target, href, origin });

    try {
      await navigator.clipboard.writeText(value);
      setState("copied");
      onCopied?.(value);
    } catch {
      setState("failed");
    }

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => setState("idle"), 1500);
  }

  const copied = state === "copied";

  return (
    <Button
      {...buttonProps}
      type="button"
      size={size}
      variant={variant}
      className={cn("relative", className)}
      aria-label={label}
      onClick={copy}
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      <span aria-live="polite" className="sr-only">
        {state === "copied" ? copiedLabel : state === "failed" ? "Copy failed" : label}
      </span>
    </Button>
  );
}

function resolveHref({
  target,
  href,
  origin,
}: {
  target?: CanonicalTarget;
  href?: string;
  origin?: string;
}) {
  if (!target && !href) {
    throw new Error("CopyLinkButton requires a canonical target or href.");
  }

  const resolvedOrigin =
    origin ?? (typeof window !== "undefined" ? window.location.origin : "https://app.veritax.local");

  if (target) {
    return createCanonicalUrl(target, resolvedOrigin);
  }

  if (href) {
    return new URL(href, resolvedOrigin).toString();
  }

  throw new Error("CopyLinkButton requires a canonical target or href.");
}
