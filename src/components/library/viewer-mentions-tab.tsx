import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type MentionObjectType = "finding" | "run" | "commitment" | "document";

export interface DocumentMention {
  id: string;
  objectType: MentionObjectType;
  objectId: string;
  objectTitle: string;
  href: string;
}

const TYPE_STYLES: Record<MentionObjectType, string> = {
  finding: "border-transparent bg-danger-soft text-danger-soft-foreground",
  run: "border-transparent bg-info-soft text-info-soft-foreground",
  commitment: "border-transparent bg-warning-soft text-warning-soft-foreground",
  document: "border-border text-muted-foreground",
};

interface ViewerMentionsTabProps {
  mentions: DocumentMention[];
  className?: string;
}

export function ViewerMentionsTab({ mentions, className }: ViewerMentionsTabProps) {
  if (mentions.length === 0) {
    return (
      <p className={cn("py-8 text-center text-xs text-muted-foreground", className)}>
        No objects cite this document yet.
      </p>
    );
  }

  return (
    <div className={cn("space-y-1 py-2", className)}>
      {mentions.map((m) => (
        <Link
          key={m.id}
          href={m.href}
          className="flex items-start gap-2 rounded-md px-2 py-2 transition-colors hover:bg-muted"
        >
          <Badge
            variant="outline"
            className={cn("mt-0.5 shrink-0 text-[10px]", TYPE_STYLES[m.objectType])}
          >
            {m.objectType}
          </Badge>
          <span className="text-xs text-foreground leading-relaxed">{m.objectTitle}</span>
        </Link>
      ))}
    </div>
  );
}
