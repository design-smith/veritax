"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  Gauge,
  Network,
  Sprout,
  TriangleAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";

const DEMO_NAV = [
  { label: "Briefing", href: "/demo/briefing", icon: Gauge },
  { label: "Graph", href: "/demo/graph", icon: Network },
  { label: "Findings", href: "/demo/findings", icon: TriangleAlert },
  { label: "Library", href: "/demo/library", icon: BookOpen },
  { label: "Gathering", href: "/demo/gathering", icon: Sprout },
] as const;

export function DemoNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Demo navigation" className="flex flex-col gap-y-0.5">
      {DEMO_NAV.map(({ label, href, icon: Icon }) => {
        const isBriefingRoot = label === "Briefing" && pathname === "/demo";
        const isActive = isBriefingRoot || pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex items-center rounded-md px-2 py-1.5 text-sm transition-colors",
              "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              isActive
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/75",
            )}
          >
            <Icon size={16} className="shrink-0" />
            <span className="ml-2 hidden tablet:inline">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
