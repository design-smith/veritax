"use client";

import { useState } from "react";
import { format, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

export interface HoursEntry {
  id: string;
  docId: string;
  docName: string;
  hours: number;
  date: string;
}

interface AddEntryPayload {
  hours: number;
  date: string;
  docName?: string;
}

interface HoursLogProps {
  entries: HoursEntry[];
  onAddEntry: (payload: AddEntryPayload) => void;
  className?: string;
}

export function HoursLog({ entries, onAddEntry, className }: HoursLogProps) {
  const [hoursInput, setHoursInput] = useState("");
  const [dateInput, setDateInput] = useState(new Date().toISOString().split("T")[0]);

  const totalHours = entries.reduce((sum, e) => sum + e.hours, 0);

  function handleAdd() {
    const h = parseFloat(hoursInput);
    if (isNaN(h) || h <= 0) return;
    onAddEntry({ hours: h, date: dateInput });
    setHoursInput("");
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Summary */}
      <div className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3">
        <p className="text-sm font-medium">Total hours logged</p>
        <p className="text-xl font-bold">{totalHours.toFixed(1)}h</p>
      </div>

      {/* Entries */}
      <div className="space-y-1.5">
        {entries.map((entry) => (
          <div key={entry.id} className="flex items-center justify-between px-3 py-2 rounded-md border border-border bg-card text-sm">
            <div className="min-w-0">
              <p className="font-medium truncate">{entry.docName}</p>
              <p className="text-xs text-muted-foreground">{format(parseISO(entry.date), "d MMM yyyy")}</p>
            </div>
            <span className="font-semibold shrink-0 ml-4">{entry.hours.toFixed(1)}h</span>
          </div>
        ))}
      </div>

      <Separator />

      {/* Manual entry form */}
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Log hours manually</p>
        <div className="grid gap-3 tablet:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="hours-input">Hours</Label>
            <Input
              id="hours-input"
              type="number"
              step="0.5"
              min="0.5"
              value={hoursInput}
              onChange={(e) => setHoursInput(e.target.value)}
              placeholder="e.g. 2.5"
              aria-label="Hours"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="date-input">Date</Label>
            <Input
              id="date-input"
              type="date"
              value={dateInput}
              onChange={(e) => setDateInput(e.target.value)}
            />
          </div>
        </div>
        <Button
          onClick={handleAdd}
          disabled={!hoursInput || parseFloat(hoursInput) <= 0}
          className="w-full"
        >
          Log hours
        </Button>
      </div>
    </div>
  );
}
