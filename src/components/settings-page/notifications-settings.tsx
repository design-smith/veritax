"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

type Cadence = "realtime" | "daily" | "weekly" | "never";

export interface NotificationCategory {
  id: string;
  label: string;
  cadence: Cadence;
}

interface NotificationsSettingsProps {
  categories: NotificationCategory[];
  onChange: (categoryId: string, cadence: Cadence) => void;
  className?: string;
}

const CADENCES: Cadence[] = ["realtime", "daily", "weekly", "never"];

export function NotificationsSettings({ categories, onChange, className }: NotificationsSettingsProps) {
  const [local, setLocal] = useState<Record<string, Cadence>>(
    Object.fromEntries(categories.map((c) => [c.id, c.cadence]))
  );

  function handleChange(id: string, cadence: Cadence) {
    setLocal((prev) => ({ ...prev, [id]: cadence }));
    onChange(id, cadence);
  }

  return (
    <div className={cn("divide-y divide-border rounded-lg border border-border", className)}>
      {categories.map((cat) => (
        <div key={cat.id} className="flex items-center justify-between px-4 py-3 bg-card">
          <p className="text-sm font-medium">{cat.label}</p>
          <select
            value={local[cat.id] ?? cat.cadence}
            onChange={(e) => handleChange(cat.id, e.target.value as Cadence)}
            className="rounded-md border border-input bg-background px-2 py-1 text-sm"
          >
            {CADENCES.map((c) => (
              <option key={c} value={c} className="capitalize">{c}</option>
            ))}
          </select>
        </div>
      ))}
    </div>
  );
}
