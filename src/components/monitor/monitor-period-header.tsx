import { Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface MonitorPeriodHeaderProps {
  fiscalYear: string;
  quarter: string;
  daysToClose: number;
  checklistTotal: number;
  checklistDone: number;
  className?: string;
}

export function MonitorPeriodHeader({
  fiscalYear,
  quarter,
  daysToClose,
  checklistTotal,
  checklistDone,
  className,
}: MonitorPeriodHeaderProps) {
  const checklistPercent = checklistTotal > 0
    ? Math.round((checklistDone / checklistTotal) * 100)
    : 0;

  return (
    <div className={cn("flex flex-wrap items-center gap-6 rounded-lg border border-border bg-card px-5 py-4", className)}>
      {/* FY + Quarter */}
      <div className="flex items-center gap-2">
        <p className="text-2xl font-bold">{fiscalYear}</p>
        <Badge variant="secondary" className="text-sm">{quarter}</Badge>
      </div>

      {/* Days to close */}
      <div className="flex items-center gap-2">
        <Clock className="h-4 w-4 text-muted-foreground" />
        <div>
          <p className="text-xl font-semibold">{daysToClose}</p>
          <p className="text-xs text-muted-foreground">days to close</p>
        </div>
      </div>

      {/* Checklist progress */}
      <div className="flex-1 min-w-48 space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Pre-close checklist</span>
          <span className="font-medium">{checklistDone}/{checklistTotal}</span>
        </div>
        <Progress value={checklistPercent} className="h-2" aria-label="Checklist progress" />
      </div>
    </div>
  );
}
