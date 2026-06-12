"use client";

import { useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Bell,
  Calendar as CalendarIcon,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Download,
  Edit,
  Eye,
  Filter,
  Grid,
  Heart,
  Home,
  Info,
  LayoutDashboard,
  List,
  Lock,
  LogOut,
  Mail,
  MessageSquare,
  Moon,
  MoreHorizontal,
  Palette,
  Plus,
  Search,
  Settings,
  Share,
  Star,
  Sun,
  Trash2,
  TriangleAlert,
  Upload,
  User,
  Users,
  X,
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { DatePickerWithRange } from "@/components/chart-blocks/charts/average-tickets-created/components/date-range-picker";
import AverageTicketsCreated from "@/components/chart-blocks/charts/average-tickets-created";
import TicketByChannels from "@/components/chart-blocks/charts/ticket-by-channels";
import Convertions from "@/components/chart-blocks/charts/conversions";
import CustomerSatisfication from "@/components/chart-blocks/charts/customer-satisfication";
import MetricsMetricCard from "@/components/chart-blocks/charts/metrics/components/metric-card";
import AvgMetricCard from "@/components/chart-blocks/charts/average-tickets-created/components/metric-card";

// ── helpers ────────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">{title}</h2>
        <Separator className="mt-2" />
      </div>
      {children}
    </section>
  );
}

function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-muted-foreground">{title}</p>
      {children}
    </div>
  );
}

const tableData = [
  { id: "TKT-001", subject: "Login not working", assignee: "Sarah K.", status: "open", priority: "high" },
  { id: "TKT-002", subject: "Payment failed on checkout", assignee: "James L.", status: "resolved", priority: "critical" },
  { id: "TKT-003", subject: "Missing invoice PDF", assignee: "Maria T.", status: "pending", priority: "medium" },
  { id: "TKT-004", subject: "Profile picture upload error", assignee: "Chris M.", status: "open", priority: "low" },
  { id: "TKT-005", subject: "2FA not sending SMS", assignee: "Sarah K.", status: "in-progress", priority: "high" },
];

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline" | "success" | "warning"> = {
  open: "default",
  resolved: "success",
  pending: "warning",
  "in-progress": "secondary",
};

const priorityVariant: Record<string, "default" | "secondary" | "destructive" | "outline" | "success" | "warning"> = {
  critical: "destructive",
  high: "warning",
  medium: "secondary",
  low: "outline",
};

const scrollItems = Array.from({ length: 20 }, (_, i) => ({
  id: i + 1,
  label: `Item ${i + 1}`,
  desc: `Description for item ${i + 1}`,
}));

// ── page ───────────────────────────────────────────────────────────────────

