"use client";

import { useState } from "react";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/theme-toggle";
import { SealedMutationGuard, useFYLens } from "@/contexts/fy-lens-context";
import {
  useAppFrame,
  type DigestCadence,
  type DigestCategory,
} from "@/contexts/app-frame-context";
import type { GateRequest, User as UserType } from "@/lib/mock/types";
import { cn } from "@/lib/utils";

const currentYear = new Date().getFullYear();
const FISCAL_YEARS = Array.from({ length: 6 }, (_, i) => `FY${currentYear - i}`);
const PERIODS = ["Full year", "Q1", "Q2", "Q3", "Q4"];

const DIGEST_LABELS: Record<DigestCategory, string> = {
  findings: "Finding alerts",
  runs: "Run alerts",
  gates: "Gate alerts",
  sources: "Source alerts",
  obligations: "Obligation alerts",
};

const DIGEST_CADENCES: DigestCadence[] = ["immediate", "hourly", "daily", "muted"];

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
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function TopBar({
  gateCount,
  notificationCount,
  user,
  onAskOpen,
  className,
}: TopBarProps) {
  const [digestOpen, setDigestOpen] = useState(false);
  const [gateQueueOpen, setGateQueueOpen] = useState(false);
  const { fy, period, setFY, setPeriod } = useFYLens();
  const appFrame = useAppFrame();
  const resolvedUser = user ?? appFrame.currentUser;
  const resolvedGateCount = gateCount ?? appFrame.pendingGates.length;
  const resolvedNotificationCount = notificationCount ?? appFrame.unreadDigestCount;

  return (
    <header
      className={cn(
        "sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-surface px-3 tablet:gap-3 tablet:px-4",
        className,
      )}
    >
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="hidden max-w-[260px] gap-1 font-medium tablet:inline-flex"
            aria-label={`Workspace: ${appFrame.activeWorkspace.name}. Subgroup: ${appFrame.activeSubgroup.name}`}
          >
            <span className="truncate">{appFrame.activeWorkspace.name}</span>
            <span className="hidden max-w-[120px] truncate text-muted-foreground desktop:inline">
              {appFrame.activeSubgroup.name}
            </span>
            <ChevronDown size={14} className="text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-72">
          <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
          {appFrame.workspaces.map((workspace) => (
            <DropdownMenuItem
              key={workspace.id}
              onSelect={() => appFrame.setWorkspace(workspace.id)}
              className="flex-col items-start gap-0.5"
            >
              <span className="font-medium">{workspace.name}</span>
              <span className="text-xs text-muted-foreground">
                {workspace.subgroups.length} subgroups
              </span>
            </DropdownMenuItem>
          ))}

          <DropdownMenuSeparator />
          <DropdownMenuLabel>Subgroups</DropdownMenuLabel>
          {appFrame.activeWorkspace.subgroups.map((subgroup) => (
            <DropdownMenuItem
              key={subgroup.id}
              onSelect={() => appFrame.setSubgroup(subgroup.id)}
              className="flex-col items-start gap-0.5"
            >
              <span className="font-medium">{subgroup.name}</span>
              <span className="line-clamp-1 text-xs text-muted-foreground">
                {subgroup.description}
              </span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="mx-1 hidden h-4 w-px bg-border tablet:block" />

      <div className="flex min-w-0 items-center gap-1.5">
        <Select value={fy} onValueChange={setFY}>
          <SelectTrigger
            aria-label="Fiscal year"
            className="h-8 w-auto gap-1 border-0 bg-transparent px-2 text-sm font-medium shadow-none focus:ring-0"
          >
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

        <Select
          value={period ?? "Full year"}
          onValueChange={(nextPeriod) => setPeriod(nextPeriod === "Full year" ? null : nextPeriod)}
        >
          <SelectTrigger
            aria-label="Fiscal period"
            className="hidden h-8 w-auto gap-1 border-0 bg-transparent px-2 text-sm text-muted-foreground shadow-none focus:ring-0 tablet:flex"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIODS.map((value) => (
              <SelectItem key={value} value={value}>
                {value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex-1" />

      <Button
        variant="outline"
        size="sm"
        className="h-8 gap-2 text-muted-foreground"
        onClick={onAskOpen}
        aria-label="Ask the Record"
      >
        <Command size={13} />
        <span className="hidden text-sm tablet:block">Ask</span>
        <kbd className="hidden rounded border border-border bg-secondary px-1 text-[10px] tablet:block">
          Ctrl K
        </kbd>
      </Button>

      {resolvedGateCount > 0 && (
        <Sheet open={gateQueueOpen} onOpenChange={setGateQueueOpen}>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-muted-foreground hover:text-foreground"
            aria-label={`${resolvedGateCount} pending gates`}
            onClick={() => setGateQueueOpen(true)}
          >
            <Shield size={13} />
            <span className="text-xs font-semibold">{resolvedGateCount}</span>
          </Button>
          <GateQueueSheet gates={appFrame.pendingGates} />
        </Sheet>
      )}

      <Sheet open={digestOpen} onOpenChange={setDigestOpen}>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-8 w-8"
          aria-label={
            resolvedNotificationCount > 0
              ? `Notifications, ${resolvedNotificationCount} unread`
              : "Notifications, none unread"
          }
          onClick={() => setDigestOpen(true)}
        >
          <Bell size={16} />
          {resolvedNotificationCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -right-0.5 -top-0.5 h-4 min-w-4 px-1 text-[10px]"
            >
              {resolvedNotificationCount}
            </Badge>
          )}
        </Button>
        <DigestCenterSheet />
      </Sheet>

      <ThemeToggle />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" aria-label="User menu">
            <Avatar className="h-7 w-7">
              <AvatarFallback className="text-[11px] font-medium">
                {resolvedUser ? initials(resolvedUser.name) : <User size={14} />}
              </AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col gap-0.5">
              <p className="text-sm font-medium">{resolvedUser.name}</p>
              <p className="text-xs text-muted-foreground">{resolvedUser.email}</p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem>
            <Settings className="mr-2 h-4 w-4" />
            Delegation settings
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-danger-soft-foreground focus:text-danger-soft-foreground">
            <LogOut className="mr-2 h-4 w-4" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}

function DigestCenterSheet() {
  const appFrame = useAppFrame();
  const unreadCount = appFrame.digestItems.filter((item) => !item.read).length;

  return (
    <SheetContent className="flex w-[420px] flex-col p-0 sm:max-w-[420px]">
      <SheetHeader className="border-b border-border px-5 py-4">
        <SheetTitle>Digest Center</SheetTitle>
        <SheetDescription>
          Route record changes into the cadence that matches how your team reviews work.
        </SheetDescription>
      </SheetHeader>

      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <span className="text-sm text-muted-foreground">
          {unreadCount > 0 ? `${unreadCount} unread items` : "All digest items read"}
        </span>
        <Button size="sm" variant="outline" onClick={appFrame.markAllDigestRead}>
          Mark all read
        </Button>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-5 p-5">
          <section className="space-y-2">
            <h3 className="text-sm font-semibold">Latest changes</h3>
            <div className="space-y-2">
              {appFrame.digestItems.map((item) => (
                <article
                  key={item.id}
                  className={cn(
                    "rounded-md border border-border bg-card p-3",
                    item.read && "opacity-65",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{item.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{item.summary}</p>
                    </div>
                    {!item.read && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 shrink-0 px-2 text-xs"
                        onClick={() => appFrame.markDigestRead(item.id)}
                      >
                        Read
                      </Button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="space-y-2">
            <h3 className="text-sm font-semibold">Cadence</h3>
            <div className="space-y-2">
              {appFrame.digestCadence.map((setting) => (
                <div key={setting.category} className="rounded-md border border-border bg-card p-3">
                  <p className="text-sm font-medium">
                    {DIGEST_LABELS[setting.category]}: {setting.cadence}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {DIGEST_CADENCES.map((cadence) => (
                      <Button
                        key={cadence}
                        size="sm"
                        variant={setting.cadence === cadence ? "default" : "outline"}
                        className="h-7 px-2 text-xs"
                        onClick={() => appFrame.setDigestCadence(setting.category, cadence)}
                      >
                        {cadence}
                      </Button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </ScrollArea>
    </SheetContent>
  );
}

function GateQueueSheet({ gates }: { gates: GateRequest[] }) {
  const appFrame = useAppFrame();

  return (
    <SheetContent className="flex w-[460px] flex-col p-0 sm:max-w-[460px]">
      <SheetHeader className="border-b border-border px-5 py-4">
        <SheetTitle>Gate Queue</SheetTitle>
        <SheetDescription>
          Review pending gates and advance the record when the evidence is ready.
        </SheetDescription>
      </SheetHeader>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-3 p-5">
          {gates.length === 0 && (
            <p className="rounded-md border border-border bg-card p-4 text-sm text-muted-foreground">
              No gates are pending.
            </p>
          )}

          {gates.map((gate) => (
            <article key={gate.id} className="rounded-md border border-border bg-card p-4">
              <div className="space-y-1">
                <p className="text-sm font-semibold">{gate.objectName}</p>
                <p className="text-xs text-muted-foreground">
                  {gate.objectType} gate, {gate.slaHours} hour SLA, escalation {gate.escalationPath}
                </p>
                {gate.delegateId && (
                  <Badge variant="secondary" className="mt-1">
                    Delegated to {gate.delegateId}
                  </Badge>
                )}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <SealedMutationGuard>
                  <Button
                    size="sm"
                    onClick={() => appFrame.approveGate(gate.id)}
                    aria-label={`Approve ${gate.objectName}`}
                  >
                    Approve
                  </Button>
                </SealedMutationGuard>
                <SealedMutationGuard>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => appFrame.requestGateChanges(gate.id)}
                    aria-label={`Request changes for ${gate.objectName}`}
                  >
                    Request changes
                  </Button>
                </SealedMutationGuard>
                <SealedMutationGuard>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => appFrame.delegateGate(gate.id, appFrame.currentUser.id)}
                    aria-label={`Delegate ${gate.objectName}`}
                  >
                    Delegate
                  </Button>
                </SealedMutationGuard>
                <SealedMutationGuard>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => appFrame.rejectGate(gate.id)}
                    aria-label={`Reject ${gate.objectName}`}
                  >
                    Reject
                  </Button>
                </SealedMutationGuard>
              </div>
            </article>
          ))}
        </div>
      </ScrollArea>
    </SheetContent>
  );
}
