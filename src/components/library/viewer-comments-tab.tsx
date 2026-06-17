"use client";

import { CommentThread } from "@/components/patterns/pat-12-comments";
import type { Comment } from "@/components/patterns/pat-12-comments";
import type { User } from "@/lib/mock/types";

interface ViewerCommentsTabProps {
  comments: Comment[];
  users: User[];
  objectRef: string;
  onAdd: (payload: { text: string; mentions: string[] }) => void;
  onResolve: (commentId: string) => void;
  onUnresolve: (commentId: string) => void;
}

export function ViewerCommentsTab({
  comments,
  users,
  objectRef,
  onAdd,
  onResolve,
  onUnresolve,
}: ViewerCommentsTabProps) {
  return (
    <div className="py-2">
      <CommentThread
        objectRef={objectRef}
        comments={comments}
        users={users}
        onAdd={onAdd}
        onResolve={onResolve}
        onUnresolve={onUnresolve}
      />
    </div>
  );
}
