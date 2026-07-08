"use client";

import { useState } from "react";
import { Lock, Plus, UserMinus } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { User } from "@/lib/mock/types";
import { cn } from "@/lib/utils";

type SensitivityTier = "sensitive" | "privileged";

interface SensitivityAccessManagerProps {
  tier: SensitivityTier;
  namedUsers: User[];
  allUsers: User[];
  onAdd: (userId: string) => void;
  onRemove: (userId: string) => void;
  className?: string;
}

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).join("").toUpperCase().slice(0, 2);
}

export function SensitivityAccessManager({
  tier,
  namedUsers,
  allUsers,
  onAdd,
  onRemove,
  className,
}: SensitivityAccessManagerProps) {
  const [selectedUserId, setSelectedUserId] = useState("");

  const namedIds = new Set(namedUsers.map((u) => u.id));
  const eligible = allUsers.filter((u) => !namedIds.has(u.id));

  function handleAdd() {
    if (!selectedUserId) return;
    onAdd(selectedUserId);
    setSelectedUserId("");
  }

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center gap-2">
        <Lock className="h-4 w-4 text-warning-soft-foreground" />
        <p className="text-sm font-medium capitalize">{tier}-tier named access</p>
        <Badge variant="outline" className="text-[10px] border-transparent bg-warning-soft text-warning-soft-foreground capitalize">
          {tier}
        </Badge>
      </div>

      {/* Current access list */}
      <div className="rounded-lg border border-border divide-y divide-border">
        {namedUsers.map((user) => (
          <div key={user.id} className="flex items-center justify-between px-4 py-2.5 bg-card">
            <div className="flex items-center gap-2.5">
              <Avatar className="h-7 w-7">
                <AvatarFallback className="text-[10px]">{initials(user.name)}</AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-medium">{user.name}</p>
                <p className="text-xs text-muted-foreground capitalize">{user.role}</p>
              </div>
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-danger-soft-foreground"
              aria-label={`Remove ${user.name}`}
              onClick={() => onRemove(user.id)}
            >
              <UserMinus className="h-3.5 w-3.5" />
              Remove
            </Button>
          </div>
        ))}
        {namedUsers.length === 0 && (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">No named users — tier access blocked for everyone.</p>
        )}
      </div>

      <Separator />

      {/* Add user */}
      <div className="flex gap-2">
        <select
          value={selectedUserId}
          onChange={(e) => setSelectedUserId(e.target.value)}
          className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="">— Select user to add —</option>
          {eligible.map((u) => (
            <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
          ))}
        </select>
        <Button onClick={handleAdd} disabled={!selectedUserId} className="gap-1.5">
          <Plus className="h-4 w-4" />
          Add
        </Button>
      </div>
    </div>
  );
}
