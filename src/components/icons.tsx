import {
  Briefcase,
  Car,
  CircleEllipsis,
  Clapperboard,
  CreditCard,
  Gauge,
  Gift,
  GraduationCap,
  HeartPulse,
  Heart,
  Home,
  Laptop,
  PiggyBank,
  Plane,
  Receipt,
  Repeat,
  RotateCcw,
  Shield,
  ShoppingBag,
  ShoppingBasket,
  Smartphone,
  Sparkles,
  Target,
  TrendingUp,
  Utensils,
  type LucideIcon,
} from "lucide-react";
import { categoryColor, getCategory } from "@/lib/constants";
import { cn } from "@/lib/utils";

export const ICONS: Record<string, LucideIcon> = {
  utensils: Utensils,
  "shopping-basket": ShoppingBasket,
  "shopping-bag": ShoppingBag,
  car: Car,
  receipt: Receipt,
  home: Home,
  clapperboard: Clapperboard,
  "heart-pulse": HeartPulse,
  "graduation-cap": GraduationCap,
  plane: Plane,
  repeat: Repeat,
  sparkles: Sparkles,
  gift: Gift,
  "circle-ellipsis": CircleEllipsis,
  briefcase: Briefcase,
  laptop: Laptop,
  "trending-up": TrendingUp,
  "rotate-ccw": RotateCcw,
  target: Target,
  shield: Shield,
  smartphone: Smartphone,
  heart: Heart,
  "piggy-bank": PiggyBank,
  gauge: Gauge,
  "credit-card": CreditCard,
};

export function Icon({ name, className }: { name: string; className?: string }) {
  const Cmp = ICONS[name] ?? CircleEllipsis;
  return <Cmp className={className} aria-hidden />;
}

/** Category glyph on a tinted tile. Color is decorative — the label is always shown nearby. */
export function CategoryIcon({ category, size = "md", className }: { category: string; size?: "sm" | "md" | "lg"; className?: string }) {
  const meta = getCategory(category);
  const color = categoryColor(category);
  const dims = size === "sm" ? "size-8 rounded-lg [&_svg]:size-4" : size === "lg" ? "size-12 rounded-xl [&_svg]:size-6" : "size-10 rounded-xl [&_svg]:size-[18px]";
  return (
    <span
      className={cn("inline-flex shrink-0 items-center justify-center", dims, className)}
      style={{ background: `color-mix(in srgb, ${color} 16%, transparent)`, color }}
    >
      <Icon name={meta.icon} />
    </span>
  );
}

export const GOAL_COLOR_VARS: Record<string, string> = {
  violet: "var(--cat-7)",
  blue: "var(--cat-1)",
  teal: "var(--teal)",
  amber: "var(--cat-4)",
  pink: "var(--cat-5)",
  emerald: "var(--cat-3)",
};

export function Logo({ className, withText = true }: { className?: string; withText?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      {/* Tile is drawn with CSS (not an SVG gradient id) so multiple logos never clash or vanish when one is hidden. */}
      <span className="brand-gradient flex size-8 shrink-0 items-center justify-center rounded-[9px]" aria-hidden>
        <svg viewBox="0 0 32 32" className="size-8">
          <path d="M9 21.5c3-1 4.2-5.5 7-7.5s5.2-1.6 7-4" fill="none" stroke="white" strokeWidth="2.6" strokeLinecap="round" />
          <circle cx="23" cy="10" r="2.2" fill="white" />
          <path d="M9 24.5h14" stroke="white" strokeOpacity="0.45" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </span>
      {withText && <span className="font-display text-[17px] font-bold tracking-tight">FinSight</span>}
    </span>
  );
}
