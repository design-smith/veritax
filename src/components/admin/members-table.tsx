import { Badge } from "@/components/ui/badge";
import type { User } from "@/lib/mock/types";
import { cn } from "@/lib/utils";

const ROLE_COLORS: Record<User["role"], string> = {
  vp:       "border-purple-300 bg-purple-50 text-purple-700",
  manager:  "border-blue-300 bg-blue-50 text-blue-700",
  analyst:  "border-green-300 bg-green-50 text-green-700",
  adjacent: "border-slate-300 bg-slate-50 text-slate-700",
  admin:    "border-red-300 bg-red-50 text-red-700",
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
