"use client";

import { useState } from "react";
import { CheckCircle, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

interface SignCeremonyProps {
  docName: string;
  reviewerName: string;
  attestationText: string;
  onSeal: () => void;
  className?: string;
}

function generateManifestHash(): string {
  return `sha256:${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

export function SignCeremony({
  docName,
  reviewerName,
  attestationText,
  onSeal,
  className,
}: SignCeremonyProps) {
  const [confirmed, setConfirmed] = useState(false);
  const [sealed, setSealed] = useState(false);
  const [manifestHash, setManifestHash] = useState<string | null>(null);
  const [sealedAt, setSealedAt] = useState<string | null>(null);

  function handleSeal() {
    const hash = generateManifestHash();
    const now = new Date().toISOString();
    setManifestHash(hash);
    setSealedAt(now);
    setSealed(true);
    onSeal();
  }

  if (sealed && manifestHash) {
    return (
      <div data-testid="manifest-receipt" className={cn("space-y-4", className)}>
        <div className="flex items-center gap-3 rounded-lg border border-green-300 bg-green-50 p-4 dark:border-green-700 dark:bg-green-950">
          <CheckCircle className="h-6 w-6 text-green-600 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-green-800 dark:text-green-200">Document signed and sealed</p>
            <p className="text-xs text-green-700 dark:text-green-300 mt-0.5">Receipt generated</p>
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4 space-y-2 text-xs">
          <p><span className="font-medium">Document:</span> {docName}</p>
          <p><span className="font-medium">Reviewer:</span> {reviewerName}</p>
          <p><span className="font-medium">Sealed at:</span> {sealedAt}</p>
          <p className="font-mono break-all"><span className="font-medium">Hash:</span> {manifestHash}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-5", className)}>
      {/* Document & reviewer block */}
      <div className="rounded-lg border border-border bg-card p-4 space-y-2">
        <div>
          <p className="text-xs text-muted-foreground">Document</p>
          <p className="text-sm font-semibold">{docName}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Reviewer</p>
          <p className="text-sm font-semibold">{reviewerName}</p>
        </div>
      </div>

      {/* Attestation text */}
      <div className="rounded-lg border border-border bg-muted/20 p-4">
        <p className="text-sm italic leading-relaxed">{attestationText}</p>
      </div>

      <Separator />

      {/* Confirmation checkbox */}
      <div className="flex items-start gap-3">
        <Checkbox
          id="confirm-attest"
          checked={confirmed}
          onCheckedChange={(v) => setConfirmed(Boolean(v))}
        />
        <Label htmlFor="confirm-attest" className="text-sm font-normal leading-relaxed cursor-pointer">
          I confirm the above attestation and consent to my digital signature being applied to this document.
        </Label>
      </div>

      <Button
        disabled={!confirmed}
        onClick={handleSeal}
        className="w-full gap-2"
      >
        Seal & sign
      </Button>
    </div>
  );
}