export default function DesignSystemPage() {
  const [calendarDate, setCalendarDate] = useState<Date | undefined>(new Date());
  const [dropdownChecked, setDropdownChecked] = useState(true);
  const [dropdownRadio, setDropdownRadio] = useState("light");

  return (
    <TooltipProvider>
      <div className="mx-auto max-w-5xl space-y-16 px-6 py-10 desktop:px-14">

        {/* ── 1. Colors ───────────────────────────────────────────────── */}
        <Section title="Colors">
          <div className="grid gap-8 tablet:grid-cols-2">
            <SubSection title="Semantic tokens">
              <div className="space-y-2">
                {[
                  { name: "background", value: "hsl(0 0% 100%)", cls: "bg-background border" },
                  { name: "foreground", value: "hsl(222.2 84% 4.9%)", cls: "bg-foreground" },
                  { name: "primary", value: "hsl(225 100% 50%)", cls: "bg-primary" },
                  { name: "primary-foreground", value: "hsl(210 40% 98%)", cls: "bg-primary-foreground border" },
                  { name: "secondary", value: "hsl(210 40% 96.1%)", cls: "bg-secondary" },
                  { name: "secondary-foreground", value: "hsl(222.2 47.4% 11.2%)", cls: "bg-secondary-foreground" },
                  { name: "muted", value: "hsl(210 40% 96.1%)", cls: "bg-muted" },
                  { name: "muted-foreground", value: "hsl(215.4 16.3% 46.9%)", cls: "bg-muted-foreground" },
                  { name: "accent", value: "hsl(210 40% 96.1%)", cls: "bg-accent border" },
                  { name: "destructive", value: "hsl(0 84.2% 60.2%)", cls: "bg-destructive" },
                  { name: "border", value: "hsl(214.3 31.8% 94.4%)", cls: "bg-border" },
                  { name: "input", value: "hsl(214.3 31.8% 91.4%)", cls: "bg-input" },
                  { name: "card", value: "hsl(0 0% 100%)", cls: "bg-card border" },
                ].map(({ name, value, cls }) => (
                  <div key={name} className="flex items-center gap-3">
                    <div className={`h-8 w-8 shrink-0 rounded-md ${cls}`} />
                    <div>
                      <p className="text-sm font-medium">{name}</p>
                      <p className="text-xs text-muted-foreground">{value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </SubSection>

            <div className="space-y-8">
              <SubSection title="Chart palette — Light / Dark">
                <div className="space-y-2">
                  {[
                    { name: "chart-1", light: "#e8724a", dark: "#2563eb", lv: "hsl(12 76% 61%)", dv: "hsl(220 70% 50%)" },
                    { name: "chart-2", light: "#29a583", dark: "#2ecc96", lv: "hsl(173 58% 39%)", dv: "hsl(160 60% 45%)" },
                    { name: "chart-3", light: "#27576e", dark: "#e87c2e", lv: "hsl(197 37% 24%)", dv: "hsl(30 80% 55%)" },
                    { name: "chart-4", light: "#e8c44a", dark: "#9b5de5", lv: "hsl(43 74% 66%)", dv: "hsl(280 65% 60%)" },
                    { name: "chart-5", light: "#e8903a", dark: "#e5235e", lv: "hsl(27 87% 67%)", dv: "hsl(340 75% 55%)" },
                  ].map(({ name, light, dark, lv, dv }) => (
                    <div key={name} className="flex items-center gap-3">
                      <div className="flex gap-1">
                        <div className="h-8 w-8 shrink-0 rounded-md" style={{ background: light }} title={`Light: ${lv}`} />
                        <div className="h-8 w-8 shrink-0 rounded-md" style={{ background: dark }} title={`Dark: ${dv}`} />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{name}</p>
                        <p className="text-xs text-muted-foreground">L: {lv}</p>
                        <p className="text-xs text-muted-foreground">D: {dv}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </SubSection>

              <SubSection title="Slate palette (nav surface)">
                <div className="flex flex-wrap gap-2">
                  {[
                    { shade: "100", hex: "#f1f5f9" },
                    { shade: "200", hex: "#e2e8f0" },
                    { shade: "300", hex: "#cbd5e1" },
                    { shade: "700", hex: "#334155" },
                    { shade: "800", hex: "#1e293b" },
                    { shade: "900", hex: "#0f172a" },
                  ].map(({ shade, hex }) => (
                    <div key={shade} className="flex flex-col items-center gap-1">
                      <div className="h-10 w-10 rounded-md border" style={{ background: hex }} />
                      <span className="text-xs text-muted-foreground">{shade}</span>
                    </div>
                  ))}
                </div>
              </SubSection>

              <SubSection title="Satisfaction palette (charts)">
                <div className="flex flex-wrap gap-3">
                  {[
                    { name: "Positive", hex: "#5fb67a" },
                    { name: "Neutral", hex: "#f5c36e" },
                    { name: "Negative", hex: "#da6d67" },
                  ].map(({ name, hex }) => (
                    <div key={name} className="flex flex-col items-center gap-1">
                      <div className="h-10 w-10 rounded-md" style={{ background: hex }} />
                      <span className="text-xs text-muted-foreground">{name}</span>
                    </div>
                  ))}
                </div>
              </SubSection>
            </div>
          </div>
        </Section>

        {/* ── 2. Typography ───────────────────────────────────────────── */}
        <Section title="Typography">
          <div className="rounded-lg border bg-card p-6 space-y-5">
            <div>
              <p className="mb-1 text-xs text-muted-foreground">Font family — Gabarito (Google Fonts) · var(--font-gabarito)</p>
              <p className="text-base">ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz 0123456789</p>
            </div>
            <Separator />
            <div className="space-y-3">
              {[
                { cls: "text-xs", label: "text-xs — 12px" },
                { cls: "text-sm", label: "text-sm — 14px" },
                { cls: "text-base", label: "text-base — 16px" },
                { cls: "text-lg", label: "text-lg — 18px" },
                { cls: "text-xl", label: "text-xl — 20px" },
                { cls: "text-2xl", label: "text-2xl — 24px" },
                { cls: "text-3xl", label: "text-3xl — 30px" },
                { cls: "text-4xl", label: "text-4xl — 36px" },
              ].map(({ cls, label }) => (
                <div key={cls} className="flex items-baseline gap-4">
                  <span className="w-40 shrink-0 text-xs text-muted-foreground">{label}</span>
                  <p className={cls}>The quick brown fox</p>
                </div>
              ))}
            </div>
            <Separator />
            <div className="space-y-2">
              <p className="text-base font-normal">font-normal — Regular 400</p>
              <p className="text-base font-medium">font-medium — Medium 500</p>
              <p className="text-base font-semibold">font-semibold — SemiBold 600</p>
              <p className="text-base font-bold">font-bold — Bold 700</p>
            </div>
          </div>
        </Section>

        {/* ── 3. Spacing & Layout ─────────────────────────────────────── */}
        <Section title="Spacing & Layout">
          <div className="rounded-lg border bg-card p-6 space-y-6">
            <SubSection title="Border Radius">
              <div className="flex flex-wrap gap-6 items-end">
                {[
                  { name: "none", cls: "rounded-none", value: "0px" },
                  { name: "sm", cls: "rounded-sm", value: "4px" },
                  { name: "md", cls: "rounded-md", value: "6px" },
                  { name: "lg (--radius)", cls: "rounded-lg", value: "8px" },
                  { name: "xl", cls: "rounded-xl", value: "12px" },
                  { name: "2xl", cls: "rounded-2xl", value: "16px" },
                  { name: "full", cls: "rounded-full", value: "9999px" },
                ].map(({ name, cls, value }) => (
                  <div key={name} className="flex flex-col items-center gap-1">
                    <div className={`h-12 w-16 border-2 border-primary bg-primary/10 ${cls}`} />
                    <span className="text-xs font-medium">{name}</span>
                    <span className="text-xs text-muted-foreground">{value}</span>
                  </div>
                ))}
              </div>
            </SubSection>
            <Separator />
            <SubSection title="Breakpoints">
              <div className="space-y-1.5">
                {[
                  { name: "phone", value: "370px", desc: "Small phones" },
                  { name: "tablet", value: "750px", desc: "Tablets, landscape phones" },
                  { name: "laptop", value: "1000px", desc: "Laptops" },
                  { name: "desktop", value: "1200px", desc: "Desktops" },
                  { name: "2xl (container max)", value: "1400px", desc: "Wide screens" },
                ].map(({ name, value, desc }) => (
                  <div key={name} className="flex items-center gap-3">
                    <code className="w-36 shrink-0 rounded bg-muted px-1.5 py-0.5 text-xs font-mono">{name}</code>
                    <span className="w-20 shrink-0 text-sm font-medium">{value}</span>
                    <span className="text-sm text-muted-foreground">{desc}</span>
                  </div>
                ))}
              </div>
            </SubSection>
            <Separator />
            <SubSection title="Container Padding">
              <div className="space-y-1 text-sm text-muted-foreground">
                <p>Default: <code className="rounded bg-muted px-1 text-xs">px-6</code> (24px)</p>
                <p>tablet+: <code className="rounded bg-muted px-1 text-xs">px-10</code> (40px)</p>
                <p>desktop+: <code className="rounded bg-muted px-1 text-xs">px-14</code> (56px)</p>
              </div>
            </SubSection>
            <Separator />
            <SubSection title="Common Spacing Scale">
              <div className="flex items-end gap-3 flex-wrap">
                {[1, 2, 3, 4, 6, 8, 10, 12, 16, 20, 24].map((n) => (
                  <div key={n} className="flex flex-col items-center gap-1">
                    <div className="bg-primary/20 border border-primary/40" style={{ width: `${n * 4}px`, height: `${n * 4}px` }} />
                    <span className="text-xs text-muted-foreground">{n}</span>
                    <span className="text-xs text-muted-foreground">{n * 4}px</span>
                  </div>
                ))}
              </div>
            </SubSection>
          </div>
        </Section>

        {/* ── 4. Icons ────────────────────────────────────────────────── */}
        <Section title="Icons">
          <div className="rounded-lg border bg-card p-6 space-y-4">
            <p className="text-sm text-muted-foreground">
              Powered by <strong>Lucide React</strong>. All icons accept a <code className="rounded bg-muted px-1 text-xs">size</code> prop and inherit <code className="rounded bg-muted px-1 text-xs">currentColor</code>.
            </p>
            <SubSection title="Size variants">
              <div className="flex items-end gap-6">
                {[12, 16, 20, 24, 32].map((size) => (
                  <div key={size} className="flex flex-col items-center gap-1">
                    <Settings size={size} />
                    <span className="text-xs text-muted-foreground">{size}px</span>
                  </div>
                ))}
              </div>
            </SubSection>
            <SubSection title="Icon library (sample)">
              <div className="grid grid-cols-6 gap-4 tablet:grid-cols-9">
                {[
                  { Icon: LayoutDashboard, name: "LayoutDashboard" },
                  { Icon: MessageSquare, name: "MessageSquare" },
                  { Icon: Palette, name: "Palette" },
                  { Icon: Settings, name: "Settings" },
                  { Icon: Users, name: "Users" },
                  { Icon: Bell, name: "Bell" },
                  { Icon: Search, name: "Search" },
                  { Icon: Plus, name: "Plus" },
                  { Icon: Trash2, name: "Trash2" },
                  { Icon: Edit, name: "Edit" },
                  { Icon: Eye, name: "Eye" },
                  { Icon: Download, name: "Download" },
                  { Icon: Upload, name: "Upload" },
                  { Icon: Share, name: "Share" },
                  { Icon: Lock, name: "Lock" },
                  { Icon: ChevronDown, name: "ChevronDown" },
                  { Icon: ChevronRight, name: "ChevronRight" },
                  { Icon: ArrowRight, name: "ArrowRight" },
                  { Icon: ArrowLeft, name: "ArrowLeft" },
                  { Icon: Check, name: "Check" },
                  { Icon: X, name: "X" },
                  { Icon: Info, name: "Info" },
                  { Icon: AlertCircle, name: "AlertCircle" },
                  { Icon: CheckCircle2, name: "CheckCircle2" },
                  { Icon: TriangleAlert, name: "TriangleAlert" },
                  { Icon: User, name: "User" },
                  { Icon: Mail, name: "Mail" },
                  { Icon: CalendarIcon, name: "Calendar" },
                  { Icon: Star, name: "Star" },
                  { Icon: Heart, name: "Heart" },
                  { Icon: Home, name: "Home" },
                  { Icon: Grid, name: "Grid" },
                  { Icon: List, name: "List" },
                  { Icon: Filter, name: "Filter" },
                  { Icon: MoreHorizontal, name: "More" },
                  { Icon: LogOut, name: "LogOut" },
                  { Icon: Moon, name: "Moon" },
                  { Icon: Sun, name: "Sun" },
                  { Icon: ArrowUpRight, name: "ArrowUpRight" },
                ].map(({ Icon, name }) => (
                  <div key={name} className="flex flex-col items-center gap-1.5">
                    <Icon size={20} className="text-foreground" />
                    <span className="text-center text-[9px] text-muted-foreground leading-tight">{name}</span>
                  </div>
                ))}
              </div>
            </SubSection>
          </div>
        </Section>

        {/* ── 5. Button ───────────────────────────────────────────────── */}
        <Section title="Button">
          <div className="rounded-lg border bg-card p-6 space-y-5">
            <SubSection title="Variants">
              <div className="flex flex-wrap gap-3">
                <Button variant="default">Default</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="destructive">Destructive</Button>
                <Button variant="outline">Outline</Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="link">Link</Button>
              </div>
            </SubSection>
            <Separator />
            <SubSection title="Sizes">
              <div className="flex flex-wrap items-center gap-3">
                <Button size="sm">Small</Button>
                <Button size="default">Default</Button>
                <Button size="lg">Large</Button>
                <Button size="icon" variant="outline"><Settings className="h-4 w-4" /></Button>
                <Button size="icon" variant="default"><Plus className="h-4 w-4" /></Button>
              </div>
            </SubSection>
            <Separator />
            <SubSection title="With icons">
              <div className="flex flex-wrap gap-3">
                <Button><Plus className="h-4 w-4" />New Ticket</Button>
                <Button variant="outline"><Download className="h-4 w-4" />Export</Button>
                <Button variant="secondary"><Share className="h-4 w-4" />Share</Button>
              </div>
            </SubSection>
            <Separator />
            <SubSection title="States">
              <div className="flex flex-wrap gap-3">
                <Button disabled>Disabled</Button>
                <Button variant="outline" disabled>Disabled outline</Button>
                <Button variant="destructive" disabled>Disabled destructive</Button>
              </div>
            </SubSection>
          </div>
        </Section>

        {/* ── 6. Badge ────────────────────────────────────────────────── */}
        <Section title="Badge">
          <div className="rounded-lg border bg-card p-6">
            <div className="flex flex-wrap gap-3">
              <Badge>Default</Badge>
              <Badge variant="secondary">Secondary</Badge>
              <Badge variant="destructive">Destructive</Badge>
              <Badge variant="outline">Outline</Badge>
              <Badge variant="success">Success</Badge>
              <Badge variant="warning">Warning</Badge>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <span className="text-xs text-muted-foreground">In context:</span>
              <Badge>New</Badge>
              <Badge variant="success">Active</Badge>
              <Badge variant="warning">Pending</Badge>
              <Badge variant="destructive">Critical</Badge>
              <Badge variant="secondary">In Progress</Badge>
              <Badge variant="outline">Draft</Badge>
            </div>
          </div>
        </Section>

        {/* ── 7. Avatar ───────────────────────────────────────────────── */}
        <Section title="Avatar">
          <div className="rounded-lg border bg-card p-6">
            <div className="flex flex-wrap items-end gap-6">
              {[
                { size: "h-6 w-6", label: "xs", textCls: "text-[9px]" },
                { size: "h-8 w-8", label: "sm", textCls: "text-xs" },
                { size: "h-10 w-10", label: "md", textCls: "text-sm" },
                { size: "h-12 w-12", label: "lg", textCls: "text-base" },
                { size: "h-16 w-16", label: "xl", textCls: "text-lg" },
              ].map(({ size, label, textCls }) => (
                <div key={label} className="flex flex-col items-center gap-2">
                  <Avatar className={size}>
                    <AvatarImage src="/avatar.png" alt="User" />
                    <AvatarFallback className={textCls}>JD</AvatarFallback>
                  </Avatar>
                  <span className="text-xs text-muted-foreground">{label}</span>
                </div>
              ))}
              <div className="flex flex-col items-center gap-2">
                <Avatar className="h-10 w-10">
                  <AvatarFallback>AB</AvatarFallback>
                </Avatar>
                <span className="text-xs text-muted-foreground">fallback</span>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <div className="flex -space-x-2">
                {["JD", "AB", "KL", "MN"].map((initials) => (
                  <Avatar key={initials} className="h-8 w-8 border-2 border-background">
                    <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                  </Avatar>
                ))}
              </div>
              <span className="text-sm text-muted-foreground">Avatar stack</span>
            </div>
          </div>
        </Section>

        {/* ── 8. Card ─────────────────────────────────────────────────── */}
        <Section title="Card">
          <div className="grid gap-4 tablet:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Basic Card</CardTitle>
                <CardDescription>With header, content, and footer.</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Card body content. Use for any grouping of related info.</p>
              </CardContent>
              <CardFooter className="gap-2">
                <Button size="sm">Confirm</Button>
                <Button size="sm" variant="outline">Cancel</Button>
              </CardFooter>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Resolved Tickets</CardTitle>
                <CardDescription>Last 30 days</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold">18,208</p>
                <Badge variant="success" className="mt-2">+8%</Badge>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Active Users</CardTitle>
                  <Users size={16} className="text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">2,847</p>
                <p className="text-xs text-muted-foreground mt-1">+180 since last hour</p>
              </CardContent>
            </Card>
          </div>
        </Section>

        {/* ── 9. Forms ────────────────────────────────────────────────── */}
        <Section title="Form Inputs">
          <div className="rounded-lg border bg-card p-6 space-y-6">
            <div className="grid gap-4 tablet:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="ds-input-default">Input — default</Label>
                <Input id="ds-input-default" placeholder="Enter value..." />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ds-input-disabled">Input — disabled</Label>
                <Input id="ds-input-disabled" placeholder="Disabled" disabled />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ds-input-email">Input — with icon context</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input id="ds-input-email" className="pl-9" placeholder="name@company.com" type="email" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ds-input-search">Input — search</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input id="ds-input-search" className="pl-9" placeholder="Search tickets..." />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ds-textarea">Textarea</Label>
              <Textarea id="ds-textarea" placeholder="Describe the issue in detail..." rows={3} />
            </div>
            <div className="grid gap-4 tablet:grid-cols-2">
              <div className="space-y-2">
                <Label>Select</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Select — disabled</Label>
                <Select disabled>
                  <SelectTrigger>
                    <SelectValue placeholder="Disabled" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="x">Option</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-6 tablet:grid-cols-3">
              <div className="space-y-3">
                <Label>Checkbox</Label>
                <div className="space-y-2">
                  {["Accept terms of service", "Subscribe to updates", "Enable notifications"].map((label) => (
                    <div key={label} className="flex items-center gap-2">
                      <Checkbox id={`check-${label}`} />
                      <Label htmlFor={`check-${label}`} className="font-normal">{label}</Label>
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-3">
                <Label>Radio Group</Label>
                <RadioGroup defaultValue="light">
                  {["Light", "Dark", "System"].map((opt) => (
                    <div key={opt} className="flex items-center gap-2">
                      <RadioGroupItem value={opt.toLowerCase()} id={`radio-${opt}`} />
                      <Label htmlFor={`radio-${opt}`} className="font-normal">{opt}</Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>
              <div className="space-y-3">
                <Label>Switch</Label>
                <div className="space-y-3">
                  {[
                    { label: "Dark mode", id: "sw-dark" },
                    { label: "Email alerts", id: "sw-email" },
                    { label: "Auto-assign", id: "sw-auto" },
                  ].map(({ label, id }) => (
                    <div key={id} className="flex items-center gap-3">
                      <Switch id={id} />
                      <Label htmlFor={id} className="font-normal">{label}</Label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <Separator />
            <SubSection title="Complete form example">
              <Card>
                <CardHeader>
                  <CardTitle>Create Ticket</CardTitle>
                  <CardDescription>Fill in the details to open a new support ticket.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 tablet:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="form-name">Full name</Label>
                      <Input id="form-name" placeholder="John Doe" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="form-email">Email</Label>
                      <Input id="form-email" placeholder="john@company.com" type="email" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Priority</Label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="Select priority" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="form-desc">Description</Label>
                    <Textarea id="form-desc" placeholder="Describe the issue..." rows={4} />
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch id="form-notify" />
                    <Label htmlFor="form-notify" className="font-normal">Notify me when status changes</Label>
                  </div>
                </CardContent>
                <CardFooter className="gap-2">
                  <Button>Submit Ticket</Button>
                  <Button variant="outline">Cancel</Button>
                </CardFooter>
              </Card>
            </SubSection>
          </div>
        </Section>

        {/* ── 10. Dropdown Menu ───────────────────────────────────────── */}
        <Section title="Dropdown Menu">
          <div className="rounded-lg border bg-card p-6 space-y-4">
            <div className="flex flex-wrap gap-4">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline">Actions <ChevronDown className="h-4 w-4" /></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56">
                  <DropdownMenuLabel>Ticket</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem><Eye className="mr-2 h-4 w-4" />View details</DropdownMenuItem>
                  <DropdownMenuItem><Edit className="mr-2 h-4 w-4" />Edit<DropdownMenuShortcut>⌘E</DropdownMenuShortcut></DropdownMenuItem>
                  <DropdownMenuItem><Share className="mr-2 h-4 w-4" />Share<DropdownMenuShortcut>⌘S</DropdownMenuShortcut></DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuCheckboxItem checked={dropdownChecked} onCheckedChange={setDropdownChecked}>
                    Mark as urgent
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-destructive focus:text-destructive">
                    <Trash2 className="mr-2 h-4 w-4" />Delete<DropdownMenuShortcut>⌫</DropdownMenuShortcut>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline">Theme <ChevronDown className="h-4 w-4" /></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuLabel>Appearance</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuRadioGroup value={dropdownRadio} onValueChange={setDropdownRadio}>
                    <DropdownMenuRadioItem value="light"><Sun className="mr-2 h-4 w-4" />Light</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="dark"><Moon className="mr-2 h-4 w-4" />Dark</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="system">System</DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="icon" variant="outline"><MoreHorizontal className="h-4 w-4" /></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem>Profile</DropdownMenuItem>
                  <DropdownMenuItem>Settings</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-destructive focus:text-destructive">
                    <LogOut className="mr-2 h-4 w-4" />Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </Section>

        {/* ── 11. Popover ─────────────────────────────────────────────── */}
        <Section title="Popover">
          <div className="rounded-lg border bg-card p-6 space-y-4">
            <div className="flex flex-wrap gap-4">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline">Open popover</Button>
                </PopoverTrigger>
                <PopoverContent className="w-80">
                  <div className="space-y-3">
                    <h4 className="font-medium">Quick assign</h4>
                    <p className="text-sm text-muted-foreground">Assign this ticket to a team member.</p>
                    <div className="space-y-2">
                      <Label htmlFor="pop-assignee">Assignee</Label>
                      <Select>
                        <SelectTrigger id="pop-assignee">
                          <SelectValue placeholder="Select agent..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="sarah">Sarah K.</SelectItem>
                          <SelectItem value="james">James L.</SelectItem>
                          <SelectItem value="maria">Maria T.</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button className="w-full" size="sm">Assign</Button>
                  </div>
                </PopoverContent>
              </Popover>

              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline"><Filter className="h-4 w-4" />Filters</Button>
                </PopoverTrigger>
                <PopoverContent className="w-64">
                  <div className="space-y-3">
                    <h4 className="font-medium">Filter tickets</h4>
                    <div className="space-y-2">
                      {["Open", "Pending", "Resolved", "Critical"].map((f) => (
                        <div key={f} className="flex items-center gap-2">
                          <Checkbox id={`pop-filter-${f}`} />
                          <Label htmlFor={`pop-filter-${f}`} className="font-normal">{f}</Label>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" className="flex-1">Apply</Button>
                      <Button size="sm" variant="outline" className="flex-1">Reset</Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </Section>

        {/* ── 12. Calendar & Date Range ───────────────────────────────── */}
        <Section title="Calendar & Date Range">
          <div className="grid gap-6 tablet:grid-cols-2">
            <div className="rounded-lg border bg-card p-4 space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Calendar — single date</p>
              <Calendar
                mode="single"
                selected={calendarDate}
                onSelect={setCalendarDate}
                className="mx-auto"
              />
            </div>
            <div className="rounded-lg border bg-card p-4 space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Date Range Picker (live — shares Jotai atom with charts)</p>
              <DatePickerWithRange />
              <p className="text-xs text-muted-foreground">
                Constrained to available ticket data (Nov 2023 – Jan 2024). Updating this selection also updates the bar chart below.
              </p>
            </div>
          </div>
        </Section>

        {/* ── 13. Tabs ────────────────────────────────────────────────── */}
        <Section title="Tabs">
          <div className="space-y-4">
            <Tabs defaultValue="overview">
              <TabsList>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="analytics">Analytics</TabsTrigger>
                <TabsTrigger value="reports">Reports</TabsTrigger>
                <TabsTrigger value="settings">Settings</TabsTrigger>
              </TabsList>
              <TabsContent value="overview">
                <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Overview — key metrics and recent activity.</p></CardContent></Card>
              </TabsContent>
              <TabsContent value="analytics">
                <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Analytics — charts and trend data.</p></CardContent></Card>
              </TabsContent>
              <TabsContent value="reports">
                <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Reports — exportable summaries.</p></CardContent></Card>
              </TabsContent>
              <TabsContent value="settings">
                <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Settings — preferences and configuration.</p></CardContent></Card>
              </TabsContent>
            </Tabs>
          </div>
        </Section>

        {/* ── 14. Accordion ───────────────────────────────────────────── */}
        <Section title="Accordion">
          <div className="rounded-lg border bg-card px-6">
            <Accordion type="single" collapsible className="w-full">
              {[
                { value: "item-1", q: "How do I create a new ticket?", a: "Click the '+ New Ticket' button in the top-right corner of the Dashboard. Fill in the subject, priority, and description, then submit." },
                { value: "item-2", q: "What are ticket priority levels?", a: "Tickets are classified as Low, Medium, High, or Critical. Critical tickets are escalated immediately and assigned within 15 minutes." },
                { value: "item-3", q: "Can I reassign a ticket to another agent?", a: "Yes. Open the ticket, click 'Assign', and select any available agent from the dropdown. The assignee will be notified by email." },
                { value: "item-4", q: "How do I export ticket data?", a: "Navigate to Reports, select your date range, apply filters if needed, then click 'Export CSV'. A download will start automatically." },
              ].map(({ value, q, a }) => (
                <AccordionItem key={value} value={value}>
                  <AccordionTrigger>{q}</AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">{a}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </Section>

        {/* ── 15. Table ───────────────────────────────────────────────── */}
        <Section title="Table">
          <div className="rounded-lg border bg-card overflow-hidden">
            <Table>
              <TableCaption className="pb-4">Recent support tickets — showing 5 of 1,204</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-28">ID</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Assignee</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tableData.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-mono text-xs text-muted-foreground">{row.id}</TableCell>
                    <TableCell className="font-medium">{row.subject}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarFallback className="text-[9px]">{row.assignee.split(" ").map(n => n[0]).join("")}</AvatarFallback>
                        </Avatar>
                        <span className="text-sm">{row.assignee}</span>
                      </div>
                    </TableCell>
                    <TableCell><Badge variant={priorityVariant[row.priority]}>{row.priority}</Badge></TableCell>
                    <TableCell><Badge variant={statusVariant[row.status]}>{row.status}</Badge></TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="icon" variant="ghost" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem><Eye className="mr-2 h-4 w-4" />View</DropdownMenuItem>
                          <DropdownMenuItem><Edit className="mr-2 h-4 w-4" />Edit</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive focus:text-destructive"><Trash2 className="mr-2 h-4 w-4" />Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Section>

        {/* ── 16. Progress & Skeleton ─────────────────────────────────── */}
        <Section title="Progress & Skeleton">
          <div className="grid gap-4 tablet:grid-cols-2">
            <div className="rounded-lg border bg-card p-6 space-y-5">
              <p className="text-sm font-medium text-muted-foreground">Progress bar</p>
              {[
                { value: 0, label: "0% — empty" },
                { value: 25, label: "25%" },
                { value: 60, label: "60%" },
                { value: 100, label: "100% — complete" },
              ].map(({ value, label }) => (
                <div key={value} className="space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{label}</span>
                    <span>{value}%</span>
                  </div>
                  <Progress value={value} className="h-2" />
                </div>
              ))}
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Resolved tickets</span>
                  <span>75%</span>
                </div>
                <Progress value={75} className="h-3" />
              </div>
            </div>

            <div className="rounded-lg border bg-card p-6 space-y-5">
              <p className="text-sm font-medium text-muted-foreground">Skeleton</p>
              <div className="space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-1/2" />
              </div>
              <Separator />
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-3 w-32" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
              <Separator />
              <div className="rounded-lg border p-4 space-y-3">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-9 w-28 rounded-md" />
              </div>
            </div>
          </div>
        </Section>

        {/* ── 17. Alert ───────────────────────────────────────────────── */}
        <Section title="Alert">
          <div className="space-y-3">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>Info</AlertTitle>
              <AlertDescription>Your session will expire in 30 minutes. Save your work.</AlertDescription>
            </Alert>
            <Alert variant="success">
              <CheckCircle2 className="h-4 w-4" />
              <AlertTitle>Ticket resolved</AlertTitle>
              <AlertDescription>Ticket TKT-002 was successfully resolved and closed.</AlertDescription>
            </Alert>
            <Alert variant="warning">
              <TriangleAlert className="h-4 w-4" />
              <AlertTitle>High ticket volume</AlertTitle>
              <AlertDescription>Queue has exceeded 500 tickets. Consider escalating to additional agents.</AlertDescription>
            </Alert>
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Integration error</AlertTitle>
              <AlertDescription>Failed to sync with CRM. Check your API credentials in Settings.</AlertDescription>
            </Alert>
          </div>
        </Section>

        {/* ── 18. Tooltip ─────────────────────────────────────────────── */}
        <Section title="Tooltip">
          <div className="rounded-lg border bg-card p-6 space-y-4">
            <div className="flex flex-wrap gap-4">
              {(["top", "bottom", "left", "right"] as const).map((side) => (
                <Tooltip key={side}>
                  <TooltipTrigger asChild>
                    <Button variant="outline">{side}</Button>
                  </TooltipTrigger>
                  <TooltipContent side={side}><p>Tooltip on {side}</p></TooltipContent>
                </Tooltip>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 items-center">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="icon" variant="ghost"><Download className="h-4 w-4" /></Button>
                </TooltipTrigger>
                <TooltipContent><p>Export CSV</p></TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="icon" variant="ghost"><Share className="h-4 w-4" /></Button>
                </TooltipTrigger>
                <TooltipContent><p>Share link</p></TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="icon" variant="ghost"><Trash2 className="h-4 w-4" /></Button>
                </TooltipTrigger>
                <TooltipContent><p>Delete ticket</p></TooltipContent>
              </Tooltip>
            </div>
          </div>
        </Section>

        {/* ── 19. Dialog & Sheet ──────────────────────────────────────── */}
        <Section title="Dialog & Sheet">
          <div className="rounded-lg border bg-card p-6 space-y-4">
            <div className="flex flex-wrap gap-3">
              <Dialog>
                <DialogTrigger asChild>
                  <Button>Open Dialog</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Delete ticket TKT-002?</DialogTitle>
                    <DialogDescription>
                      This will permanently delete the ticket and all associated messages. This action cannot be undone.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <Button variant="outline">Cancel</Button>
                    <Button variant="destructive">Delete</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline">Open Sheet (right)</Button>
                </SheetTrigger>
                <SheetContent>
                  <SheetHeader>
                    <SheetTitle>Ticket TKT-001</SheetTitle>
                    <SheetDescription>Login not working — submitted by John Doe</SheetDescription>
                  </SheetHeader>
                  <div className="mt-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Status</span>
                      <Badge>Open</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Priority</span>
                      <Badge variant="warning">High</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Assignee</span>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarFallback className="text-[9px]">SK</AvatarFallback>
                        </Avatar>
                        <span className="text-sm">Sarah K.</span>
                      </div>
                    </div>
                    <Separator />
                    <div className="space-y-2">
                      <Label htmlFor="sheet-note">Add note</Label>
                      <Textarea id="sheet-note" placeholder="Add internal note..." rows={3} />
                    </div>
                  </div>
                  <SheetFooter className="mt-6">
                    <Button className="w-full">Save changes</Button>
                  </SheetFooter>
                </SheetContent>
              </Sheet>

              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline">Open Sheet (left)</Button>
                </SheetTrigger>
                <SheetContent side="left">
                  <SheetHeader>
                    <SheetTitle>Navigation</SheetTitle>
                    <SheetDescription>Quick access to sections</SheetDescription>
                  </SheetHeader>
                  <div className="mt-4 space-y-1">
                    {[
                      { label: "Dashboard", Icon: LayoutDashboard },
                      { label: "Tickets", Icon: MessageSquare },
                      { label: "Reports", Icon: Filter },
                      { label: "Settings", Icon: Settings },
                    ].map(({ label, Icon }) => (
                      <div key={label} className="flex items-center gap-3 rounded-md px-3 py-2 hover:bg-muted cursor-pointer">
                        <Icon size={16} className="text-muted-foreground" />
                        <span className="text-sm">{label}</span>
                      </div>
                    ))}
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </Section>

        {/* ── 20. Scroll Area ─────────────────────────────────────────── */}
        <Section title="Scroll Area">
          <div className="grid gap-4 tablet:grid-cols-2">
            <div className="rounded-lg border bg-card p-4 space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Vertical scroll</p>
              <ScrollArea className="h-48 rounded-md border p-3">
                <div className="space-y-2">
                  {scrollItems.map(({ id, label, desc }) => (
                    <div key={id} className="flex items-start gap-3 rounded-md p-2 hover:bg-muted">
                      <Badge variant="outline" className="shrink-0 font-mono text-xs">{id}</Badge>
                      <div>
                        <p className="text-sm font-medium">{label}</p>
                        <p className="text-xs text-muted-foreground">{desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
            <div className="rounded-lg border bg-card p-4 space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Horizontal scroll</p>
              <ScrollArea className="w-full rounded-md border">
                <div className="flex gap-3 p-3" style={{ width: "max-content" }}>
                  {Array.from({ length: 12 }, (_, i) => (
                    <Card key={i} className="w-40 shrink-0">
                      <CardContent className="p-3">
                        <p className="text-sm font-medium">Card {i + 1}</p>
                        <p className="text-xs text-muted-foreground">Scroll right →</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </div>
        </Section>

        {/* ── 21. Metric Cards ────────────────────────────────────────── */}
        <Section title="Metric Cards">
          <div className="rounded-lg border bg-card p-6 space-y-6">
            <SubSection title="Variant A — with change indicator (from Metrics chart block)">
              <div className="grid grid-cols-2 gap-6 laptop:grid-cols-4">
                {[
                  { title: "Created Tickets", value: "24,208", change: -0.05 },
                  { title: "Unsolved Tickets", value: "4,564", change: 0.02 },
                  { title: "Resolved Tickets", value: "18,208", change: 0.08 },
                  { title: "Avg. First Reply", value: "12:01 min", change: 0.08 },
                ].map((m) => (
                  <MetricsMetricCard key={m.title} {...m} />
                ))}
              </div>
            </SubSection>
            <Separator />
            <SubSection title="Variant B — with color dot (from Average Tickets chart block)">
              <div className="flex flex-wrap gap-8">
                <AvgMetricCard title="Avg. Tickets Created" value={48} color="#60C2FB" />
                <AvgMetricCard title="Avg. Tickets Resolved" value={41} color="#3161F8" />
              </div>
            </SubSection>
          </div>
        </Section>

        {/* ── 22. Charts & Data Visualization ────────────────────────── */}
        <Section title="Charts & Data Visualization">
          <p className="text-sm text-muted-foreground">
            Powered by <strong>VisActor VChart</strong> (<code className="rounded bg-muted px-1 text-xs">@visactor/react-vchart</code>).
            All charts adapt to light/dark mode via <code className="rounded bg-muted px-1 text-xs">ChartThemeProvider</code> and use Gabarito as their font.
          </p>

          <div className="space-y-6">
            <div className="rounded-lg border bg-card p-6">
              <div className="mb-3 flex items-center gap-2">
                <Badge variant="outline">Bar Chart — grouped</Badge>
                <span className="text-xs text-muted-foreground">average-tickets-created · interactive date range</span>
              </div>
              <AverageTicketsCreated />
            </div>

            <div className="grid gap-6 tablet:grid-cols-2">
              <div className="rounded-lg border bg-card p-6">
                <div className="mb-3 flex items-center gap-2">
                  <Badge variant="outline">Donut Chart</Badge>
                  <span className="text-xs text-muted-foreground">ticket-by-channels</span>
                </div>
                <div className="h-80">
                  <TicketByChannels />
                </div>
              </div>

              <div className="rounded-lg border bg-card p-6">
                <div className="mb-3 flex items-center gap-2">
                  <Badge variant="outline">Circle Packing</Badge>
                  <span className="text-xs text-muted-foreground">conversions · drill-down enabled</span>
                </div>
                <div className="h-80">
                  <Convertions />
                </div>
              </div>
            </div>

            <div className="rounded-lg border bg-card p-6">
              <div className="mb-3 flex items-center gap-2">
                <Badge variant="outline">Linear Progress Chart</Badge>
                <span className="text-xs text-muted-foreground">customer-satisfaction · VChart linearProgress type</span>
              </div>
              <div className="h-64">
                <CustomerSatisfication />
              </div>
            </div>
          </div>
        </Section>

        {/* ── 23. Special Effects ─────────────────────────────────────── */}
        <Section title="Special Effects">
          <div className="grid gap-4 tablet:grid-cols-2">
            <div className="rounded-lg border overflow-hidden">
              <div className="dot-matrix h-48 w-full" />
              <div className="p-4">
                <p className="text-sm font-medium">Dot matrix</p>
                <p className="text-xs text-muted-foreground">
                  8×8 radial-gradient dot grid with a radial-gradient vignette mask. Used in the side nav brand footer.
                </p>
                <code className="mt-2 block text-xs text-muted-foreground font-mono">className="dot-matrix"</code>
              </div>
            </div>

            <div className="rounded-lg border bg-card p-4 space-y-4">
              <p className="text-sm font-medium text-muted-foreground">Animation tokens (tailwindcss-animate)</p>
              <div className="space-y-1.5 font-mono text-xs text-muted-foreground">
                {[
                  "animate-in / animate-out",
                  "fade-in-0 / fade-out-0",
                  "zoom-in-95 / zoom-out-95",
                  "zoom-in-50 (badge pop)",
                  "slide-in-from-top-2",
                  "slide-in-from-bottom-2",
                  "slide-in-from-left / right",
                  "accordion-down / accordion-up",
                  "animate-pulse (skeleton)",
                  "transition-colors duration-200/300",
                  "transition-transform ease-in-out",
                ].map((a) => <p key={a}>{a}</p>)}
              </div>
            </div>
          </div>

          <div className="rounded-lg border bg-card p-4">
            <p className="mb-3 text-sm font-medium text-muted-foreground">Live shimmer — Skeleton pulse</p>
            <div className="flex items-center gap-4">
              <Skeleton className="h-12 w-12 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-4 w-1/2" />
              </div>
              <Skeleton className="h-8 w-20 rounded-md" />
            </div>
          </div>
        </Section>

        {/* ── 24. Separator ───────────────────────────────────────────── */}
        <Section title="Separator">
          <div className="rounded-lg border bg-card p-6 space-y-4">
            <div className="space-y-1">
              <p className="text-sm font-medium">Horizontal separator</p>
              <p className="text-xs text-muted-foreground">Divides sections vertically.</p>
            </div>
            <Separator />
            <div className="space-y-1">
              <p className="text-sm font-medium">Used for visual grouping</p>
              <p className="text-xs text-muted-foreground">Between form sections, card content, and nav items.</p>
            </div>
            <div className="flex h-8 items-center gap-4">
              <span className="text-sm">Label</span>
              <Separator orientation="vertical" />
              <span className="text-sm">Value</span>
              <Separator orientation="vertical" />
              <span className="text-sm">Action</span>
            </div>
          </div>
        </Section>

      </div>
    </TooltipProvider>
  );
}
