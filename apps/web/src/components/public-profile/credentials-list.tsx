import { Award, ExternalLink } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export type PublicCredential = {
  id: string;
  title: string;
  issued_at: string | null;
  slug?: string | null;
};

export function CredentialsList({ credentials }: { credentials: PublicCredential[] }) {
  if (credentials.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Credentials</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No credentials issued yet. Keep showing up — they unlock at verified scores.
          </p>
        </CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Credentials</CardTitle>
        <CardDescription>Antarix-issued and cryptographically verifiable.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {credentials.map((c) => (
          <Link
            key={c.id}
            href={c.slug ? `/verify/${c.slug}` : "#"}
            className="flex items-center justify-between rounded-md border p-3 transition-colors hover:border-primary"
          >
            <div className="flex items-center gap-2">
              <Award className="h-4 w-4 text-amber-500" />
              <span className="font-medium">{c.title}</span>
            </div>
            <div className="flex items-center gap-2">
              {c.issued_at ? (
                <Badge variant="outline" className="text-[10px]">
                  {new Date(c.issued_at).toLocaleDateString()}
                </Badge>
              ) : null}
              <ExternalLink className="h-3 w-3 text-muted-foreground" />
            </div>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
