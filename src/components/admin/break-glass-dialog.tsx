"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle, ShieldAlert } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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

interface BreakGlassPayload {
  reason: string;
  ticketId: string;
}

interface BreakGlassDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (payload: BreakGlassPayload) => void;
}

type Step = "reason" | "ack" | "done";

export function BreakGlassDialog({ open, onClose, onConfirm }: BreakGlassDialogProps) {
  const [step, setStep] = useState<Step>("reason");
  const [reason, setReason] = useState("");
  const [supervisorAck, setSupervisorAck] = useState(false);
  const [ticketId] = useState(`BG-${Date.now().toString(36).toUpperCase()}`);

  function handleFirstConfirm() {
    if (!reason.trim()) return;
    setStep("ack");
  }

  function handleFinalConfirm() {
    if (!supervisorAck) return;
    setStep("done");
    onConfirm({ reason: reason.trim(), ticketId });
  }

  function handleClose() {
    setStep("reason");
    setReason("");
    setSupervisorAck(false);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-danger-soft-foreground">
            <ShieldAlert className="h-5 w-5" />
            Break-glass initiation
          </DialogTitle>
        </DialogHeader>

        {step === "done" ? (
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-3 rounded-lg border border-success/25 bg-success-soft p-4 dark:border-success/30 dark:bg-success-soft">
              <CheckCircle className="h-5 w-5 text-success-soft-foreground shrink-0" />
              <div>
                <p className="text-sm font-semibold text-success-soft-foreground dark:text-success-soft-foreground">Break-glass initiated</p>
                <p className="text-xs text-success-soft-foreground dark:text-success-soft-foreground mt-0.5">
                  Auto-review ticket created: <strong>{ticketId}</strong>
                </p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Emergency access is now active. A mandatory review has been triggered and assigned to your supervisor.
            </p>
            <Button className="w-full" onClick={handleClose}>Close</Button>
          </div>
        ) : step === "reason" ? (
          <>
            <div className="space-y-4 py-2">
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  This action grants emergency access and triggers an automatic review process. Misuse is a policy violation.
                </AlertDescription>
              </Alert>
              <div className="space-y-2">
                <Label htmlFor="bg-reason" className="text-sm font-medium">
                  Reason for break-glass access (required)
                </Label>
                <Textarea
                  id="bg-reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Describe the reason for this break-glass access request..."
                  rows={3}
                  className="text-sm"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button
                variant="destructive"
                disabled={!reason.trim()}
                onClick={handleFirstConfirm}
              >
                Confirm
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <div className="space-y-4 py-2">
              <div className="rounded-lg border border-border bg-muted/20 p-3 text-xs">
                <p className="font-medium">Reason:</p>
                <p className="text-muted-foreground mt-1">{reason}</p>
              </div>
              <Separator />
              <div className="flex items-start gap-3">
                <Checkbox
                  id="supervisor-ack"
                  checked={supervisorAck}
                  onCheckedChange={(v) => setSupervisorAck(Boolean(v))}
                  aria-label="Supervisor acknowledgment"
                />
                <Label htmlFor="supervisor-ack" className="text-sm font-normal leading-relaxed cursor-pointer">
                  I acknowledge that this break-glass access will be immediately reviewed by my supervisor and logged permanently.
                </Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setStep("reason")}>Back</Button>
              <Button
                variant="destructive"
                disabled={!supervisorAck}
                onClick={handleFinalConfirm}
              >
                Initiate break-glass
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
