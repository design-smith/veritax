"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navigations } from "@/config/site";
import { cn } from "@/lib/utils";

export default function Navigation() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-grow flex-col gap-y-1 p-2">
      {navigations.map((navigation) => {
        const Icon = navigation.icon;
        return (
          <Link
            key={navigation.name}
            href={navigation.href}
            className={cn(
              "flex items-center rounded-md px-2 py-1.5 hover:bg-surface-secondary dark:hover:bg-surface-secondary",
              pathname === navigation.href
                ? "bg-surface-secondary dark:bg-surface-secondary"
                : "bg-transparent",
            )}
          >
            <Icon
              size={16}
              className="mr-2 text-muted-foreground dark:text-muted-foreground"
            />
            <span className="text-sm text-muted-foreground dark:text-muted-foreground">
              {navigation.name}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
