"use client";

import { AlertTriangle, Check, Copy, Eye, EyeOff, FileDown } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

export type CredentialsPayload = {
  apiKeyId: string;
  apiSecret: string;
  organizationId: string;
};

export function CredentialsModal({
  credentials,
  onAcknowledge,
  permissionName,
}: {
  credentials: CredentialsPayload;
  permissionName: string;
  onAcknowledge: () => void;
}) {
  const [ack, setAck] = React.useState(false);
  const [envCopied, setEnvCopied] = React.useState(false);

  const reinApiKey = React.useMemo(() => {
    const hex = credentials.apiSecret.startsWith("0x")
      ? credentials.apiSecret.slice(2)
      : credentials.apiSecret;
    return `rein_${credentials.apiKeyId}_${hex}`;
  }, [credentials.apiKeyId, credentials.apiSecret]);

  async function copyEnv() {
    const base =
      typeof window !== "undefined" ? window.location.origin : "http://localhost:3457";
    const env = [
      `REIN_BASE=${base}`,
      `REIN_API_KEY=${reinApiKey}`,
      "",
    ].join("\n");
    await navigator.clipboard.writeText(env);
    setEnvCopied(true);
    setTimeout(() => setEnvCopied(false), 2000);
  }

  return (
    <Dialog open onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Credentials for “{permissionName}”</DialogTitle>
          <DialogDescription>
            These are shown <b>once</b>. Copy the API secret now — we don&rsquo;t
            store it and cannot retrieve it later.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <CredField label="REIN_API_KEY" value={reinApiKey} tone="secret" />

          <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-900">
            <AlertTriangle className="h-4 w-4 flex-none mt-0.5" />
            <div>
              Store the API secret in your runtime&rsquo;s secret manager before
              closing. <b>We cannot retrieve it again.</b> If you lose it, create
              a new agent.
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={copyEnv}
            className="w-full"
          >
            {envCopied ? (
              <>
                <Check className="h-4 w-4" /> Copied — paste into .env
              </>
            ) : (
              <>
                <FileDown className="h-4 w-4" /> Copy as .env
              </>
            )}
          </Button>
        </div>

        <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-between sm:items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-neutral-600 cursor-pointer">
            <input
              type="checkbox"
              checked={ack}
              onChange={(e) => setAck(e.target.checked)}
              className="h-4 w-4"
            />
            I&rsquo;ve saved these credentials securely
          </label>
          <Button onClick={onAcknowledge} disabled={!ack}>
            <Check className="h-4 w-4" /> Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CredField({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "info" | "secret";
}) {
  const [copied, setCopied] = React.useState(false);
  const [reveal, setReveal] = React.useState(tone === "info");

  async function copy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-1">
        <Label className="text-xs text-neutral-600">{label}</Label>
        <div className="flex items-center gap-1">
          {tone === "secret" ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setReveal((r) => !r)}
              className="h-7 px-2 text-xs"
            >
              {reveal ? (
                <>
                  <EyeOff className="h-3 w-3" /> Hide
                </>
              ) : (
                <>
                  <Eye className="h-3 w-3" /> Reveal
                </>
              )}
            </Button>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={copy}
            className="h-7 px-2 text-xs"
          >
            {copied ? (
              <>
                <Check className="h-3 w-3" /> Copied
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" /> Copy
              </>
            )}
          </Button>
        </div>
      </div>
      <div
        className={
          tone === "secret"
            ? "rounded-md border border-red-200 bg-red-50 p-2 text-xs font-mono break-all text-red-900"
            : "rounded-md bg-neutral-50 p-2 text-xs font-mono break-all"
        }
      >
        {tone === "secret" && !reveal ? "•".repeat(64) : value}
      </div>
    </div>
  );
}
