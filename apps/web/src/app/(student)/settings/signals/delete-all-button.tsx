"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";

const REQUIRED_PHRASE = "DELETE_ALL";

export function DeleteAllButton({ onDeleteAll }: { onDeleteAll?: () => Promise<void> }) {
  const t = useTranslations("settings.signals");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleConfirm() {
    if (confirmation !== REQUIRED_PHRASE || busy) return;
    setBusy(true);
    try {
      if (onDeleteAll) {
        await onDeleteAll();
      } else {
        const res = await fetch("/api/settings/signals/delete-all", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ confirmation: REQUIRED_PHRASE }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } | string };
          const msg = typeof body.error === "string" ? body.error : body.error?.message;
          toast.error(msg ?? t("delete_all.error"));
          return;
        }
      }
      toast.success(t("delete_all.success"));
      setOpen(false);
      setConfirmation("");
      router.refresh();
    } catch {
      toast.error(t("delete_all.error"));
    } finally {
      setBusy(false);
    }
  }

  const canSubmit = confirmation === REQUIRED_PHRASE && !busy;

  return (
    <>
      <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-sm font-medium text-destructive">
              <AlertTriangle className="h-4 w-4" />
              {t("delete_all.label")}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{t("delete_all.description")}</p>
          </div>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={() => setOpen(true)}
            disabled={busy}
          >
            <Trash2 className="h-3 w-3" />
            {t("delete_all.label")}
          </Button>
        </div>
      </div>
      <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : (setOpen(false), setConfirmation("")))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              {t("delete_all.label")}
            </DialogTitle>
            <DialogDescription>{t("delete_all.description")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="delete-all-confirm">{t("delete_all.confirm_prompt")}</Label>
            <Input
              id="delete-all-confirm"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              placeholder={t("delete_all.confirm_placeholder")}
              autoComplete="off"
              spellCheck={false}
              autoFocus
            />
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => (setOpen(false), setConfirmation(""))} disabled={busy}>
              {tCommon("cancel")}
            </Button>
            <Button type="button" variant="destructive" onClick={handleConfirm} disabled={!canSubmit}>
              {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : t("delete_all.submit_button")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default DeleteAllButton;
