import {
  LayoutDashboard,
  Map,
  FlaskConical,
  Waypoints,
  ShieldCheck,
  Database,
  BookOpen,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const PRIMARY_NAV: NavItem[] = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/explore", label: "Explore", icon: Map },
  { href: "/lab", label: "Lab", icon: FlaskConical },
  { href: "/simulate", label: "Simulate", icon: Waypoints },
  { href: "/policy", label: "Policy", icon: ShieldCheck },
];

export const SECONDARY_NAV: NavItem[] = [
  { href: "/data-sources", label: "Data Sources", icon: Database },
  { href: "/documentation", label: "Documentation", icon: BookOpen },
];
