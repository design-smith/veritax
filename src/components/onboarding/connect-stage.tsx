"use client";

import { useState } from "react";
import { Check, Cloud, Copy, FileText, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

interface UploadedFile {
  name: string;
  size: number;
  progress: number;
}

interface ConnectStageProps {
  forwardAddress: string;
  onFilesDrop: (files: File[]) => void;
  onContinue: () => void;
  sharepointEnabled?: boolean;
  className?: string;
}

export function ConnectStage({
  forwardAddress,
  onFilesDrop,
  onContinue,
  sharepointEnabled = true,
  className,
}: ConnectStageProps) {
  const [copied, setCopied] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);

  const canContinue = uploadedFiles.length > 0;

  function handleCopy() {
    navigator.clipboard?.writeText(forwardAddress).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    const newFiles: UploadedFile[] = files.map((f) => ({
      name: f.name,
      size: f.size,
      progress: 0,
    }));
    setUploadedFiles((prev) => [...prev, ...newFiles]);
    onFilesDrop(files);

    // Simulate progress
    newFiles.forEach((_, i) => {
      const timer = setInterval(() => {
        setUploadedFiles((prev) =>
          prev.map((f, idx) =>
            idx === uploadedFiles.length + i
              ? { ...f, progress: Math.min(f.progress + 20, 100) }
              : f,
          ),
        );
      }, 300);
      setTimeout(() => clearInterval(timer), 1600);
    });
  }

  return (
    <div className={cn("space-y-6 max-w-2xl mx-auto", className)}>
      {/* Forward email address */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Forward documents by email</CardTitle>
          <CardDescription>
            Forward any document to this address and it will be automatically ingested.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3">
            <span className="flex-1 font-mono text-sm select-all">{forwardAddress}</span>
            <Button size="sm" variant="outline" className="gap-1.5 shrink-0" onClick={handleCopy}>
              {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Drag-drop zone */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Upload documents directly</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            data-testid="upload-zone"
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            className={cn(
              "flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-12 transition-colors",
              isDragOver
                ? "border-primary bg-primary/5"
                : "border-border bg-muted/20 hover:border-primary/50",
            )}
          >
            <Upload className="h-8 w-8 text-muted-foreground" />
            <div className="text-center">
              <p className="text-sm font-medium">Drop PDF or DOCX files here</p>
              <p className="text-xs text-muted-foreground mt-1">or click to select files</p>
            </div>
          </div>

          {uploadedFiles.length > 0 && (
            <div className="space-y-2">
              {uploadedFiles.map((file, i) => (
                <div key={i} className="flex items-center gap-3">
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{file.name}</p>
                    <Progress value={file.progress} className="h-1 mt-1" />
                  </div>
                  {file.progress >= 100 && <Check className="h-4 w-4 text-green-600 shrink-0" />}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* SharePoint */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Connect SharePoint</CardTitle>
          <CardDescription>Sync documents directly from your SharePoint folder.</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-3">
          <Button
            variant="outline"
            disabled={!sharepointEnabled}
            className="gap-2"
          >
            <Cloud className="h-4 w-4" />
            Connect SharePoint
          </Button>
          {!sharepointEnabled && (
            <p className="text-xs text-muted-foreground">Disabled by IT policy</p>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={onContinue} disabled={!canContinue} size="lg">
          Continue to Ingest →
        </Button>
      </div>
    </div>
  );
}
