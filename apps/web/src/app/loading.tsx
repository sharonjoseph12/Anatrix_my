import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="container mx-auto max-w-3xl px-4 py-12">
      <Skeleton className="h-10 w-1/2" />
      <Skeleton className="mt-3 h-4 w-2/3" />
      <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16" />
        ))}
      </div>
      <Skeleton className="mt-6 h-32" />
      <Skeleton className="mt-3 h-32" />
    </div>
  );
}
