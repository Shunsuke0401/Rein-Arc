"use client";

import { Check, Copy } from "lucide-react";
import * as React from "react";

export type PayeeRow = {
  id: string;
  label: string;
  address?: string;
  createdAt: string;
};

export function PayeeList({ payees }: { payees: PayeeRow[] }) {
  if (payees.length === 0) {
    return (
      <div className="rounded-lg border bg-white p-8 text-center text-sm text-neutral-500">
        No payees yet. Add one above — your agent can only send payments to
        labels on this list.
      </div>
    );
  }
  return (
    <div className="rounded-lg border bg-white divide-y">
      {payees.map((p) => (
        <div
          key={p.id}
          className="flex items-start justify-between gap-4 px-4 py-3 text-sm"
        >
          <div className="min-w-0 flex-1">
            <div className="font-medium">{p.label}</div>
            {p.address ? (
              <AddressRow address={p.address} />
            ) : null}
          </div>
          <div className="text-xs text-neutral-500 shrink-0 pt-0.5">
            Added {new Date(p.createdAt).toLocaleDateString()}
          </div>
        </div>
      ))}
    </div>
  );
}

function AddressRow({ address }: { address: string }) {
  const [copied, setCopied] = React.useState(false);
  async function copy() {
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <div className="mt-1 flex items-center gap-2">
      <span className="font-mono text-xs text-neutral-600 break-all">
        {address}
      </span>
      <button
        type="button"
        onClick={copy}
        className="text-xs text-neutral-500 hover:text-foreground inline-flex items-center gap-1 shrink-0"
        aria-label="Copy address"
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
      </button>
    </div>
  );
}
