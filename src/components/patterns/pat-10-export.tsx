"use client";

import { useState } from "react";
import { AlertTriangle, Download, Hash, Shield } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";

export type ArtifactClass = "record" | "communication";

interface ExportPayload {
  format: string;
  destination: string;
}

interface ExportDialogProps {
  open: boolean;
  artifactClass: ArtifactClass;
  artifactName: string;
  isSigned?: boolean;
  uncitedClaimCount?: number;
  onExport: (payload: ExportPayload) => void;
  onClose: () => void;
}

const RECORD_FORMATS = ["PDF (sealed)", "XLSX", "JSON + hash"];
const COMM_FORMATS = ["PDF", "PPTX", "PNG", "XLSX"];
const DESTINATIONS = ["Download", "SharePoint folder", "Email draft"];

export function ExportDialog({
  open,
  artifactClass,
  artifactName,
  isSigned = false,
  uncitedClaimCount = 0,
  onExport,
  onClose,
}: ExportDialogProps) {
  const formats = artifactClass === "record" ? RECORD_FORMATS : COMM_FORMATS;
  const [format, setFormat] = useState(formats[0]);
  const [destination, setDestination] = useState(DESTINATIONS[0]);

  const isBlocked = uncitedClaimCount > 0;

  function handleExport() {
    if (isBlocked) return;
    onExport({ format, destination });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            Export
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">{artifactName}</p>

          {/* Uncited claim guard */}
          {isBlocked && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {uncitedClaimCount} uncited claims — export blocked until all claims have resolvable citations.
              </AlertDescription>
            </Alert>
          )}

          {/* DRAFT watermark notice */}
          {artifactClass === "record" && !isSigned && (
            <Alert className="border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950">
              <Shield className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-900 dark:text-amber-100">
                Export will include a non-removable <strong>DRAFT — not for reliance</strong> watermark.
              </AlertDescription>
            </Alert>
          )}

          {/* Format */}
          <div className="space-y-2">
            <Label className="text-xs font-medium">Format</Label>
            <RadioGroup value={format} onValueChange={setFormat} className="gap-1.5">
              {formats.map((f) => (
                <div key={f} className="flex items-center gap-2">
                  <RadioGroupItem value={f} id={`fmt-${f}`} />
                  <Label htmlFor={`fmt-${f}`} className="cursor-pointer text-sm font-normal">{f}</Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          <Separator />

          {/* Verification hash (record only) */}
          {artifactClass === "record" && (
            <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 p-2 text-xs text-muted-foreground">
              <Hash className="h-3.5 w-3.5 shrink-0" />
              <span>
                Verification hash will be embedded. Copy hash after export to verify integrity.
              </span>
            </div>
          )}

          {/* Destination */}
          <div className="space-y-2">
            <Label className="text-xs font-medium">Destination</Label>
            <RadioGroup value={destination} onValueChange={setDestination} className="gap-1.5">
              {DESTINATIONS.map((d) => (
                <div key={d} className="flex items-center gap-2">
                  <RadioGroupItem value={d} id={`dst-${d}`} />
                  <Label htmlFor={`dst-${d}`} className="cursor-pointer text-sm font-normal">{d}</Label>
                </div>
              ))}
            </RadioGroup>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleExport} disabled={isBlocked}>
            Export
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
