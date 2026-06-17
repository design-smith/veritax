"use client";

import { useState } from "react";
import { format, parseISO } from "date-fns";
import { Check, ChevronDown } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import type { User } from "@/lib/mock/types";

export interface Comment {
  id: string;
  authorId: string;
  authorName: string;
  text: string;
  timestamp: string;
  resolved?: boolean;
}

interface AddPayload {
  text: string;
  mentions: string[];
}

interface CommentThreadProps {
  objectRef: string;
  comments: Comment[];
  users: User[];
  onAdd: (payload: AddPayload) => void;
  onResolve: (commentId: string) => void;
  onUnresolve: (commentId: string) => void;
}

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).join("").toUpperCase().slice(0, 2);
}

function extractMentions(text: string): string[] {
  return (text.match(/@\w+/g) ?? []).map((m) => m.slice(1));
}

export function CommentThread({
  comments,
  users,
  onAdd,
  onResolve,
  onUnresolve,
}: CommentThreadProps) {
  const [draft, setDraft] = useState("");
  const [showResolved, setShowResolved] = useState(false);

  const resolved = comments.filter((c) => c.resolved);
  const open = comments.filter((c) => !c.resolved);

  function handlePost() {
    if (!draft.trim()) return;
    onAdd({ text: draft.trim(), mentions: extractMentions(draft) });
    setDraft("");
  }

  return (
    <div className="space-y-3">
      {/* Open comments */}
      {open.map((comment, i) => (
        <div key={comment.id}>
          {i > 0 && <Separator />}
          <div className="flex gap-2.5 pt-2">
            <Avatar className="h-7 w-7 shrink-0">
              <AvatarFallback className="text-[10px]">{initials(comment.authorName)}</AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium">{comment.authorName}</span>
                <span className="text-[11px] text-muted-foreground">
                  {format(parseISO(comment.timestamp), "MMM d, HH:mm")}
                </span>
              </div>
              <p className="text-sm text-foreground">{comment.text}</p>
              <button
                onClick={() => onResolve(comment.id)}
                className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                aria-label="Resolve comment"
              >
                <Check className="h-3 w-3" />
                Resolve
              </button>
            </div>
          </div>
        </div>
      ))}

      {/* Resolved summary (collapsed) */}
      {resolved.length > 0 && (
        <div>
          <button
            onClick={() => setShowResolved((s) => !s)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ChevronDown className={`h-3 w-3 transition-transform ${showResolved ? "rotate-180" : ""}`} />
            {resolved.length} resolved thread{resolved.length !== 1 ? "s" : ""}
          </button>
          {showResolved && (
            <div className="mt-2 space-y-2 rounded-md border border-border bg-muted/30 p-2">
              {resolved.map((comment) => (
                <div key={comment.id} className="flex gap-2">
                  <Avatar className="h-5 w-5 shrink-0 opacity-60">
                    <AvatarFallback className="text-[8px]">{initials(comment.authorName)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <span className="text-xs font-medium text-muted-foreground">{comment.authorName}</span>
                    <p className="text-xs text-muted-foreground">{comment.text}</p>
                    <button
                      onClick={() => onUnresolve(comment.id)}
                      className="text-[11px] text-primary hover:underline"
                    >
                      Unresolve
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* New comment input */}
      <Separator />
      <div className="space-y-2">
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add a comment… use @name to mention"
          rows={2}
          className="text-sm"
        />
        <Button size="sm" onClick={handlePost} disabled={!draft.trim()}>
          Post
        </Button>
      </div>
    </div>
  );
}
