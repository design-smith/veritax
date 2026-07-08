"use client";

import { useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import type { User } from "@/lib/mock/types";

interface AssignPayload {
  userId: string;
  dueDate?: string;
  note?: string;
}

interface AssignControlProps {
  open: boolean;
  users: User[];
  objectScope: string;
  currentAssigneeId?: string;
  onAssign: (payload: AssignPayload) => void;
  onUnassign?: () => void;
  onClose: () => void;
}

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).join("").toUpperCase().slice(0, 2);
}

export function AssignControl({
  open,
  users,
  objectScope,
  currentAssigneeId,
  onAssign,
  onUnassign,
  onClose,
}: AssignControlProps) {
  const [selectedUserId, setSelectedUserId] = useState(currentAssigneeId ?? "");
  const [dueDate, setDueDate] = useState("");
  const [note, setNote] = useState("");
  const [pendingConfirmation, setPendingConfirmation] = useState<"assign" | "unassign" | null>(null);

  const selectedUser = users.find((u) => u.id === selectedUserId);

  function handleAssign() {
    if (!selectedUserId) return;
    setPendingConfirmation("assign");
  }

  function confirmAssign() {
    if (!selectedUserId) return;
    onAssign({ userId: selectedUserId, dueDate: dueDate || undefined, note: note || undefined });
    setPendingConfirmation(null);
  }

  function handleUnassign() {
    setPendingConfirmation("unassign");
  }

  function confirmUnassign() {
    onUnassign?.();
    setPendingConfirmation(null);
  }

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="flex w-96 flex-col">
        <SheetHeader>
          <SheetTitle>Assign</SheetTitle>
          <SheetDescription>
            Assign work and confirm the resulting access change.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-4 overflow-y-auto py-2">
          <RadioGroup value={selectedUserId} onValueChange={setSelectedUserId}>
            {users.map((user) => (
              <div
                key={user.id}
                className="flex cursor-pointer items-center gap-3 rounded-md border p-2.5 transition-colors hover:bg-muted"
              >
                <RadioGroupItem value={user.id} id={`user-${user.id}`} />
                <Label htmlFor={`user-${user.id}`} className="flex cursor-pointer items-center gap-2 font-normal">
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className="text-[10px]">{initials(user.name)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium">{user.name}</p>
                    <p className="text-xs capitalize text-muted-foreground">{user.role}</p>
                  </div>
                </Label>
              </div>
            ))}
          </RadioGroup>

          <Separator />

          <div className="space-y-2">
            <Label htmlFor="due-date" className="text-xs">Due date (optional)</Label>
            <Input
              id="due-date"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="h-8 text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="note" className="text-xs">Note (optional)</Label>
            <Textarea
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add a note..."
              rows={2}
              className="text-sm"
            />
          </div>

          <div className="rounded-md border border-border bg-muted/40 p-2.5 text-xs text-muted-foreground">
            Grants{" "}
            <span className="font-medium text-foreground">
              {selectedUser ? selectedUser.name : "[select an assignee]"}
            </span>
            {": "}
            <span className="font-medium text-foreground">{objectScope}</span>{" "}
            (read), proposal rights.
          </div>

          {pendingConfirmation === "assign" && (
            <div className="rounded-md border border-primary/25 bg-primary/5 p-2.5 text-xs text-muted-foreground">
              <p className="font-medium text-foreground">Confirm access grant</p>
              <p>
                Assigning this item grants{" "}
                <span className="font-medium text-foreground">
                  {selectedUser?.name ?? "the selected assignee"}
                </span>{" "}
                read access and proposal rights for{" "}
                <span className="font-medium text-foreground">{objectScope}</span>.
              </p>
            </div>
          )}

          {pendingConfirmation === "unassign" && (
            <div className="rounded-md border border-destructive/25 bg-destructive/5 p-2.5 text-xs text-muted-foreground">
              <p className="font-medium text-foreground">Confirm access revoke</p>
              <p>
                Unassigning revokes delegated access to{" "}
                <span className="font-medium text-foreground">{objectScope}</span>{" "}
                after confirmation.
              </p>
            </div>
          )}
        </div>

        <SheetFooter className="flex-col gap-2 sm:flex-col">
          {pendingConfirmation === "assign" ? (
            <>
              <Button onClick={confirmAssign} disabled={!selectedUserId} className="w-full">
                Confirm assignment
              </Button>
              <Button variant="outline" onClick={() => setPendingConfirmation(null)} className="w-full">
                Back
              </Button>
            </>
          ) : pendingConfirmation === "unassign" ? (
            <>
              <Button variant="destructive" onClick={confirmUnassign} className="w-full">
                Confirm unassign
              </Button>
              <Button variant="outline" onClick={() => setPendingConfirmation(null)} className="w-full">
                Back
              </Button>
            </>
          ) : (
            <>
              <Button onClick={handleAssign} disabled={!selectedUserId} className="w-full">
                Assign
              </Button>
              {onUnassign && currentAssigneeId && (
                <Button variant="outline" onClick={handleUnassign} className="w-full">
                  Unassign
                </Button>
              )}
            </>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
