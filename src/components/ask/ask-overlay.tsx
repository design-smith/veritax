"use client";

import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { inferAskMode, type AskMode } from "./ask-mode";

const MODE_LABELS: Record<AskMode, string> = {
  ask: "ask",
  goto: "goto",
  run: "run",
  create: "create",
};

const MODE_COLORS: Record<AskMode, string> = {
  ask: "border-primary/30 bg-primary/5 text-primary",
  goto: "border-transparent bg-info-soft text-info-soft-foreground",
  run: "border-transparent bg-success-soft text-success-soft-foreground",
  create: "border-transparent bg-discovery-soft text-discovery-soft-foreground",
};

interface AskOverlayProps {
  open: boolean;
  onClose: () => void;
  initialQuery?: string;
  className?: string;
}

export function AskOverlay({ open, onClose, initialQuery = "", className }: AskOverlayProps) {
  const [query, setQuery] = useState(initialQuery);
  const inputRef = useRef<HTMLInputElement>(null);

  const { mode, payload } = inferAskMode(query, true);

  useEffect(() => {
    if (open) {
      setQuery(initialQuery);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open, initialQuery]);

  // Escape to close
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape" && open) onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-start justify-center pt-24",
        className,
      )}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-sdk-overlay" onClick={onClose} />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-2xl rounded-xl border border-border bg-background shadow-elevation-400 overflow-hidden">
        {/* Input row */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <Badge
            variant="outline"
            className={cn("shrink-0 text-xs font-medium", MODE_COLORS[mode])}
          >
            {MODE_LABELS[mode]}
          </Badge>
          <input
            ref={inputRef}
            type="text"
            role="textbox"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask anything · @go-to · >run · /create"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <kbd className="hidden text-xs text-muted-foreground sm:block">Esc</kbd>
        </div>

        {/* Results panel — content rendered by mode */}
        <div className="max-h-96 overflow-y-auto p-2">
          {!query.trim() && (
            <p className="py-6 text-center text-xs text-muted-foreground">
              Start typing to ask, search, or launch a stage
            </p>
          )}
          {/* Mode-specific results are composed by the parent using this as a shell */}
        </div>
      </div>
    </div>
  );
}
