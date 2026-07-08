"use client";

import { useState } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import type { AdvisorRequest } from "./advisor-requests-list";
import { cn } from "@/lib/utils";

interface SubmitPayload {
  requestId: string;
  values: Record<string, string>;
  files: File[];
}

interface AdvisorRequestFormProps {
  request: AdvisorRequest;
  onSubmit: (payload: SubmitPayload) => void;
  onUpload: (files: File[]) => void;
  className?: string;
}

export function AdvisorRequestForm({ request, onSubmit, onUpload, className }: AdvisorRequestFormProps) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<File[]>([]);

  const requiredFields = request.fields.filter((f) => f.required);
  const allRequiredFilled = requiredFields.every((f) => values[f.id]?.trim());

  function handleChange(fieldId: string, value: string) {
    setValues((prev) => ({ ...prev, [fieldId]: value }));
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const dropped = Array.from(e.dataTransfer.files);
    setFiles((prev) => [...prev, ...dropped]);
    onUpload(dropped);
  }

  function handleSubmit() {
    onSubmit({ requestId: request.id, values, files });
  }

  return (
    <div className={cn("space-y-5", className)}>
      <div>
        <h2 className="text-base font-semibold">{request.title}</h2>
        <p className="text-sm text-muted-foreground mt-1">{request.description}</p>
      </div>

      <Separator />

      {/* Dynamic fields */}
      <div className="space-y-4">
        {request.fields.map((field) => (
          <div key={field.id} className="space-y-1.5">
            <Label htmlFor={`field-${field.id}`}>
              {field.label}
              {field.required && <span className="ml-1 text-danger-soft-foreground">*</span>}
            </Label>
            {field.type === "textarea" ? (
              <Textarea
                id={`field-${field.id}`}
                value={values[field.id] ?? ""}
                onChange={(e) => handleChange(field.id, e.target.value)}
                rows={3}
              />
            ) : (
              <Input
                id={`field-${field.id}`}
                type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
                value={values[field.id] ?? ""}
                onChange={(e) => handleChange(field.id, e.target.value)}
              />
            )}
          </div>
        ))}
      </div>

      {/* Upload slot */}
      <div
        data-testid="upload-slot"
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border py-8 text-center text-sm text-muted-foreground hover:border-primary/50 transition-colors"
      >
        <Upload className="h-6 w-6" />
        <p>Drop files here or click to browse</p>
        {files.length > 0 && (
          <ul className="mt-2 space-y-1 text-xs">
            {files.map((f, i) => <li key={i}>{f.name}</li>)}
          </ul>
        )}
      </div>

      <Button onClick={handleSubmit} disabled={!allRequiredFilled} className="w-full">
        Submit response
      </Button>
    </div>
  );
}
