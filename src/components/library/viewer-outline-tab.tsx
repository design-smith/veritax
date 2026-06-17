import { cn } from "@/lib/utils";

export interface OutlineSection {
  id: string;
  title: string;
  level: number;
}

interface ViewerOutlineTabProps {
  sections: OutlineSection[];
  onSectionClick: (sectionId: string) => void;
  activeSectionId?: string;
}

const INDENT: Record<number, string> = { 1: "pl-2", 2: "pl-6", 3: "pl-10" };

export function ViewerOutlineTab({ sections, onSectionClick, activeSectionId }: ViewerOutlineTabProps) {
  return (
    <div className="space-y-0.5 py-2">
      {sections.map((s) => (
        <button
          key={s.id}
          onClick={() => onSectionClick(s.id)}
          className={cn(
            "w-full rounded-sm py-1 text-left text-xs transition-colors hover:bg-muted",
            INDENT[s.level] ?? "pl-2",
            activeSectionId === s.id ? "font-semibold text-foreground" : "text-muted-foreground",
          )}
        >
          {s.title}
        </button>
      ))}
    </div>
  );
}
