"use client";

import * as React from "react";
import { formatMoney, type FormatMoneyOptions } from "@/lib/money";

export type AppUser = { id: string; name: string; email: string; isDemo: boolean; createdAt: string };

type AppContextValue = {
  user: AppUser;
  currency: string;
  setCurrency: (c: string) => void;
  setUser: (u: AppUser) => void;
};

const AppContext = React.createContext<AppContextValue | null>(null);

export function AppProvider({
  user: initialUser,
  currency: initialCurrency,
  children,
}: {
  user: AppUser;
  currency: string;
  children: React.ReactNode;
}) {
  const [user, setUser] = React.useState(initialUser);
  const [currency, setCurrency] = React.useState(initialCurrency);
  const value = React.useMemo(() => ({ user, currency, setCurrency, setUser }), [user, currency]);
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = React.useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside <AppProvider>");
  return ctx;
}

/** Currency-aware money formatter bound to the user's preference. */
export function useMoney() {
  const { currency } = useApp();
  return React.useCallback((amount: number, opts?: FormatMoneyOptions) => formatMoney(amount, currency, opts), [currency]);
}
