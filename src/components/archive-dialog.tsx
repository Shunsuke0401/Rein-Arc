"use client";

import { Archive, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";

export function ArchiveDialog({
  agentId,
  agentName,
}: {
  agentId: string;
  agentName: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = React.useState(false);
  const [open, setOpen] = React.useState(false);

  async function handleArchive() {
    setBusy(true);
    try {
      const resp = await fetch(`/api/agents/${agentId}/archive`, {
        method: "POST",
      });
      const body = await resp.json();
      if (!resp.ok) throw new Error(body.error ?? "Archive failed");
      toast({
        title: `${agentName} archived`,
        description: "All permissions revoked. The agent can no longer sign payments.",
        variant: "success",
      });
      setOpen(false);
      router.push("/dashboard/agents");
      router.refresh();
    } catch (err) {
      toast({
        title: "Archive failed",
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
        <Button variant="outline">
          <Archive className="h-4 w-4" /> Archive
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Archive {agentName}?</DialogTitle>
          <DialogDescription>
            All of this agent&rsquo;s permissions will be revoked. The agent
            will stop signing payments immediately. Any remaining balance
            stays on the agent — drain it beforehand with a one-time
            permission if you want it back. Archived agents can&rsquo;t be
            reactivated.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleArchive} disabled={busy}>
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Archiving…
              </>
            ) : (
              <>
                <Archive className="h-4 w-4" /> Archive
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
