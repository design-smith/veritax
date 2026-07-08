import { cn } from "@/lib/utils";

export type SdkTone =
  | "primary"
  | "secondary"
  | "info"
  | "success"
  | "warning"
  | "caution"
  | "danger"
  | "discovery"
  | "muted";

type ToneClasses = {
  badge: string;
  badgeOutline: string;
  chip: string;
  icon: string;
  panel: string;
  row: string;
  text: string;
  dot: string;
};

const neutralText = "text-foreground";
const mutedText = "text-muted-foreground";

export const sdkTone: Record<SdkTone, ToneClasses> = {
  primary: {
    badge: "border-transparent bg-primary text-primary-foreground",
    badgeOutline: "border-primary/25 bg-primary/[0.06] text-foreground",
    chip: "bg-primary/[0.08] text-foreground",
    icon: "text-foreground",
    panel: "border-primary/[0.15] bg-primary/[0.06] text-foreground",
    row: "bg-primary/[0.05]",
    text: neutralText,
    dot: "bg-primary",
  },
  secondary: {
    badge: "border-transparent bg-secondary text-secondary-foreground",
    badgeOutline: "border-border bg-surface text-muted-foreground",
    chip: "bg-secondary text-secondary-foreground",
    icon: mutedText,
    panel: "border-border bg-surface-secondary text-foreground",
    row: "bg-surface-secondary",
    text: mutedText,
    dot: "bg-muted-foreground",
  },
  info: {
    badge: "border-transparent bg-info-soft text-info-soft-foreground",
    badgeOutline: "border-info/25 bg-info/[0.08] text-info-soft-foreground",
    chip: "bg-info-soft text-info-soft-foreground",
    icon: "text-info-soft-foreground",
    panel: "border-info/20 bg-info-soft text-info-soft-foreground",
    row: "bg-info-soft/[0.55]",
    text: "text-info-soft-foreground",
    dot: "bg-info",
  },
  success: {
    badge: "border-transparent bg-success-soft text-success-soft-foreground",
    badgeOutline: "border-success/25 bg-success/[0.08] text-success-soft-foreground",
    chip: "bg-success-soft text-success-soft-foreground",
    icon: "text-success-soft-foreground",
    panel: "border-success/20 bg-success-soft text-success-soft-foreground",
    row: "bg-success-soft/[0.55]",
    text: "text-success-soft-foreground",
    dot: "bg-success",
  },
  warning: {
    badge: "border-transparent bg-warning-soft text-warning-soft-foreground",
    badgeOutline: "border-warning/25 bg-warning/[0.08] text-warning-soft-foreground",
    chip: "bg-warning-soft text-warning-soft-foreground",
    icon: "text-warning-soft-foreground",
    panel: "border-warning/20 bg-warning-soft text-warning-soft-foreground",
    row: "bg-warning-soft/[0.55]",
    text: "text-warning-soft-foreground",
    dot: "bg-warning",
  },
  caution: {
    badge: "border-transparent bg-caution-soft text-caution-soft-foreground",
    badgeOutline: "border-caution/25 bg-caution/[0.08] text-caution-soft-foreground",
    chip: "bg-caution-soft text-caution-soft-foreground",
    icon: "text-caution-soft-foreground",
    panel: "border-caution/20 bg-caution-soft text-caution-soft-foreground",
    row: "bg-caution-soft/[0.55]",
    text: "text-caution-soft-foreground",
    dot: "bg-caution",
  },
  danger: {
    badge: "border-transparent bg-danger-soft text-danger-soft-foreground",
    badgeOutline: "border-danger/25 bg-danger/[0.08] text-danger-soft-foreground",
    chip: "bg-danger-soft text-danger-soft-foreground",
    icon: "text-danger-soft-foreground",
    panel: "border-danger/20 bg-danger-soft text-danger-soft-foreground",
    row: "bg-danger-soft/[0.55]",
    text: "text-danger-soft-foreground",
    dot: "bg-danger",
  },
  discovery: {
    badge: "border-transparent bg-discovery-soft text-discovery-soft-foreground",
    badgeOutline: "border-discovery/25 bg-discovery/[0.08] text-discovery-soft-foreground",
    chip: "bg-discovery-soft text-discovery-soft-foreground",
    icon: "text-discovery-soft-foreground",
    panel: "border-discovery/20 bg-discovery-soft text-discovery-soft-foreground",
    row: "bg-discovery-soft/[0.55]",
    text: "text-discovery-soft-foreground",
    dot: "bg-discovery",
  },
  muted: {
    badge: "border-transparent bg-muted text-muted-foreground",
    badgeOutline: "border-border bg-surface text-muted-foreground",
    chip: "bg-muted text-muted-foreground",
    icon: mutedText,
    panel: "border-border bg-muted/35 text-muted-foreground",
    row: "bg-muted/25",
    text: mutedText,
    dot: "bg-muted-foreground",
  },
};

