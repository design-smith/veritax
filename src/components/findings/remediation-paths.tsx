"use client";

import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type EffortClass = "low" | "medium" | "high" | "requires-external";

const EFFORT_COLORS: Record<string, string> = {
  low: "border-green-300 bg-green-50 text-green-700",
  medium: "border-amber-300 bg-amber-50 text-amber-700",
  high: "border-red-300 bg-red-50 text-red-700",
};

export interface RemediationPath {
  id: string;
  title: string;
  description: string;
  effortClass: EffortClass;
  affectedObjects: string[];
  requiresExternal?: boolean;
}

interface RemediationPathsProps {
  paths: RemediationPath[];
  onSelectPath: (pathId: string) => void;
  className?: string;
}

export function RemediationPaths({ paths, onSelectPath, className }: RemediationPathsProps) {
  return (
    <div className={cn("grid gap-3", paths.length > 1 ? "grid-cols-1 tablet:grid-cols-2" : "", className)}>
      {paths.slice(0, 3).map((path) => (
        <Card key={path.id} className="flex flex-col">
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between gap-2">
              <CardTitle className="text-sm font-semibold">{path.title}</CardTitle>
              <Badge
                variant="outline"
                className={cn("shrink-0 text-xs capitalize", EFFORT_COLORS[path.effortClass] ?? "")}
              >
                {path.effortClass}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">{path.description}</p>
          </CardHeader>

          <CardContent className="flex-1 pb-2">
            {/* Cascade preview */}
            <div className="space-y-1">
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Affects
              </p>
              <div className="flex flex-wrap gap-1">
                {path.affectedObjects.map((obj) => (
                  <Badge key={obj} variant="secondary" className="text-[10px]">
                    {obj}
                  </Badge>
                ))}
              </div>
            </div>

            {path.requiresExternal && (
              <Badge variant="outline" className="mt-2 text-[10px] text-muted-foreground">
                Requires external
              </Badge>
            )}
          </CardContent>

          <CardFooter className="pt-0">
            <Button
              size="sm"
              variant="outline"
              className="w-full gap-1.5 text-xs"
              onClick={() => onSelectPath(path.id)}
            >
              Select path
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}
