import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";

export default function AuthLoading() {
  return (
    <div className="container mx-auto max-w-sm px-4 py-16">
      <Skeleton className="h-8 w-32" />
      <Skeleton className="mt-6 h-10" />
      <Skeleton className="mt-3 h-10" />
      <Skeleton className="mt-6 h-10" />
      <div className="mt-4 text-center text-sm text-muted-foreground">
        <Link href="/" className="hover:underline">Back to home</Link>
      </div>
    </div>
  );
}