export function toneBadge(tone: SdkTone, className?: string) {
  return cn(sdkTone[tone].badge, className);
}

export function toneBadgeOutline(tone: SdkTone, className?: string) {
  return cn(sdkTone[tone].badgeOutline, className);
}

export function toneChip(tone: SdkTone, className?: string) {
  return cn(sdkTone[tone].chip, className);
}

export function toneIcon(tone: SdkTone, className?: string) {
  return cn(sdkTone[tone].icon, className);
}

export function tonePanel(tone: SdkTone, className?: string) {
  return cn(sdkTone[tone].panel, className);
}

export function toneRow(tone: SdkTone, className?: string) {
  return cn(sdkTone[tone].row, className);
}

export function toneText(tone: SdkTone, className?: string) {
  return cn(sdkTone[tone].text, className);
}

export function toneDot(tone: SdkTone, className?: string) {
  return cn(sdkTone[tone].dot, className);
}

export function toneFromStatus(status: string | undefined): SdkTone {
  const normalized = (status ?? "").toLowerCase();

  if (
    normalized.includes("fail") ||
    normalized.includes("reject") ||
    normalized.includes("critical") ||
    normalized.includes("blocked") ||
    normalized.includes("down") ||
    normalized.includes("expired") ||
    normalized.includes("missing") ||
    normalized.includes("overdue") ||
    normalized.includes("exception") ||
    normalized.includes("privilege")
  ) {
    return "danger";
  }

  if (
    normalized.includes("stale") ||
    normalized.includes("pending") ||
    normalized.includes("due") ||
    normalized.includes("drift") ||
    normalized.includes("approval") ||
    normalized.includes("hold") ||
    normalized.includes("assigned") ||
    normalized.includes("draft")
  ) {
    return "warning";
  }

  if (
    normalized.includes("accepted") ||
    normalized.includes("approved") ||
    normalized.includes("complete") ||
    normalized.includes("completed") ||
    normalized.includes("done") ||
    normalized.includes("executed") ||
    normalized.includes("filed") ||
    normalized.includes("healthy") ||
    normalized.includes("ingested") ||
    normalized.includes("materialized") ||
    normalized.includes("pass") ||
    normalized.includes("resolved") ||
    normalized.includes("signed") ||
    normalized.includes("verified")
  ) {
    return "success";
  }

  if (
    normalized.includes("create") ||
    normalized.includes("generated") ||
    normalized.includes("mapping") ||
    normalized.includes("proposal") ||
    normalized.includes("self-serve")
  ) {
    return "discovery";
  }

  if (
    normalized.includes("external") ||
    normalized.includes("extract") ||
    normalized.includes("request") ||
    normalized.includes("run") ||
    normalized.includes("submitted") ||
    normalized.includes("watch")
  ) {
    return "info";
  }

  if (normalized.includes("cancel") || normalized.includes("dormant")) {
    return "muted";
  }

  return "secondary";
}

export function readOklchToken(token: string) {
  if (typeof document === "undefined") return "currentColor";

  const value = window.getComputedStyle(document.documentElement).getPropertyValue(token).trim();
  return value ? ["oklch", "(", value, ")"].join("") : "currentColor";
}
