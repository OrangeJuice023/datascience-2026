import {
  LayoutDashboard,
  Map,
  ScanSearch,
  FlaskConical,
  PackageSearch,
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

/** Exactly three primary destinations; Analyze holds ACCESS, Policy and Lab. */
export const PRIMARY_NAV: NavItem[] = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/explore", label: "Explore", icon: Map },
  { href: "/analyze", label: "Analyze", icon: ScanSearch },
];

export interface AnalyzeTab extends NavItem {
  id: "access" | "policy" | "lab";
}

/** Analyze's subtabs, in their order once ACCESS is ready (see AnalyzeTabs). */
export const ANALYZE_TABS: AnalyzeTab[] = [
  { id: "access", href: "/analyze/access", label: "ACCESS", icon: PackageSearch },
  { id: "policy", href: "/analyze/policy", label: "Policy", icon: ShieldCheck },
  { id: "lab", href: "/analyze/lab", label: "Lab", icon: FlaskConical },
];

export const SECONDARY_NAV: NavItem[] = [
  { href: "/data-sources", label: "Data Sources", icon: Database },
  { href: "/documentation", label: "Documentation", icon: BookOpen },
];

/** Whether a primary item is the current section (Analyze covers its subtabs). */
export function isNavActive(href: string, pathname: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
