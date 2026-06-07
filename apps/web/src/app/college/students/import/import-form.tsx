"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Upload, Loader2, FileText, CheckCircle2, X } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface PreviewRow {
  email: string;
  display_name: string;
  batch_year: number | null;
  department: string | null;
  roll_number: string | null;
  specialization: string | null;
  ok: boolean;
  error?: string;
}

function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };

  // Simple CSV parser supporting quoted fields with commas
  const splitLine = (line: string): string[] => {
    const out: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i += 1) {
      const c = line[i]!;
      if (c === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (c === "," && !inQuotes) {
        out.push(cur);
        cur = "";
      } else {
        cur += c;
      }
    }
    out.push(cur);
    return out.map((s) => s.trim());
  };

  const headers = splitLine(lines[0]!).map((h) => h.toLowerCase().replace(/[^a-z0-9_]+/g, "_"));
  const rows = lines.slice(1).map(splitLine);
  return { headers, rows };
}

function toPreviewRow(headers: string[], row: string[]): PreviewRow {
  const map = new Map<string, string>();
  headers.forEach((h, i) => map.set(h, row[i] ?? ""));
  const email = map.get("email") ?? "";
  const display_name = map.get("display_name") ?? map.get("name") ?? email.split("@")[0] ?? "";
  const batch = parseInt(map.get("batch_year") ?? "", 10);
  return {
    email,
    display_name,
    batch_year: Number.isFinite(batch) ? batch : null,
    department: map.get("department") || null,
    roll_number: map.get("roll_number") || null,
    specialization: map.get("specialization") || null,
    ok: /.+@.+\..+/.test(email),
    error: /.+@.+\..+/.test(email) ? undefined : "Invalid email",
  };
}

export function ImportForm() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleParse = () => {
    const { headers, rows: raw } = parseCSV(text);
    if (raw.length === 0) {
      toast.error("Paste at least one data row.");
      return;
    }
    if (!headers.includes("email")) {
      toast.error("CSV must have an `email` column.");
      return;
    }
    setRows(raw.map((r) => toPreviewRow(headers, r)));
  };

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      setText(String(reader.result ?? ""));
      const { headers, rows: raw } = parseCSV(String(reader.result ?? ""));
      if (raw.length === 0) {
        toast.error("File is empty.");
        return;
      }
      if (!headers.includes("email")) {
        toast.error("CSV must have an `email` column.");
        return;
      }
      setRows(raw.map((r) => toPreviewRow(headers, r)));
    };
    reader.readAsText(file);
  };

  const validCount = rows.filter((r) => r.ok).length;
  const invalidCount = rows.length - validCount;

  const handleImport = async () => {
    if (validCount === 0) {
      toast.error("Nothing valid to import.");
      return;
    }
    setImporting(true);
    try {
      const res = await fetch("/api/institutions/students/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ students: rows.filter((r) => r.ok) }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(body.error ?? "Import failed");
        return;
      }
      const data = (await res.json()) as { imported: number; skipped: number };
      toast.success(`Imported ${data.imported} · skipped ${data.skipped}`);
      startTransition(() => router.push("/college/students"));
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4" />
            CSV format
          </CardTitle>
          <CardDescription>
            Required column: <code>email</code>. Optional:{" "}
            <code>display_name, batch_year, department, roll_number, specialization</code>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="overflow-x-auto rounded-md bg-muted/50 p-3 text-xs">
{`email,display_name,batch_year,department,roll_number,specialization
ada@uni.edu,Ada Lovelace,2026,CSE,2026CSE01,Algorithms
grace@uni.edu,Grace Hopper,2026,CSE,2026CSE02,Compilers`}
          </pre>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Upload or paste</CardTitle>
          <CardDescription>
            Drop a file, or paste rows. We&apos;ll preview before importing.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label htmlFor="csv-file" className="sr-only">CSV file</Label>
            <input
              id="csv-file"
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
              className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary-foreground hover:file:bg-primary/90"
            />
          </div>
          <div className="text-center text-xs text-muted-foreground">or</div>
          <Textarea
            placeholder={"email,display_name,batch_year\nada@uni.edu,Ada,2026"}
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
          />
          <Button type="button" onClick={handleParse} variant="outline" disabled={!text}>
            Parse preview
          </Button>
        </CardContent>
      </Card>

      {rows.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Preview</CardTitle>
                <CardDescription>
                  {validCount} valid · {invalidCount} invalid
                </CardDescription>
              </div>
              <Button
                type="button"
                onClick={handleImport}
                disabled={validCount === 0 || importing || isPending}
              >
                {importing || isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                <span className="ml-1">Import {validCount}</span>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="max-h-80 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="py-2 pr-2"></th>
                    <th className="py-2 pr-2">Email</th>
                    <th className="py-2 pr-2">Name</th>
                    <th className="py-2 pr-2">Batch</th>
                    <th className="py-2 pr-2">Dept</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className="border-t">
                      <td className="py-2 pr-2">
                        {r.ok ? (
                          <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                        ) : (
                          <X className={cn("h-3 w-3 text-rose-600")} />
                        )}
                      </td>
                      <td className="py-2 pr-2 font-mono text-xs">{r.email}</td>
                      <td className="py-2 pr-2">{r.display_name}</td>
                      <td className="py-2 pr-2">{r.batch_year ?? "—"}</td>
                      <td className="py-2 pr-2">{r.department ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {invalidCount > 0 && (
              <div className="mt-3 flex items-center gap-2 text-xs text-rose-600">
                <Badge variant="destructive">{invalidCount}</Badge>
                rows will be skipped
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
