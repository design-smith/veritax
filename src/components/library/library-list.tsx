"use client";

import { useMemo, useState } from "react";
import { Clock, Download, FileUp, ShieldCheck } from "lucide-react";
import { DataTable, type Column } from "@/components/patterns/pat-8-data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Document, Entity } from "@/lib/mock/types";
import { cn } from "@/lib/utils";
import { filterDocuments, retentionDaysRemaining, type LibraryFacets } from "./library-data";

const CUSTODY_STYLES: Record<Document["custody"], string> = {
  materialized: "border-transparent bg-success-soft text-success-soft-foreground",
  "extract-only": "border-transparent bg-info-soft text-info-soft-foreground",
  reference: "border-border text-muted-foreground",
};

const SENSITIVITY_STYLES: Record<Document["sensitivity"], string> = {
  standard: "border-border text-muted-foreground",
  sensitive: "border-transparent bg-warning-soft text-warning-soft-foreground",
  privileged: "border-transparent bg-danger-soft text-danger-soft-foreground",
};

interface LibraryListProps {
  documents: Document[];
  entities?: Entity[];
  onOpen: (doc: Document) => void;
  onDownload: (doc: Document) => void;
  onPromoteToMaterialized?: (doc: Document) => void;
  onUpload?: (files: FileList) => void;
  className?: string;
}

type LibraryFacetState = LibraryFacets & { source?: string };

function sourceLabel(doc: Document) {
  if (doc.sourcePath.startsWith("/sharepoint")) return "SharePoint";
  if (doc.sourcePath.startsWith("/legal")) return "Legal drive";
  if (doc.sourcePath.startsWith("/vendor")) return "Vendor";
  if (doc.sourcePath.startsWith("/upload")) return "Upload";
  return "Record";
}

function retentionDate(doc: Document) {
  const fiscalYear = Number.parseInt(doc.fy, 10);
  const retainedUntil = Number.isFinite(fiscalYear) ? fiscalYear + 7 : new Date().getFullYear() + 7;
  return `${retainedUntil}-12-31`;
}

function retentionLabel(doc: Document) {
  const days = retentionDaysRemaining(retentionDate(doc));
  if (days <= 0) return "Expired";
  if (days < 365) return `${days}d`;
  return `${Math.floor(days / 365)}y`;
}

function entitySummary(doc: Document, entities: Entity[]) {
  if (doc.entityIds.length === 0) return "No entity";
  const labels = doc.entityIds
    .slice(0, 2)
    .map((entityId) => entities.find((entity) => entity.id === entityId)?.jurisdictionCode ?? entityId);
  return doc.entityIds.length > 2 ? `${labels.join(", ")} +${doc.entityIds.length - 2}` : labels.join(", ");
}

function unique(values: string[]) {
  return [...new Set(values)].sort();
}

function FacetGroup<K extends keyof LibraryFacetState>({
  label,
  facetKey,
  values,
  active,
  onToggle,
}: {
  label: string;
  facetKey: K;
  values: string[];
  active?: string;
  onToggle: (key: K, value: string) => void;
}) {
  if (values.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1">
      <span className="text-xs text-muted-foreground">{label}:</span>
      {values.map((value) => (
        <Button
          key={`${label}-${value}`}
          size="sm"
          variant={active === value ? "default" : "outline"}
          className="h-6 px-2 text-xs"
          onClick={() => onToggle(facetKey, value)}
        >
          {value}
        </Button>
      ))}
    </div>
  );
}

