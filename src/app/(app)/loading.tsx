import { Skeleton } from "@/components/ui/primitives";

/** Shown by the App Router while a page's server work streams in. */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading page" className="space-y-5">
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-4 w-80" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-72 rounded-2xl" />
    </div>
  );
}
