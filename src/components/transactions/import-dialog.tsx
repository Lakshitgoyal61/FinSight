"use client";

import * as React from "react";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, UploadCloud } from "lucide-react";
import { api, refreshAll } from "@/lib/client";
import { getCategory } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useMoney } from "@/components/app-context";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/overlays";

type DryRun = {
  totalRows: number;
  validCount: number;
  errorCount: number;
  errors: { row: number; message: string }[];
  preview: { title: string; amount: number; type: string; category: string; date: string }[];
};

const TEMPLATE = `date,title,amount,type,category,payment_method,description
2026-11-01,Monthly salary,68000,income,Salary,Bank Transfer,November salary
2026-11-02,BigBasket,1450.50,expense,Groceries,UPI,Weekly groceries
19/11/2026,Uber,240,expense,Transport,UPI,
`;

export function ImportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const money = useMoney();
  const [file, setFile] = React.useState<{ name: string; text: string } | null>(null);
  const [result, setResult] = React.useState<DryRun | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState<"validate" | "import" | null>(null);
  const [dragging, setDragging] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!open) {
      setFile(null);
      setResult(null);
      setError(null);
    }
  }, [open]);

  async function handleFile(f: File) {
    setError(null);
    setResult(null);
    if (!/\.csv$/i.test(f.name) && f.type !== "text/csv") {
      setError("Please choose a .csv file.");
      return;
    }
    if (f.size > 1_000_000) {
      setError("That file is larger than 1 MB. Split it into smaller files.");
      return;
    }
    const text = await f.text();
    setFile({ name: f.name, text });
    setBusy("validate");
    try {
      setResult(await api<DryRun>("/api/transactions/import", { method: "POST", body: { csv: text, dryRun: true } }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read the file");
    } finally {
      setBusy(null);
    }
  }

  async function confirmImport() {
    if (!file) return;
    setBusy("import");
    try {
      const res = await api<{ imported: number; skipped: number }>("/api/transactions/import", { method: "POST", body: { csv: file.text } });
      toast.success(`Imported ${res.imported} transaction${res.imported === 1 ? "" : "s"}`, {
        description: res.skipped ? `${res.skipped} row(s) with errors were skipped.` : undefined,
      });
      onOpenChange(false);
      void refreshAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setBusy(null);
    }
  }

  function downloadTemplate() {
    const url = URL.createObjectURL(new Blob([TEMPLATE], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "finsight-import-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Import transactions" description="Upload a CSV file. We'll check every row before anything is saved." className="sm:max-w-xl">
        {!result ? (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const f = e.dataTransfer.files[0];
              if (f) void handleFile(f);
            }}
            className={cn(
              "flex flex-col items-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors",
              dragging ? "border-primary bg-primary-soft" : "border-border-strong",
            )}
          >
            <UploadCloud className="size-8 text-[color:var(--violet)]" aria-hidden />
            <p className="mt-3 text-sm font-medium">{busy === "validate" ? "Checking your file…" : "Drag a CSV file here"}</p>
            <p className="mt-1 text-xs text-muted-foreground">Required columns: date, title, amount. Optional: type, category, payment_method, description.</p>
            <input
              ref={inputRef}
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              id="csv-file"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleFile(f);
                e.target.value = "";
              }}
            />
            <Button className="mt-5" variant="secondary" loading={busy === "validate"} onClick={() => inputRef.current?.click()}>
              <FileSpreadsheet /> Choose file
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-xl border border-border bg-background-subtle px-4 py-3">
              <FileSpreadsheet className="size-5 text-muted-foreground" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{file?.name}</p>
                <p className="text-xs text-muted-foreground">{result.totalRows} rows found</p>
              </div>
              <button className="text-xs font-medium text-primary hover:underline" onClick={() => setResult(null)}>
                Change file
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-border p-3">
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><CheckCircle2 className="size-3.5 text-success" aria-hidden /> Ready to import</p>
                <p className="mt-1 font-display text-2xl font-bold tabular">{result.validCount}</p>
              </div>
              <div className="rounded-xl border border-border p-3">
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><AlertTriangle className="size-3.5 text-warning" aria-hidden /> Rows with errors</p>
                <p className="mt-1 font-display text-2xl font-bold tabular">{result.errorCount}</p>
              </div>
            </div>
            {result.preview.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-subtle-foreground">Preview</p>
                <ul className="divide-y divide-border rounded-xl border border-border text-sm">
                  {result.preview.map((p, i) => (
                    <li key={i} className="flex items-center gap-3 px-3 py-2">
                      <span className="w-20 shrink-0 text-xs text-muted-foreground tabular">{p.date}</span>
                      <span className="min-w-0 flex-1 truncate">{p.title}</span>
                      <span className="hidden text-xs text-muted-foreground sm:block">{getCategory(p.category).label}</span>
                      <span className={cn("tabular font-medium", p.type === "INCOME" && "text-success")}>
                        {p.type === "INCOME" ? "+" : "−"}
                        {money(p.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {result.errors.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-subtle-foreground">Issues (these rows will be skipped)</p>
                <ul className="max-h-36 space-y-1 overflow-y-auto rounded-xl border border-warning/30 bg-warning-soft p-3 text-xs">
                  {result.errors.map((e, i) => (
                    <li key={i}>
                      <span className="font-semibold">Row {e.row}:</span> {e.message}
                    </li>
                  ))}
                  {result.errorCount > result.errors.length && <li>…and {result.errorCount - result.errors.length} more</li>}
                </ul>
              </div>
            )}
          </div>
        )}
        {error && (
          <p role="alert" className="mt-4 rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}
        <DialogFooter className="items-center sm:justify-between">
          <Button variant="link" size="sm" onClick={downloadTemplate} className="text-muted-foreground">
            <Download /> Download template
          </Button>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button disabled={!result || result.validCount === 0} loading={busy === "import"} onClick={confirmImport}>
              Import {result?.validCount ? `${result.validCount} rows` : ""}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
