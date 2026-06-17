"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { User } from "@/lib/mock/types";
import { cn } from "@/lib/utils";

type CreateType = "data-request" | "commitment" | "note";

export interface CreatePayload {
  type: CreateType;
  text: string;
  dueDate?: string;
  ownerId?: string;
}

interface CreateModePanelProps {
  users: User[];
  onSubmit: (payload: CreatePayload) => void;
  className?: string;
}

export function CreateModePanel({ users, onSubmit, className }: CreateModePanelProps) {
  const [selectedType, setSelectedType] = useState<CreateType | null>(null);
  const [text, setText] = useState("");
  const [dueDate, setDueDate] = useState("");

  function handleSubmit() {
    if (!selectedType || !text.trim()) return;
    onSubmit({ type: selectedType, text: text.trim(), dueDate: dueDate || undefined });
    setText("");
    setDueDate("");
    setSelectedType(null);
  }

  return (
    <div className={cn("space-y-4 p-2", className)}>
      {/* Type selector */}
      <div className="flex gap-2">
        {(["data-request", "commitment", "note"] as CreateType[]).map((type) => (
          <Button
            key={type}
            size="sm"
            variant={selectedType === type ? "default" : "outline"}
            className="capitalize"
            onClick={() => { setSelectedType(type); setText(""); setDueDate(""); }}
          >
            {type === "data-request" ? "Data Request" : type.charAt(0).toUpperCase() + type.slice(1)}
          </Button>
        ))}
      </div>

      {/* Form based on type */}
      {selectedType === "data-request" && (
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="dr-desc">Description</Label>
            <Textarea
              id="dr-desc"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="What data is needed and why..."
              rows={3}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="dr-due">Due date</Label>
            <Input id="dr-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
        </div>
      )}

      {selectedType === "commitment" && (
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="cm-text">Commitment text</Label>
            <Textarea
              id="cm-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Describe the commitment..."
              rows={3}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="cm-due">Due date</Label>
            <Input id="cm-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
        </div>
      )}

      {selectedType === "note" && (
        <div className="space-y-1">
          <Label htmlFor="note-text">Note</Label>
          <Textarea
            id="note-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Add a note..."
            rows={4}
          />
        </div>
      )}

      {selectedType && (
        <Button
          className="w-full"
          disabled={!text.trim()}
          onClick={handleSubmit}
        >
          Create
        </Button>
      )}
    </div>
  );
}
