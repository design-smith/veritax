"use client";

import { useState } from "react";
import { CheckCircle, Lock, RefreshCw, Sparkles, Unlock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface RevealMomentProps {
  findingCount: number;
  exposureRollup: string;
  onUnlock: () => void;
  onReplay?: () => void;
  isAdmin?: boolean;
  className?: string;
}

export function RevealMoment({
  findingCount,
  exposureRollup,
  onUnlock,
  onReplay,
  isAdmin = false,
  className,
}: RevealMomentProps) {
  const [unlocked, setUnlocked] = useState(false);

  function handleUnlock() {
    setUnlocked(true);
    onUnlock();
  }

  function handleReplay() {
    setUnlocked(false);
    onReplay?.();
  }

  if (unlocked) {
    return (
      <div
        data-testid="reveal-unlocked"
        className={cn("flex flex-col items-center gap-6 py-12 text-center max-w-md mx-auto", className)}
      >
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success-soft dark:bg-success-soft">
          <CheckCircle className="h-8 w-8 text-success-soft-foreground" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold">Examination complete</h2>
          <p className="text-muted-foreground">
            Your intercompany Record is live. Here&apos;s what we found:
          </p>
        </div>
        <div className="flex gap-4">
          <Card className="w-40">
            <CardContent className="pt-4 text-center">
              <p className="text-3xl font-bold text-danger-soft-foreground">{findingCount} findings</p>
              <p className="text-xs text-muted-foreground mt-1">Requiring attention</p>
            </CardContent>
          </Card>
          <Card className="w-40">
            <CardContent className="pt-4 text-center">
              <p className="text-2xl font-bold">{exposureRollup}</p>
              <p className="text-xs text-muted-foreground mt-1">Exposure rollup</p>
            </CardContent>
          </Card>
        </div>
        <div className="flex flex-col gap-2 w-full">
          <Button size="lg" className="w-full gap-2">
            <Sparkles className="h-4 w-4" />
            Go to Briefing
          </Button>
          {isAdmin && (
            <Button size="sm" variant="ghost" className="gap-1.5 text-muted-foreground" onClick={handleReplay}>
              <RefreshCw className="h-3.5 w-3.5" />
              Replay journey
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col items-center gap-6 py-12 text-center max-w-md mx-auto", className)}>
      <Card
        data-testid="reveal-locked-card"
        className="w-full border-2 border-dashed border-primary/30"
      >
        <CardContent className="pt-8 pb-8 space-y-4">
          <div className="flex justify-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
              <Lock className="h-7 w-7 text-primary" />
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-base font-semibold">Examination complete</p>
            <p className="text-sm text-muted-foreground">
              <span className="font-medium">{findingCount} findings</span>
              {" · "}
              <span className="font-medium">{exposureRollup}</span> exposure rollup
            </p>
          </div>
          <Button className="gap-2" onClick={handleUnlock}>
            <Unlock className="h-4 w-4" />
            Unlock results
          </Button>
        </CardContent>
      </Card>

      {isAdmin && (
        <Button size="sm" variant="ghost" className="gap-1.5 text-xs text-muted-foreground" onClick={handleReplay}>
          <RefreshCw className="h-3.5 w-3.5" />
          Replay journey
        </Button>
      )}
    </div>
  );
}
