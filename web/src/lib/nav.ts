import {
  LayoutDashboard,
  Map,
  FlaskConical,
  PackageSearch,
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
  /**
   * True when the destination does not exist yet. A disabled item is shown
   * but is not a link.
   */
  disabled?: boolean;
}

export const PRIMARY_NAV: NavItem[] = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/explore", label: "Explore", icon: Map },
  { href: "/lab", label: "Lab", icon: FlaskConical },
  { href: "/access", label: "Access", icon: PackageSearch },
  { href: "/simulate", label: "Simulate", icon: Waypoints },
  { href: "/policy", label: "Policy", icon: ShieldCheck },
];

export const SECONDARY_NAV: NavItem[] = [
  { href: "/data-sources", label: "Data Sources", icon: Database, disabled: true },
  { href: "/documentation", label: "Documentation", icon: BookOpen },
];
