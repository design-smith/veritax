import { Badge } from "@/components/ui/badge";
import type { User } from "@/lib/mock/types";
import { cn } from "@/lib/utils";

const ROLE_COLORS: Record<User["role"], string> = {
  vp:       "border-transparent bg-discovery-soft text-discovery-soft-foreground",
  manager:  "border-transparent bg-info-soft text-info-soft-foreground",
  analyst:  "border-transparent bg-success-soft text-success-soft-foreground",
  adjacent: "border-border bg-surface-secondary text-muted-foreground",
  admin:    "border-transparent bg-danger-soft text-danger-soft-foreground",
};

interface MembersTableProps {
  members: User[];
  className?: string;
}

export function MembersTable({ members, className }: MembersTableProps) {
  return (
    <div className={cn("rounded-lg border border-border overflow-hidden", className)}>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/30">
            {["Name", "Email", "Role"].map((h) => (
              <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {members.map((member) => (
            <tr key={member.id} className="bg-card">
              <td className="px-4 py-3 font-medium">{member.name}</td>
              <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{member.email}</td>
              <td className="px-4 py-3">
                <Badge variant="outline" className={cn("text-xs capitalize", ROLE_COLORS[member.role])}>
                  {member.role}
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
