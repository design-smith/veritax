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
  { label: "Library",      href: "/library",       icon: BookOpen },
  { label: "Monitor",      href: "/monitor",       icon: BarChart3 },
  { label: "Calendar",     href: "/calendar",      icon: CalendarDays, badgeKey: "obligations" },
  { label: "Commitments",  href: "/commitments",   icon: Bell },
  { label: "Runs",         href: "/runs",          icon: Cpu },
  { label: "Connectors",   href: "/connectors",    icon: Building2 },
];

const ADMIN_ITEM: NavItem = { label: "Admin", href: "/admin", icon: Settings };

interface LeftRailProps {
  badges?: LeftRailBadges;
}

export function LeftRail({ badges = {} }: LeftRailProps) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const adminPermission = usePermission("view_admin");

  const items = adminPermission === "allowed" ? [...NAV_ITEMS, ADMIN_ITEM] : NAV_ITEMS;

  return (
    <TooltipProvider>
      <aside
        className={cn(
          "flex h-[100dvh] shrink-0 flex-col border-r border-border bg-slate-100 dark:bg-slate-900",
          "sticky top-0 transition-all duration-300 ease-in-out",
          collapsed ? "w-14" : "w-52",
        )}
      >
        {/* Logo / brand */}
        <div className={cn("flex h-14 items-center border-b border-border px-3", collapsed && "justify-center")}>
          <FileText className="h-5 w-5 shrink-0 text-primary" />
          {!collapsed && (
            <span className="ml-2 text-sm font-semibold tracking-tight">Veritax</span>
          )}
        </div>

        {/* Nav */}
        <nav className="flex flex-1 flex-col gap-y-0.5 overflow-y-auto p-2">
          {items.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            const count = item.badgeKey ? (badges[item.badgeKey] ?? 0) : 0;

            const linkContent = (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex items-center rounded-md px-2 py-1.5 transition-colors",
                  "hover:bg-slate-200 dark:hover:bg-slate-800",
                  isActive
                    ? "bg-slate-200 text-foreground dark:bg-slate-800"
                    : "text-slate-700 dark:text-slate-300",
                  collapsed && "justify-center",
                )}
              >
                <Icon size={16} className="shrink-0" />
                {!collapsed && (
                  <>
                    <span className="ml-2 text-sm">{item.label}</span>
                    {count > 0 && (
                      <Badge
                        variant="destructive"
                        className="ml-auto h-4 min-w-4 px-1 text-[10px]"
                      >
                        {count}
                      </Badge>
                    )}
                  </>
                )}
                {collapsed && count > 0 && (
                  <span className="absolute right-1 top-1 flex h-3 w-3 items-center justify-center rounded-full bg-destructive text-[8px] text-destructive-foreground">
                    {count}
                  </span>
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
        <div className="border-t border-border p-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-full justify-center rounded-md text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800"
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
