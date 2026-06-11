"use client";

// apps/web/src/app/(college)/admin/sso/sso-connection-form.tsx
// Client form. POSTs to /api/admin/sso/connection.

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface SsoConnectionFormProps {
  institutionId: string;
  initialWorkosConnectionId: string;
  initialIdpType: string;
}

export function SsoConnectionForm({
  institutionId,
  initialWorkosConnectionId,
  initialIdpType,
}: SsoConnectionFormProps) {
  const [workosConnectionId, setWorkosConnectionId] = useState(initialWorkosConnectionId);
  const [idpType, setIdpType] = useState(initialIdpType);
  const [status, setStatus] = useState<"pending" | "active" | "disabled">("active");
  const [pending, startTransition] = useTransition();

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await fetch("/api/admin/sso/connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          institution_id: institutionId,
          workos_connection_id: workosConnectionId,
          idp_type: idpType || undefined,
          status,
        }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(err.error ?? "Failed to save SSO connection");
        return;
      }
      toast.success("SSO connection saved");
    });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="workos-connection-id">WorkOS connection ID</Label>
        <Input
          id="workos-connection-id"
          name="workos_connection_id"
          value={workosConnectionId}
          onChange={(e) => setWorkosConnectionId(e.target.value)}
          placeholder="conn_..."
          required
          maxLength={200}
        />
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="idp-type">IdP type (optional)</Label>
          <Input
            id="idp-type"
            name="idp_type"
            value={idpType}
            onChange={(e) => setIdpType(e.target.value)}
            placeholder="okta, azure, google, generic-saml"
            maxLength={40}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="status">Status</Label>
          <select
            id="status"
            value={status}
            onChange={(e) => setStatus(e.target.value as "pending" | "active" | "disabled")}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="active">active</option>
            <option value="pending">pending</option>
            <option value="disabled">disabled</option>
          </select>
        </div>
      </div>
      <div className="flex justify-end">
        <Button type="submit" disabled={pending || !workosConnectionId.trim()}>
          {pending ? "Saving..." : "Save connection"}
        </Button>
      </div>
    </form>
  );
}
