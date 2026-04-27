"use client";

import { Copy, Loader2, Plus } from "lucide-react";
import * as React from "react";
import QRCode from "qrcode";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";

// INVARIANT EXCEPTION:
//   The deposit address is rendered ONLY after the customer clicks
//   "Reveal deposit address" within this dialog. Closing the dialog
//   re-hides it so every reveal is an explicit customer action.
//   See CLAUDE.md.
export function AgentDepositPanel({
  agentId,
  agentName,
}: {
  agentId: string;
  agentName: string;
}) {
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [address, setAddress] = React.useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = React.useState<string | null>(null);
  const [revealBusy, setRevealBusy] = React.useState(false);

  async function reveal() {
    setRevealBusy(true);
    try {
      const r = await fetch(`/api/agents/${agentId}/deposit-address`, {
        cache: "no-store",
      });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error ?? "Couldn't load deposit address");
      setAddress(body.depositAddress);
      const url = await QRCode.toDataURL(body.depositAddress, {
        margin: 1,
        width: 220,
      });
      setQrDataUrl(url);
    } catch (err) {
      toast({
        title: "Couldn't load deposit address",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setRevealBusy(false);
    }
  }

  async function copy() {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    toast({ title: "Copied", variant: "success" });
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      setAddress(null);
      setQrDataUrl(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" /> Deposit
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Fund {agentName}</DialogTitle>
          <DialogDescription>
            Reveal this agent&rsquo;s deposit address and send funds to it.
          </DialogDescription>
        </DialogHeader>

        {address && qrDataUrl ? (
          <div className="space-y-4">
            <div className="flex justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrDataUrl}
                alt="Deposit QR"
                className="rounded-md border"
              />
            </div>
            <div className="rounded-md border bg-neutral-50 p-3 font-mono text-xs break-all">
              {address}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={copy}>
                <Copy className="h-3.5 w-3.5" /> Copy
              </Button>
            </div>
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              Send only supported funds on the Rein settlement network.
              Anything sent on a different network may be lost.
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-neutral-600">
              Reveal this agent&rsquo;s deposit address to send funds from an
              external source.
            </p>
            <Button
              onClick={reveal}
              disabled={revealBusy}
              className="w-full"
            >
              {revealBusy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                </>
              ) : (
                <>Reveal deposit address</>
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
