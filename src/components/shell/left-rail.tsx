"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Bell,
  BookOpen,
  Building2,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Cpu,
  FileText,
  Gauge,
  Network,
  Settings,
  TriangleAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { usePermission } from "@/contexts/permissions-context";

export interface LeftRailBadges {
  findings?: number;
  gates?: number;
  queue?: number;
  obligations?: number;
}

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  badgeKey?: keyof LeftRailBadges;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Briefing",     href: "/briefing",     icon: Gauge,        badgeKey: "gates" },
  { label: "Graph",        href: "/graph",         icon: Network },
  { label: "Findings",     href: "/findings",      icon: TriangleAlert, badgeKey: "findings" },
  { label: "Documents",    href: "/documents",     icon: FileText,     badgeKey: "queue" },
  { label: "Monitor",      href: "/monitor",       icon: BarChart3 },
  { label: "Calendar",     href: "/calendar",      icon: CalendarDays, badgeKey: "obligations" },
  { label: "Library",      href: "/library",       icon: BookOpen },
  { label: "Commitments",  href: "/commitments",   icon: Bell },
  { label: "Runs",         href: "/runs",          icon: Cpu },
  { label: "Connectors",   href: "/connectors",    icon: Building2 },
];

const ADMIN_ITEM: NavItem = { label: "Admin", href: "/admin", icon: Settings };

interface LeftRailProps {
  badges?: LeftRailBadges;
  currentPath?: string;
}

export function LeftRail({ badges = {}, currentPath }: LeftRailProps) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const activePath = currentPath ?? pathname;
  const adminPermission = usePermission("view_admin");

  const items = adminPermission === "allowed" ? [...NAV_ITEMS, ADMIN_ITEM] : NAV_ITEMS;

  return (
    <TooltipProvider>
      <aside
        className={cn(
          "flex h-[100dvh] shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground",
          "sticky top-0 transition-all duration-300 ease-in-out",
          collapsed ? "w-14" : "w-14 tablet:w-52",
        )}
      >
        {/* Logo / brand */}
        <div className={cn("flex h-14 items-center border-b border-border px-3", collapsed && "justify-center")}>
          <FileText className="h-5 w-5 shrink-0 text-sidebar-primary" />
          {!collapsed && (
            <span className="ml-2 hidden text-sm font-semibold tracking-tight tablet:inline">
              Veritax
            </span>
          )}
        </div>

        {/* Nav */}
        <nav aria-label="Primary" className="flex flex-1 flex-col gap-y-0.5 overflow-y-auto p-2">
          {items.map((item) => {
            const Icon = item.icon;
            const isActive = activePath === item.href || activePath.startsWith(item.href + "/");
            const count = item.badgeKey ? (badges[item.badgeKey] ?? 0) : 0;

            const linkContent = (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex items-center justify-center rounded-md px-2 py-1.5 transition-colors tablet:justify-start",
                  "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-hairline"
                    : "text-sidebar-foreground/75",
                  collapsed && "justify-center",
                )}
              >
                <Icon size={16} className="shrink-0" />
                {!collapsed && (
                  <>
                    <span className="ml-2 hidden text-sm tablet:inline">{item.label}</span>
                  </>
                )}
                {count > 0 && (
                  <Badge
                    variant="destructive"
                    className={cn(
                      "absolute right-1 top-1 h-3 min-w-3 px-0 text-[8px] tablet:static tablet:ml-auto tablet:h-4 tablet:min-w-4 tablet:px-1 tablet:text-[10px]",
                      collapsed &&
                        "tablet:absolute tablet:right-1 tablet:top-1 tablet:ml-0 tablet:h-3 tablet:min-w-3 tablet:px-0 tablet:text-[8px]",
                    )}
                  >
                    {count}
                  </Badge>
                )}
              </Link>
            );

            if (collapsed) {
              return (
                <Tooltip key={item.href}>
                  <TooltipTrigger asChild>
                    <div className="relative">{linkContent}</div>
                  </TooltipTrigger>
                  <TooltipContent side="right">{item.label}</TooltipContent>
                </Tooltip>
              );
            }

            return <div key={item.href} className="relative">{linkContent}</div>;
          })}
        </nav>

        {/* Collapse toggle */}
        <div className="hidden border-t border-border p-2 tablet:block">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-full justify-center rounded-md text-sidebar-foreground/65 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </Button>
        </div>
      </aside>
    </TooltipProvider>
  );
}
