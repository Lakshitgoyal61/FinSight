import Link from "next/link";
import { Compass } from "lucide-react";
import { Logo } from "@/components/icons";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main id="main" className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <Logo />
      <div className="mt-10 flex size-14 items-center justify-center rounded-2xl border border-border bg-card text-[color:var(--violet)]">
        <Compass className="size-6" aria-hidden />
      </div>
      <h1 className="mt-6 text-3xl font-bold tracking-tight">Page not found</h1>
      <p className="mt-2 max-w-sm text-muted-foreground">The page you&apos;re looking for doesn&apos;t exist or has moved.</p>
      <div className="mt-8 flex gap-3">
        <Button asChild><Link href="/dashboard">Go to dashboard</Link></Button>
        <Button asChild variant="secondary"><Link href="/">Home</Link></Button>
      </div>
    </main>
  );
}
