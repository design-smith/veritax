import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface TwoPaneSurfaceProps {
  title: string;
  description?: string;
  action?: ReactNode;
  list: ReactNode;
  canvas: ReactNode;
  inspector?: ReactNode;
  className?: string;
  listLabel?: string;
  canvasLabel?: string;
  inspectorLabel?: string;
}

export function TwoPaneSurface({
  title,
  description,
  action,
  list,
  canvas,
  inspector,
  className,
  listLabel = "List",
  canvasLabel = "Canvas",
  inspectorLabel = "Inspector",
}: TwoPaneSurfaceProps) {
  return (
    <section className={cn("flex h-full min-h-0 flex-col overflow-hidden bg-background", className)}>
      <header className="flex shrink-0 items-start justify-between gap-4 border-b border-border px-5 py-4">
        <div className="min-w-0 space-y-1">
          <h1 className="truncate text-lg font-semibold text-foreground">{title}</h1>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 tablet:grid-cols-[280px_minmax(0,1fr)] desktop:grid-cols-[300px_minmax(0,1fr)_360px]">
        <aside
          aria-label={listLabel}
          role="region"
          className="min-h-0 overflow-auto border-b border-border bg-surface tablet:border-b-0 tablet:border-r"
        >
          {list}
        </aside>

        <main
          aria-label={canvasLabel}
          role="region"
          className="min-h-0 overflow-auto bg-background"
        >
          {canvas}
        </main>

        <aside
          aria-label={inspectorLabel}
          role="region"
          className="min-h-0 overflow-auto border-t border-border bg-surface desktop:border-l desktop:border-t-0"
        >
          {inspector ?? (
            <div className="flex h-full min-h-40 items-center justify-center p-6 text-center text-sm text-muted-foreground">
              Select a record to inspect.
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
