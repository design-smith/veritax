"use client";

import type * as React from "react";
import { AlertTriangle, FileX, Lock, RefreshCw, ServerOff } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export type SurfaceState =
  | { kind: "empty"; heading: string; description: string; action?: React.ReactNode; className?: string }
  | { kind: "loading"; rows?: number; className?: string }
  | { kind: "degraded"; affectedSources: string[]; className?: string }
  | {
      kind: "denied";
      tierName: string;
      reason: string;
      onRequestAccess?: () => void;
      className?: string;
    }
  | { kind: "error"; incidentId?: string; onRetry?: () => void; className?: string };

interface SurfaceStateViewProps {
  state: SurfaceState;
  children?: React.ReactNode;
}

export function SurfaceStateView({ state, children }: SurfaceStateViewProps) {
  switch (state.kind) {
    case "empty":
      return (
        <EmptyState
          heading={state.heading}
          description={state.description}
          action={state.action}
          className={state.className}
        />
      );
    case "loading":
      return <LoadingState rows={state.rows} className={state.className} />;
    case "degraded":
      return (
        <DegradedState affectedSources={state.affectedSources} className={state.className}>
          {children}
        </DegradedState>
      );
    case "denied":
      return (
        <DeniedState
          tierName={state.tierName}
          reason={state.reason}
          onRequestAccess={state.onRequestAccess}
          className={state.className}
        />
      );
    case "error":
      return (
        <ErrorState
          incidentId={state.incidentId}
          onRetry={state.onRetry}
          className={state.className}
        />
      );
  }
}

// ── EmptyState ───────────────────────────────────────────────────────────────

interface EmptyStateProps {
  heading: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ heading, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-4 py-24 text-center", className)}>
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
        <FileX className="h-7 w-7 text-muted-foreground" />
      </div>
      <div className="space-y-1">
        <p className="text-base font-medium">{heading}</p>
        <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

// ── LoadingState ─────────────────────────────────────────────────────────────

interface LoadingStateProps {
  rows?: number;
  className?: string;
}

export function LoadingState({ rows = 5, className }: LoadingStateProps) {
  return (
    <div className={cn("space-y-3 p-6", className)} aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton data-testid="skeleton" className="h-4 w-4 shrink-0 rounded-sm" />
          <Skeleton
            data-testid="skeleton"
            className="h-4 rounded"
            style={{ width: `${60 + ((i * 17) % 35)}%` }}
          />
        </div>
      ))}
    </div>
  );
}

// ── DegradedState ────────────────────────────────────────────────────────────

interface DegradedStateProps {
  affectedSources: string[];
  children: React.ReactNode;
  className?: string;
}

export function DegradedState({ affectedSources, children, className }: DegradedStateProps) {
  return (
    <div className={cn("space-y-4", className)}>
      <Alert variant="warning" role="alert">
        <ServerOff className="h-4 w-4" />
        <AlertTitle>Some sources are unavailable</AlertTitle>
        <AlertDescription>
          Data shown below may be stale. Affected:{" "}
          <span className="font-medium">{affectedSources.join(", ")}</span>
        </AlertDescription>
      </Alert>
      {children}
    </div>
  );
}

// ── DeniedState ──────────────────────────────────────────────────────────────

interface DeniedStateProps {
  tierName: string;
  reason: string;
  onRequestAccess?: () => void;
  className?: string;
}

export function DeniedState({ tierName, reason, onRequestAccess, className }: DeniedStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-4 py-24 text-center", className)}>
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
        <Lock className="h-7 w-7 text-muted-foreground" />
      </div>
      <div className="space-y-1">
        <p className="text-base font-medium">{tierName} — Access restricted</p>
        <p className="max-w-sm text-sm text-muted-foreground">{reason}</p>
      </div>
      {onRequestAccess && (
        <Button variant="outline" size="sm" onClick={onRequestAccess}>
          Request access
        </Button>
      )}
    </div>
  );
}

// ── ErrorState ───────────────────────────────────────────────────────────────

interface ErrorStateProps {
  incidentId?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({ incidentId, onRetry, className }: ErrorStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-4 py-24 text-center", className)}>
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-danger/[0.10]">
        <AlertTriangle className="h-7 w-7 text-danger-soft-foreground" />
      </div>
      <div className="space-y-1">
        <p className="text-base font-medium">Something went wrong</p>
        {incidentId && (
          <p className="text-xs text-muted-foreground font-mono">Ref: {incidentId}</p>
        )}
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw className="h-4 w-4" />
          Retry
        </Button>
      )}
    </div>
  );
}
