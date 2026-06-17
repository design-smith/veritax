"use client";

import { useState } from "react";
import { format, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import type { User } from "@/lib/mock/types";
import { cn } from "@/lib/utils";

interface DelegatePayload {
  userId: string;
  expiresAt: string;
}

interface DelegationSettingsProps {
  users: User[];
  currentDelegateId: string | null;
  expiresAt: string | null;
  onSave: (payload: DelegatePayload) => void;
  className?: string;
}

export function DelegationSettings({
  users,
  currentDelegateId,
  expiresAt,
  onSave,
  className,
}: DelegationSettingsProps) {
  const [selectedUserId, setSelectedUserId] = useState(currentDelegateId ?? "");
  const [selectedExpiry, setSelectedExpiry] = useState(expiresAt ?? "");

  const currentDelegate = users.find((u) => u.id === currentDelegateId);

  function handleSave() {
    if (!selectedUserId) return;
    onSave({ userId: selectedUserId, expiresAt: selectedExpiry });
  }

  return (
    <div className={cn("space-y-5", className)}>
      {/* Current state */}
      <div className="rounded-lg border border-border bg-card p-4 space-y-1">
        <p className="text-xs font-medium text-muted-foreground">Current gate delegate</p>
        {currentDelegate ? (
          <div>
            <p className="text-sm font-semibold">{currentDelegate.name}</p>
            {expiresAt && (
              <p className="text-xs text-muted-foreground">
                Expires: {format(parseISO(expiresAt), "d MMM yyyy")}
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">None set — no delegate active</p>
        )}
      </div>

      <Separator />

      {/* Set delegate form */}
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="delegate-select">Gate delegate</Label>
          <select
            id="delegate-select"
            aria-label="Delegate"
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">— Select a user —</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="expiry-date">Expires on</Label>
          <Input
            id="expiry-date"
            type="date"
            value={selectedExpiry}
            onChange={(e) => setSelectedExpiry(e.target.value)}
          />
        </div>
        <Button onClick={handleSave} disabled={!selectedUserId}>
          Save delegation
        </Button>
      </div>
    </div>
  );
}