export function LibraryList({
  documents,
  entities = [],
  onOpen,
  onDownload,
  onPromoteToMaterialized,
  onUpload,
  className,
}: LibraryListProps) {
  const [facets, setFacets] = useState<LibraryFacetState>({});
  const visible = useMemo(
    () => filterDocuments(documents, facets).filter((doc) => !facets.source || sourceLabel(doc) === facets.source),
    [documents, facets],
  );

  const facetOptions = useMemo(
    () => ({
      type: unique(documents.map((doc) => doc.type)),
      entityId: unique(documents.flatMap((doc) => doc.entityIds)),
      jurisdiction: unique(documents.map((doc) => doc.jurisdiction)),
      fy: unique(documents.map((doc) => doc.fy)),
      custody: unique(documents.map((doc) => doc.custody)),
      sensitivity: unique(documents.map((doc) => doc.sensitivity)),
      source: unique(documents.map(sourceLabel)),
    }),
    [documents],
  );

  function toggleFacet<K extends keyof LibraryFacetState>(key: K, value: string) {
    setFacets((current) => ({
      ...current,
      [key]: current[key] === value ? undefined : value,
    }));
  }

  function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    if (event.target.files && event.target.files.length > 0) {
      onUpload?.(event.target.files);
      setFacets({});
      event.target.value = "";
    }
  }

  const columns: Column<Document>[] = [
    {
      key: "name",
      header: "Document",
      sortable: true,
      render: (doc) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{doc.name}</p>
          <p className="truncate text-xs text-muted-foreground">{doc.sourcePath}</p>
        </div>
      ),
    },
    {
      key: "type",
      header: "Type",
      sortable: true,
      render: (doc) => <span className="text-xs">{doc.type}</span>,
    },
    {
      key: "entity",
      header: "Entity",
      render: (doc) => <span className="text-xs text-muted-foreground">{entitySummary(doc, entities)}</span>,
    },
    {
      key: "jurisdiction",
      header: "Jurisdiction",
      sortable: true,
      render: (doc) => <span className="font-mono text-xs">{doc.jurisdiction}</span>,
    },
    {
      key: "fy",
      header: "FY",
      sortable: true,
      render: (doc) => <span className="text-xs">FY{doc.fy}</span>,
    },
    {
      key: "custody",
      header: "Custody",
      sortable: true,
      render: (doc) => (
        <Badge variant="outline" className={cn("text-[10px]", CUSTODY_STYLES[doc.custody])}>
          {doc.custody}
        </Badge>
      ),
    },
    {
      key: "sensitivity",
      header: "Sensitivity",
      sortable: true,
      render: (doc) => (
        <Badge variant="outline" className={cn("text-[10px]", SENSITIVITY_STYLES[doc.sensitivity])}>
          {doc.sensitivity}
        </Badge>
      ),
    },
    {
      key: "source",
      header: "Source",
      sortable: true,
      render: (doc) => <span className="text-xs text-muted-foreground">{sourceLabel(doc)}</span>,
    },
    {
      key: "retention",
      header: "Retention",
      render: (doc) => (
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          {retentionLabel(doc)}
        </span>
      ),
    },
    {
      key: "version",
      header: "Version",
      sortable: true,
      render: (doc) => <span className="font-mono text-xs">v{doc.version}</span>,
    },
    {
      key: "actions",
      header: "Actions",
      render: (doc) => (
        <div className="flex flex-wrap items-center gap-1" onClick={(event) => event.stopPropagation()}>
          {doc.custody === "reference" && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1 px-2 text-xs"
              onClick={() => onPromoteToMaterialized?.(doc)}
            >
              <ShieldCheck className="h-3 w-3" />
              Promote to materialized
            </Button>
          )}
          <Button size="sm" variant="ghost" className="h-7 gap-1 px-2 text-xs" onClick={() => onDownload(doc)}>
            <Download className="h-3 w-3" />
            Download
          </Button>
        </div>
      ),
    },
  ];

  const hasFacets = Object.values(facets).some(Boolean);

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <FacetGroup label="Type" facetKey="type" values={facetOptions.type} active={facets.type} onToggle={toggleFacet} />
          <FacetGroup label="Entity" facetKey="entityId" values={facetOptions.entityId} active={facets.entityId} onToggle={toggleFacet} />
          <FacetGroup label="Jurisdiction" facetKey="jurisdiction" values={facetOptions.jurisdiction} active={facets.jurisdiction} onToggle={toggleFacet} />
          <FacetGroup label="FY" facetKey="fy" values={facetOptions.fy} active={facets.fy} onToggle={toggleFacet} />
          <FacetGroup label="Custody" facetKey="custody" values={facetOptions.custody} active={facets.custody} onToggle={toggleFacet} />
          <FacetGroup label="Sensitivity" facetKey="sensitivity" values={facetOptions.sensitivity} active={facets.sensitivity} onToggle={toggleFacet} />
          <FacetGroup label="Source" facetKey="source" values={facetOptions.source} active={facets.source} onToggle={toggleFacet} />
          {hasFacets && (
            <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => setFacets({})}>
              Clear
            </Button>
          )}
        </div>

        {onUpload && (
          <label className="inline-flex h-8 cursor-pointer items-center gap-2 rounded-md border border-input px-3 text-sm font-medium hover:bg-accent">
            <FileUp className="h-4 w-4" />
            Upload documents
            <input aria-label="Upload documents" type="file" multiple className="sr-only" onChange={handleUpload} />
          </label>
        )}
      </div>

      <p className="text-xs text-muted-foreground">{visible.length} documents</p>

      <DataTable
        columns={columns}
        data={visible}
        onRowOpen={onOpen}
        enableFiltering
        enableDensity
        enableSavedViews
        shareBasePath="/library"
        emptyState={
          <p className="py-8 text-center text-sm text-muted-foreground">
            No documents match the selected facets.
          </p>
        }
      />
    </div>
  );
}
