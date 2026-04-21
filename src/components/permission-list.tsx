"use client";

import { Loader2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";

export type PermissionRow = {
  id: string;
  name: string;
  status: string;
  perPaymentLimitUsd: number;
  monthlyLimitUsd: number;
  payeeIds: string[];
  allowedOperations: string[];
  createdAt: string;
};

const OPERATION_LABELS: Record<string, string> = {
  send_payment: "Send payment",
  approve_vendor: "Approve vendor",
  receive_refund: "Receive refund",
};

function formatUsd(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(n);
}

export function PermissionList({
  agentId,
  permissions,
  payeeLabels,
}: {
  agentId: string;
  permissions: PermissionRow[];
  payeeLabels: Record<string, string>;
}) {
  if (permissions.length === 0) {
    return (
      <div className="rounded-lg border bg-white p-8 text-center text-sm text-neutral-500">
        No permissions yet. Add one to give your agent runtime a credential
        it can use to make payments.
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {permissions.map((p) => (
        <div
          key={p.id}
          className="rounded-lg border bg-white p-4 flex items-start justify-between gap-4"
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <div className="font-medium">{p.name}</div>
              <Badge
                variant={
                  p.status === "active"
                    ? "success"
                    : p.status === "revoked"
                      ? "secondary"
                      : p.status === "failed"
                        ? "destructive"
                        : "outline"
                }
              >
                {p.status}
              </Badge>
            </div>
            <div className="text-sm text-neutral-600">
              <span className="font-medium text-foreground">
                {formatUsd(p.perPaymentLimitUsd)}
              </span>{" "}
              per payment ·{" "}
              <span className="font-medium text-foreground">
                {formatUsd(p.monthlyLimitUsd)}
              </span>{" "}
              per month
            </div>
            <div className="mt-2 text-xs text-neutral-500">
              {p.allowedOperations.map((op) => OPERATION_LABELS[op] ?? op).join(" · ")}
              {p.payeeIds.length > 0 ? (
                <>
                  {" "}· Payees:{" "}
                  <span className="text-neutral-700">
                    {p.payeeIds
                      .map((id) => payeeLabels[id] ?? "(deleted)")
                      .join(", ")}
                  </span>
                </>
              ) : null}
            </div>
          </div>
          <div>
            {p.status === "active" ? (
              <RevokeButton agentId={agentId} permission={p} />
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

function RevokeButton({
  agentId,
  permission,
}: {
  agentId: string;
  permission: PermissionRow;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = React.useState(false);
  const [open, setOpen] = React.useState(false);

  async function handleRevoke() {
    setBusy(true);
    try {
      const resp = await fetch(
        `/api/agents/${agentId}/permissions/${permission.id}/revoke`,
        { method: "POST" },
      );
      const body = await resp.json();
      if (!resp.ok) throw new Error(body.error ?? "Revoke failed");
      toast({ title: "Permission revoked", variant: "success" });
      setOpen(false);
      router.refresh();
    } catch (err) {
      toast({
        title: "Revoke failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={busy}>
          <Trash2 className="h-3.5 w-3.5" /> Revoke
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Revoke “{permission.name}”?</DialogTitle>
          <DialogDescription>
            Any payments in flight signed by this permission will fail after it
            is revoked. You&rsquo;ll need to create a new permission and update
            your agent runtime to keep sending payments.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={busy}>
              Cancel
            </Button>
          </DialogClose>
          <Button variant="destructive" onClick={handleRevoke} disabled={busy}>
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Revoking…
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4" /> Revoke
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
