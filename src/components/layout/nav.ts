import {
  ArrowLeftRight,
  BarChart3,
  LayoutDashboard,
  Lightbulb,
  PiggyBank,
  Repeat,
  Settings,
  Target,
  UserRound,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon; shortcut?: string };

export const PRIMARY_NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, shortcut: "G D" },
  { href: "/transactions", label: "Transactions", icon: ArrowLeftRight, shortcut: "G T" },
  { href: "/analytics", label: "Analytics", icon: BarChart3, shortcut: "G A" },
  { href: "/budgets", label: "Budgets", icon: PiggyBank, shortcut: "G B" },
  { href: "/goals", label: "Savings Goals", icon: Target, shortcut: "G G" },
  { href: "/subscriptions", label: "Subscriptions", icon: Repeat, shortcut: "G S" },
  { href: "/insights", label: "Insights", icon: Lightbulb, shortcut: "G I" },
];

export const SECONDARY_NAV: NavItem[] = [
  { href: "/profile", label: "Profile", icon: UserRound },
  { href: "/settings", label: "Settings", icon: Settings },
];

/** Mobile bottom bar: the four most frequent destinations + "More". */
export const MOBILE_NAV: NavItem[] = [PRIMARY_NAV[0]!, PRIMARY_NAV[1]!, PRIMARY_NAV[3]!, PRIMARY_NAV[2]!];
