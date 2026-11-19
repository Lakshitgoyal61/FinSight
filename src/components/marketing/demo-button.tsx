"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PlayCircle } from "lucide-react";
import { api, errorMessage } from "@/lib/client";
import { DEMO_EMAIL, DEMO_PASSWORD } from "@/lib/auth/constants";
import { Button, type ButtonProps } from "@/components/ui/button";

/** One-click sign-in to the documented demo account. */
export function DemoButton({ children = "Explore live demo", ...props }: ButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);
  return (
    <Button
      {...props}
      loading={loading}
      onClick={async () => {
        setLoading(true);
        try {
          await api("/api/auth/login", { method: "POST", body: { email: DEMO_EMAIL, password: DEMO_PASSWORD } });
          router.push("/dashboard");
          router.refresh();
        } catch (e) {
          toast.error(errorMessage(e), { description: "Run `npm run db:seed` to create the demo account." });
          setLoading(false);
        }
      }}
    >
      {!loading && <PlayCircle />}
      {children}
    </Button>
  );
}
