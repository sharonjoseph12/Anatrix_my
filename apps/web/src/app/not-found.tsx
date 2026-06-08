import Link from "next/link";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="container flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <Compass className="h-10 w-10 text-muted-foreground" />
      <h1 className="text-3xl font-bold">404</h1>
      <p className="text-sm text-muted-foreground">
        That page doesn&apos;t exist. Try one of the entry points below.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button asChild>
          <Link href="/">Home</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/signup">Sign up</Link>
        </Button>
        <Button asChild variant="ghost">
          <Link href="/login">Log in</Link>
        </Button>
      </div>
    </main>
  );
}
