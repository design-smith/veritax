"use client";

import { Bell, ChevronDown, Command, LogOut, Settings, Shield, User } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useFYLens } from "@/contexts/fy-lens-context";
import { ThemeToggle } from "@/components/theme-toggle";
import type { User as UserType } from "@/lib/mock/types";
import { cn } from "@/lib/utils";

const currentYear = new Date().getFullYear();
const FISCAL_YEARS = Array.from({ length: 6 }, (_, i) => `FY${currentYear - i}`);
const PERIODS = ["Full year", "Q1", "Q2", "Q3", "Q4"];

interface TopBarProps {
  gateCount?: number;
  notificationCount?: number;
  user?: Pick<UserType, "id" | "name" | "email" | "role">;
  onAskOpen?: () => void;
  className?: string;
}

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function TopBar({
  gateCount = 0,
  notificationCount = 0,
  user,
  onAskOpen,
  className,
}: TopBarProps) {
  const { fy, setFY } = useFYLens();

  return (
    <header
      className={cn(
        "sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background px-4",
        className,
      )}
    >
      {/* Workspace switcher (stub) */}
      <Button variant="ghost" size="sm" className="gap-1 font-medium">
        Veritax Group
        <ChevronDown size={14} className="text-muted-foreground" />
      </Button>

      <div className="mx-1 h-4 w-px bg-border" />

      {/* FY Lens */}
      <div className="flex items-center gap-1.5">
        <Select value={fy} onValueChange={setFY}>
          <SelectTrigger className="h-8 w-auto gap-1 border-0 bg-transparent px-2 text-sm font-medium shadow-none focus:ring-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FISCAL_YEARS.map((year) => (
              <SelectItem key={year} value={year}>
                {year}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select defaultValue="Full year">
          <SelectTrigger className="h-8 w-auto gap-1 border-0 bg-transparent px-2 text-sm text-muted-foreground shadow-none focus:ring-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIODS.map((p) => (
              <SelectItem key={p} value={p}>
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Ask / ⌘K */}
      <Button
        variant="outline"
        size="sm"
        className="h-8 gap-2 text-muted-foreground"
        onClick={onAskOpen}
        aria-label="Ask the Record"
      >
        <Command size={13} />
        <span className="hidden text-sm tablet:block">Ask</span>
        <kbd className="hidden rounded border border-border bg-muted px-1 text-[10px] tablet:block">
          ⌘K
        </kbd>
      </Button>

      {/* Pending-gates chip */}
      {gateCount > 0 && (
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 text-amber-600 hover:text-amber-700 dark:text-amber-400"
          aria-label={`${gateCount} pending gates`}
        >
          <Shield size={13} />
          <span className="text-xs font-semibold">{gateCount}</span>
        </Button>
      )}

      {/* Notifications bell */}
      <Button
        variant="ghost"
        size="icon"
        className="relative h-8 w-8"
        aria-label="Notifications"
      >
        <Bell size={16} />
        {notificationCount > 0 && (
          <Badge
            variant="destructive"
            className="absolute -right-0.5 -top-0.5 h-4 min-w-4 px-1 text-[10px]"
          >
            {notificationCount}
          </Badge>
        )}
      </Button>

      {/* Theme toggle */}
      <ThemeToggle />

      {/* User menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" aria-label="User menu">
            <Avatar className="h-7 w-7">
              <AvatarFallback className="text-[11px] font-medium">
                {user ? initials(user.name) : <User size={14} />}
              </AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {user && (
            <>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col gap-0.5">
                  <p className="text-sm font-medium">{user.name}</p>
                  <p className="text-xs text-muted-foreground">{user.email}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
            </>
          )}
          <DropdownMenuItem><Settings className="mr-2 h-4 w-4" />Delegation settings</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-destructive focus:text-destructive">
            <LogOut className="mr-2 h-4 w-4" />Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
