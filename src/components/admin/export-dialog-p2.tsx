"use client";

import { useState } from "react";
import { AlertTriangle, Check, Copy, Download, Hash, Info, Shield } from "lucide-react";
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

type ArtifactClass = "record" | "communication";
type DestinationId = "download" | "sharepoint" | "email";
type ExportFormat = "PDF" | "XLSX" | "JSON + hash" | "PPTX" | "PNG";

const RECORD_FORMATS: ExportFormat[] = ["PDF", "XLSX", "JSON + hash"];
const COMM_FORMATS:   ExportFormat[] = ["PDF", "PPTX", "PNG", "XLSX"];

const DESTINATION_LABELS: Record<DestinationId, string> = {
  download:   "Download",
  sharepoint: "SharePoint folder",
  email:      "Email draft",
};

interface ExportDialogP2Props {
  open: boolean;
  artifactClass: ArtifactClass;
  artifactName: string;
  isSigned?: boolean;
  verificationHash?: string;
  permittedDestinations: DestinationId[];
  blockedDestinations?: DestinationId[];
  uncitedClaimCount?: number;
  onExport: (payload: { format: ExportFormat; destination: DestinationId }) => void;
  onClose: () => void;
}

export function ExportDialogP2({
  open,
  artifactClass,
  artifactName,
  isSigned = false,
  verificationHash,
  permittedDestinations,
  blockedDestinations = [],
  uncitedClaimCount = 0,
  onExport,
  onClose,
}: ExportDialogP2Props) {
  const formats = artifactClass === "record" ? RECORD_FORMATS : COMM_FORMATS;
  const [format, setFormat] = useState<ExportFormat>(formats[0]);
  const [destination, setDestination] = useState<DestinationId>(permittedDestinations[0]);
  const [hashCopied, setHashCopied] = useState(false);

  const isBlocked = uncitedClaimCount > 0;

  function copyHash() {
    if (verificationHash) {
      navigator.clipboard?.writeText(verificationHash).catch(() => {});
      setHashCopied(true);
      setTimeout(() => setHashCopied(false), 2000);
    }
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

        <div className="space-y-4 py-1">
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
          {!isSigned && (
            <Alert className="border-warning/25 bg-warning-soft dark:border-warning/30 dark:bg-warning-soft">
              <Shield className="h-4 w-4 text-warning-soft-foreground" />
              <AlertDescription className="text-warning-soft-foreground dark:text-warning-soft-foreground">
                <strong>DRAFT — not for reliance</strong> watermark will be applied.
              </AlertDescription>
            </Alert>
          )}

          {/* Verification hash — record class only */}
          {artifactClass === "record" && verificationHash && (
            <div className="rounded-md border border-border bg-muted/40 p-3 space-y-2">
              <div className="flex items-center gap-2 text-xs font-medium">
                <Hash className="h-3.5 w-3.5" />
                Verification hash
              </div>
              <div className="flex items-center gap-2">
                <code className="flex-1 truncate font-mono text-xs text-muted-foreground">
                  {verificationHash}
                </code>
                <Button size="sm" variant="outline" className="h-6 gap-1 px-2 text-[10px] shrink-0"
                  aria-label="Copy hash" onClick={copyHash}>
                  {hashCopied ? <Check className="h-3 w-3 text-success-soft-foreground" /> : <Copy className="h-3 w-3" />}
                  {hashCopied ? "Copied" : "Copy hash"}
                </Button>
              </div>
            </div>
          )}

          {/* Format selector */}
          <div className="space-y-2">
            <Label className="text-xs font-medium">Format</Label>
            <RadioGroup value={format} onValueChange={(v) => setFormat(v as ExportFormat)} className="gap-1.5">
              {formats.map((f) => (
                <div key={f} className="flex items-center gap-2">
                  <RadioGroupItem value={f} id={`fmt-${f}`} />
                  <Label htmlFor={`fmt-${f}`} className="cursor-pointer text-sm font-normal">{f}</Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          <Separator />

          {/* Destinations — IT-permitted only */}
          <div className="space-y-2">
            <Label className="text-xs font-medium">Destination</Label>
            <RadioGroup value={destination}
              onValueChange={(v) => setDestination(v as DestinationId)} className="gap-1.5">
              {permittedDestinations.map((d) => (
                <div key={d} className="flex items-center gap-2">
                  <RadioGroupItem value={d} id={`dst-${d}`} />
                  <Label htmlFor={`dst-${d}`} className="cursor-pointer text-sm font-normal">
                    {DESTINATION_LABELS[d]}
                  </Label>
                </div>
              ))}
            </RadioGroup>
            {/* Blocked destinations — Request path */}
            {blockedDestinations.map((d) => (
              <div key={d} className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{DESTINATION_LABELS[d]} — blocked by IT policy</span>
                <Button size="sm" variant="ghost" className="h-5 px-1 text-[10px] text-primary">
                  Request {d}
                </Button>
              </div>
            ))}
          </div>

          {/* Audit-trail notice */}
          <div className="flex items-center gap-2 rounded-md border border-border bg-muted/20 p-2 text-xs text-muted-foreground">
            <Info className="h-3.5 w-3.5 shrink-0" />
            <span>Export will be logged. Your identity and the artifact hash will be recorded.</span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onExport({ format, destination })} disabled={isBlocked}>
            Export
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
