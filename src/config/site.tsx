import { Gauge, type LucideIcon, MessagesSquare, Palette } from "lucide-react";

export type SiteConfig = typeof siteConfig;
export type Navigation = {
  icon: LucideIcon;
  name: string;
  href: string;
};

export const siteConfig = {
  title: "Veritax",
  description: "Veritax application",
};

export const navigations: Navigation[] = [
  {
    icon: Gauge,
    name: "Dashboard",
    href: "/",
  },
  {
    icon: MessagesSquare,
    name: "Ticket",
    href: "/ticket",
  },
  {
    icon: Palette,
    name: "Design System",
    href: "/design-system",
  },
];
