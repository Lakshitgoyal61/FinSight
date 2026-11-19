"use client";

import * as React from "react";
import type { TransactionType } from "@/lib/constants";
import { TransactionDialog, emptyTransaction, type TransactionFormValue } from "@/components/transactions/transaction-dialog";

type QuickActions = {
  newTransaction: (type?: TransactionType) => void;
  editTransaction: (value: TransactionFormValue) => void;
};

const Ctx = React.createContext<QuickActions | null>(null);

export function QuickActionsProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const [initial, setInitial] = React.useState<TransactionFormValue>(() => emptyTransaction());

  const value = React.useMemo<QuickActions>(
    () => ({
      newTransaction: (type = "EXPENSE") => {
        setInitial(emptyTransaction(type));
        setOpen(true);
      },
      editTransaction: (v) => {
        setInitial(v);
        setOpen(true);
      },
    }),
    [],
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      <TransactionDialog open={open} onOpenChange={setOpen} initial={initial} />
    </Ctx.Provider>
  );
}

export function useQuickActions() {
  const ctx = React.useContext(Ctx);
  if (!ctx) throw new Error("useQuickActions must be used inside QuickActionsProvider");
  return ctx;
}
