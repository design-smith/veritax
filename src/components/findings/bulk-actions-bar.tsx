"use client";

import { useState } from "react";
import { Download, Star, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import type { Finding } from "@/lib/mock/types";
import { cn } from "@/lib/utils";

interface BulkActionsBarProps {
  selected: Finding[];
  onAssign: (findings: Finding[]) => void;
  onWatch: (findings: Finding[]) => void;
  onExportList: (findings: Finding[]) => void;
  onMoveToTriage: (findings: Finding[], reason: string) => void;
  className?: string;
}

export function BulkActionsBar({
  selected,
  onAssign,
  onWatch,
  onExportList,
  onMoveToTriage,
  className,
}: BulkActionsBarProps) {
  const [triageOpen, setTriageOpen] = useState(false);
  const [triageReason, setTriageReason] = useState("");

  function handleConfirmTriage() {
    if (!triageReason.trim()) return;
    onMoveToTriage(selected, triageReason.trim());
    setTriageOpen(false);
    setTriageReason("");
  }

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-2.5",
        className,
      )}
    >
      <span className="text-sm font-medium">{selected.length} selected</span>

      <Separator orientation="vertical" className="h-5" />

      <Button
        size="sm"
        variant="ghost"
        className="h-7 gap-1.5 px-2.5 text-xs"
        onClick={() => onAssign(selected)}
      >
        <UserPlus className="h-3.5 w-3.5" />
        Assign
      </Button>

      <Button
        size="sm"
        variant="ghost"
        className="h-7 gap-1.5 px-2.5 text-xs"
        onClick={() => onWatch(selected)}
      >
        <Star className="h-3.5 w-3.5" />
        Watch
      </Button>

      <Button
        size="sm"
        variant="ghost"
        className="h-7 gap-1.5 px-2.5 text-xs"
        onClick={() => onExportList(selected)}
      >
        <Download className="h-3.5 w-3.5" />
        Export list
      </Button>

      <Separator orientation="vertical" className="h-5" />

      <Popover open={triageOpen} onOpenChange={setTriageOpen}>
        <PopoverTrigger asChild>
          <Button size="sm" variant="ghost" className="h-7 px-2.5 text-xs text-amber-600 hover:text-amber-700">
            Move to triage
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-3" align="start">
          <div className="space-y-2">
            <p className="text-xs font-medium">Reason for moving to triage</p>
            <Input
              value={triageReason}
              onChange={(e) => setTriageReason(e.target.value)}
              placeholder="Reason…"
              className="h-8 text-sm"
              onKeyDown={(e) => e.key === "Enter" && handleConfirmTriage()}
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={!triageReason.trim()}
                onClick={handleConfirmTriage}
                className="flex-1"
              >
                Confirm
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => { setTriageOpen(false); setTriageReason(""); }}
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* No bulk dismiss — intentionally omitted per PRD */}
    </div>
  );
}
