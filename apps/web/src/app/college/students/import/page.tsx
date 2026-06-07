import { Upload } from "lucide-react";
import { ImportForm } from "./import-form";

export const metadata = { title: "Import students | Antarix" };

export default function ImportPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Upload className="h-7 w-7" />
          Import students
        </h1>
        <p className="text-muted-foreground">
          Upload a CSV. Each row creates an institution_members entry and a
          pending signup link (we&apos;ll email invite links if SMTP is configured).
        </p>
      </div>
      <ImportForm />
    </div>
  );
}
