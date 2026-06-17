"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { Document } from "@/lib/mock/types";
import { cn } from "@/lib/utils";
import { filterDocuments, facetValues, type LibraryFacets } from "./library-data";

const CUSTODY_STYLES: Record<Document["custody"], string> = {
  materialized: "border-green-300 bg-green-50 text-green-700 dark:bg-green-950",
  "extract-only": "border-blue-300 bg-blue-50 text-blue-700 dark:bg-blue-950",
  reference: "border-border text-muted-foreground",
};

const SENSITIVITY_STYLES: Record<Document["sensitivity"], string> = {
  standard: "",
  sensitive: "border-amber-300 bg-amber-50 text-amber-700",
  privileged: "border-red-300 bg-red-50 text-red-700",
};

interface LibraryListProps {
  documents: Document[];
  onOpen: (doc: Document) => void;
  onDownload: (doc: Document) => void;
  className?: string;
}

export function LibraryList({ documents, onOpen, onDownload, className }: LibraryListProps) {
  const [facets, setFacets] = useState<LibraryFacets>({});

  const types = facetValues(documents, "type");
  const jurisdictions = facetValues(documents, "jurisdiction");
  const fiscalYears = facetValues(documents, "fy");

  const visible = filterDocuments(documents, facets);

  function toggleFacet<K extends keyof LibraryFacets>(key: K, value: string) {
    setFacets((prev) => ({
      ...prev,
      [key]: prev[key] === value ? undefined : value,
    }));
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Facet chips */}
      <div className="flex flex-wrap gap-3">
        {/* Type */}
        <div className="flex flex-wrap gap-1">
          <span className="text-xs text-muted-foreground self-center">Type:</span>
          {types.map((t) => (
            <Button
              key={t}
              size="sm"
              variant={facets.type === t ? "default" : "outline"}
              className="h-6 px-2 text-xs"
              onClick={() => toggleFacet("type", t)}
            >
              {t}
            </Button>
          ))}
        </div>

        {/* Jurisdiction */}
        <div className="flex flex-wrap gap-1">
          <span className="text-xs text-muted-foreground self-center">Jurisdiction:</span>
          {jurisdictions.map((j) => (
            <Button
              key={j}
              size="sm"
              variant={facets.jurisdiction === j ? "default" : "outline"}
              className="h-6 px-2 text-xs font-mono"
              onClick={() => toggleFacet("jurisdiction", j)}
            >
              {j}
            </Button>
          ))}
        </div>

        {/* FY */}
        <div className="flex flex-wrap gap-1">
          <span className="text-xs text-muted-foreground self-center">FY:</span>
          {fiscalYears.map((fy) => (
            <Button
              key={fy}
              size="sm"
              variant={facets.fy === fy ? "default" : "outline"}
              className="h-6 px-2 text-xs"
              onClick={() => toggleFacet("fy", fy)}
            >
              {fy}
            </Button>
          ))}
        </div>

        {Object.keys(facets).some((k) => facets[k as keyof LibraryFacets]) && (
          <Button size="sm" variant="ghost" className="h-6 px-2 text-xs text-muted-foreground"
            onClick={() => setFacets({})}>
            Clear
          </Button>
        )}
      </div>

      <p className="text-xs text-muted-foreground">{visible.length} documents</p>

      <Separator />

      {/* Document rows */}
      <div className="space-y-2">
        {visible.map((doc) => (
          <div
            key={doc.id}
            className="flex items-start justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3 transition-colors hover:bg-muted/30"
          >
            <button
              className="flex min-w-0 flex-1 flex-col gap-1 text-left"
              onClick={() => onOpen(doc)}
            >
              <span className="text-sm font-medium truncate">{doc.name}</span>
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge
                  variant="outline"
                  className={cn("text-[10px]", CUSTODY_STYLES[doc.custody])}
                >
                  {doc.custody}
                </Badge>
                {doc.sensitivity !== "standard" && (
                  <Badge
                    variant="outline"
                    className={cn("text-[10px]", SENSITIVITY_STYLES[doc.sensitivity])}
                  >
                    {doc.sensitivity}
                  </Badge>
                )}
                <span className="text-[10px] font-mono text-muted-foreground">{doc.jurisdiction}</span>
                <span className="text-[10px] text-muted-foreground">FY{doc.fy}</span>
                <span className="text-[10px] text-muted-foreground">v{doc.version}</span>
              </div>
            </button>
            <div className="flex shrink-0 items-center gap-1">
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs"
                onClick={() => onDownload(doc)}
              >
                Download
              </Button>
            </div>
          </div>
        ))}
        {visible.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">No documents match the selected facets.</p>
        )}
      </div>
    </div>
  );
}
