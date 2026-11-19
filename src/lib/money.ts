import { CURRENCIES } from "./constants";

/** Convert a major-unit amount (₹1,234.56) to integer minor units (123456). */
export function toMinor(amount: number): number {
  return Math.round(amount * 100);
}

/** Convert integer minor units back to a major-unit number. */
export function fromMinor(minor: number): number {
  return Math.round(minor) / 100;
}

function localeFor(currency: string): string {
  return CURRENCIES.find((c) => c.code === currency)?.locale ?? "en-IN";
}

const formatterCache = new Map<string, Intl.NumberFormat>();
function getFormatter(key: string, locale: string, options: Intl.NumberFormatOptions) {
  let f = formatterCache.get(key);
  if (!f) {
    f = new Intl.NumberFormat(locale, options);
    formatterCache.set(key, f);
  }
  return f;
}

export type FormatMoneyOptions = {
  /** Show decimals only when the value has a fractional part (default true). */
  smartDecimals?: boolean;
  /** Prefix + for positive values. */
  signed?: boolean;
  /** Compact notation: ₹1.2L, ₹3.4Cr (INR) or $1.2K, $3.4M. */
  compact?: boolean;
};

/**
 * Format a major-unit amount. INR uses Indian digit grouping (₹1,00,000).
 */
export function formatMoney(amount: number, currency = "INR", opts: FormatMoneyOptions = {}): string {
  const { smartDecimals = true, signed = false, compact = false } = opts;
  const abs = Math.abs(amount);
  let body: string;

  if (compact && abs >= 1000) {
    body = formatCompact(abs, currency);
  } else {
    const hasFraction = Math.round(abs * 100) % 100 !== 0;
    const digits = smartDecimals ? (hasFraction ? 2 : 0) : 2;
    const locale = localeFor(currency);
    body = getFormatter(`${currency}-${digits}`, locale, {
      style: "currency",
      currency,
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(abs);
  }

  const sign = amount < 0 ? "-" : signed && amount > 0 ? "+" : "";
  return `${sign}${body}`;
}

/** Compact formatting. For INR this uses lakh (L) and crore (Cr) as Indian users expect. */
export function formatCompact(abs: number, currency = "INR"): string {
  const symbol = CURRENCIES.find((c) => c.code === currency)?.symbol ?? currency;
  const trim = (n: number) => (Math.round(n * 10) / 10).toString().replace(/\.0$/, "");
  if (currency === "INR") {
    if (abs >= 1e7) return `${symbol}${trim(abs / 1e7)}Cr`;
    if (abs >= 1e5) return `${symbol}${trim(abs / 1e5)}L`;
    if (abs >= 1e3) return `${symbol}${trim(abs / 1e3)}K`;
    return `${symbol}${Math.round(abs)}`;
  }
  if (abs >= 1e9) return `${symbol}${trim(abs / 1e9)}B`;
  if (abs >= 1e6) return `${symbol}${trim(abs / 1e6)}M`;
  if (abs >= 1e3) return `${symbol}${trim(abs / 1e3)}K`;
  return `${symbol}${Math.round(abs)}`;
}

/** Axis tick formatter (no currency symbol clutter beyond the compact one). */
export function formatAxis(value: number, currency = "INR"): string {
  if (value === 0) return "0";
  return formatCompact(Math.abs(value), currency);
}

export function currencySymbol(currency = "INR"): string {
  return CURRENCIES.find((c) => c.code === currency)?.symbol ?? currency;
}

/** Percentage change from previous to current. Returns null when there is no baseline. */
export function percentChange(current: number, previous: number): number | null {
  if (!previous) return current ? null : 0;
  return ((current - previous) / Math.abs(previous)) * 100;
}

export function formatPercent(value: number | null, opts: { signed?: boolean; digits?: number } = {}): string {
  if (value === null || !Number.isFinite(value)) return "—";
  const { signed = false, digits = 0 } = opts;
  const rounded = value.toFixed(digits);
  const sign = signed && value > 0 ? "+" : "";
  return `${sign}${rounded}%`;
}
