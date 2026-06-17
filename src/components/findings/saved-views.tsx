"use client";

import { useCallback, useState } from "react";
import { BookmarkPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

export interface SavedView {
  id: string;
  label: string;
  filters: Record<string, unknown>;
}

interface SavedViewsBarProps {
  currentViewId: string;
  views: SavedView[];
  onSwitchView: (viewId: string) => void;
  onSaveView: (view: Omit<SavedView, "id"> & { id?: string }) => void;
  className?: string;
}

export function SavedViewsBar({
  currentViewId,
  views,
  onSwitchView,
  onSaveView,
  className,
}: SavedViewsBarProps) {
  const [saveOpen, setSaveOpen] = useState(false);
  const [viewName, setViewName] = useState("");

  function handleSave() {
    if (!viewName.trim()) return;
    const current = views.find((v) => v.id === currentViewId);
    onSaveView({ label: viewName.trim(), filters: current?.filters ?? {} });
    setViewName("");
    setSaveOpen(false);
  }

  return (
    <div className={cn("flex items-center gap-1 flex-wrap", className)}>
      {views.map((view) => (
        <Button
          key={view.id}
          variant="ghost"
          size="sm"
          aria-pressed={view.id === currentViewId}
          onClick={() => onSwitchView(view.id)}
          className={cn(
            "h-7 px-3 text-xs",
            view.id === currentViewId
              ? "bg-muted font-medium text-foreground"
              : "text-muted-foreground",
          )}
        >
          {view.label}
        </Button>
      ))}

      <Separator orientation="vertical" className="h-4 mx-1" />

      <Popover open={saveOpen} onOpenChange={setSaveOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="h-7 gap-1.5 px-2.5 text-xs text-muted-foreground">
            <BookmarkPlus className="h-3.5 w-3.5" />
            Save view
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-3" align="start">
          <div className="space-y-2">
            <p className="text-xs font-medium">Save current view</p>
            <Input
              value={viewName}
              onChange={(e) => setViewName(e.target.value)}
              placeholder="View name…"
              className="h-8 text-sm"
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSave} disabled={!viewName.trim()} className="flex-1">
                Save
              </Button>
              <Button size="sm" variant="outline" onClick={() => setSaveOpen(false)} className="flex-1">
                Cancel
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

// Hook: manage saved views in localStorage
const STORAGE_KEY = "veritax:saved-views:findings";

export function useSavedViews(defaults: SavedView[]) {
  const load = useCallback((): SavedView[] => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? [...defaults, ...JSON.parse(raw)] : defaults;
    } catch {
      return defaults;
    }
  }, [defaults]);

  const [views, setViews] = useState<SavedView[]>(load);

  function saveView(view: Omit<SavedView, "id"> & { id?: string }) {
    const next: SavedView = { ...view, id: view.id ?? `view-${Date.now()}` };
    const updated = [...views, next];
    setViews(updated);
    const persisted = updated.filter((v) => !defaults.some((d) => d.id === v.id));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
  }

  function deleteView(viewId: string) {
    const updated = views.filter((v) => v.id !== viewId);
    setViews(updated);
    const persisted = updated.filter((v) => !defaults.some((d) => d.id === v.id));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
  }

  return { views, saveView, deleteView };
}
