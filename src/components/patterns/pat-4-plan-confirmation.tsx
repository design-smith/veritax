"use client";

import { useState } from "react";
import { CheckCircle, Clock, Package, Trash2, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export type InstructionTier = "style" | "run" | "methodology";
export type PermissionCheckResult = "allowed" | "requires-approval" | "denied";
export type CostClass = "instant" | "fast" | "standard" | "batch";

export interface PlanStep {
  id: string;
  description: string;
  scope?: string;
}

export interface PlanSpec {
  intent: string;
  steps: PlanStep[];
  produces: string[];
  invalidates: string[];
  estimatedDuration: string;
  costClass: CostClass;
  instruction: string;
  permissionCheck: PermissionCheckResult;
  tier: InstructionTier;
}

interface RunPayload {
  instruction: string;
}

interface PlanConfirmationModalProps {
  open: boolean;
  plan: PlanSpec;
  onRun: (payload: RunPayload) => void;
  onCancel: () => void;
}

const PERMISSION_CONFIG = {
  allowed: { label: "Allowed", color: "text-green-600 dark:text-green-400" },
  "requires-approval": { label: "Approval required — request will route to manager", color: "text-amber-600 dark:text-amber-400" },
  denied: { label: "Denied — insufficient permissions", color: "text-destructive" },
};

const COST_LABELS: Record<CostClass, string> = {
  instant: "Instant",
  fast: "Fast (<30s)",
  standard: "Standard (30s–2min)",
  batch: "Batch (minutes)",
};

const TIER_COLORS: Record<InstructionTier, string> = {
  style: "border-green-300 bg-green-50 text-green-700",
  run: "border-blue-300 bg-blue-50 text-blue-700",
  methodology: "border-amber-300 bg-amber-50 text-amber-700",
};

export function PlanConfirmationModal({ open, plan, onRun, onCancel }: PlanConfirmationModalProps) {
  const [instruction, setInstruction] = useState(plan.instruction);

  const canRun =
    plan.permissionCheck === "allowed" && plan.tier !== "methodology";

  function handleRun() {
    if (!canRun) return;
    onRun({ instruction });
  }

  const permConfig = PERMISSION_CONFIG[plan.permissionCheck];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            Confirm action
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* (a) Intent */}
          <div className="rounded-md border border-border bg-muted/30 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1">What will happen</p>
            <p className="text-sm font-medium">{plan.intent}</p>
          </div>

          {/* (b) Steps */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Steps</p>
            {plan.steps.map((step, i) => (
              <div key={step.id} className="flex items-start gap-2">
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-medium">
                  {i + 1}
                </span>
                <div>
                  <p className="text-sm">{step.description}</p>
                  {step.scope && (
                    <p className="text-xs text-muted-foreground">Scope: {step.scope}</p>
                  )}
                </div>
              </div>
            ))}
          </div>

          <Separator />

          {/* (c) Produces / Invalidates */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-1 text-xs font-medium text-green-600">
                <Package className="h-3 w-3" />Produces
              </div>
              {plan.produces.map((p) => (
                <p key={p} className="text-xs text-muted-foreground">• {p}</p>
              ))}
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1 text-xs font-medium text-destructive">
                <Trash2 className="h-3 w-3" />Invalidates
              </div>
              {plan.invalidates.map((inv) => (
                <p key={inv} className="text-xs text-muted-foreground">• {inv}</p>
              ))}
            </div>
          </div>

          {/* (d) Duration + cost class */}
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            <span>{plan.estimatedDuration}</span>
            <Badge variant="outline" className="text-[10px]">{COST_LABELS[plan.costClass]}</Badge>
          </div>

          <Separator />

          {/* (e) Instruction echo (editable) */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Instruction</Label>
              <Badge variant="outline" className={cn("text-[10px] capitalize", TIER_COLORS[plan.tier])}>
                {plan.tier}
              </Badge>
            </div>
            <Textarea
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              rows={2}
              className="text-sm"
            />
          </div>

          {/* (f) Permission check */}
          <div className="flex items-center gap-2 text-xs">
            <CheckCircle className={cn("h-3.5 w-3.5", permConfig.color)} />
            <span className={permConfig.color}>{permConfig.label}</span>
          </div>

          {plan.permissionCheck === "requires-approval" && (
            <p className="text-xs text-amber-700 dark:text-amber-400">
              <strong>Approval required</strong> — submitting will route this to your manager for gate review.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button onClick={handleRun} disabled={!canRun}>
            Run
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
