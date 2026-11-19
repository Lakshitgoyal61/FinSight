"use client";

import * as React from "react";
import { ThemeProvider } from "next-themes";
import { SWRConfig } from "swr";
import { Toaster } from "sonner";
import { MotionConfig } from "framer-motion";
import { fetcher } from "@/lib/client";
import { TooltipProvider } from "@/components/ui/primitives";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
      <MotionConfig reducedMotion="user">
        <SWRConfig value={{ fetcher, revalidateOnFocus: true, dedupingInterval: 1500, keepPreviousData: true }}>
          <TooltipProvider>
            {children}
            <ThemedToaster />
          </TooltipProvider>
        </SWRConfig>
      </MotionConfig>
    </ThemeProvider>
  );
}

function ThemedToaster() {
  return (
    <Toaster
      position="bottom-right"
      closeButton
      toastOptions={{
        classNames: {
          toast: "!bg-popover !text-popover-foreground !border-border !rounded-xl !shadow-pop",
          description: "!text-muted-foreground",
          actionButton: "!bg-primary !text-primary-foreground",
        },
      }}
    />
  );
}
