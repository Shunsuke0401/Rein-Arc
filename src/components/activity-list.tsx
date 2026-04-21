"use client";

import { ArrowDownLeft, ArrowUpRight } from "lucide-react";

export type ActivityItem = {
  timestamp: number;
  direction: "in" | "out";
  counterpartyLabel: string;
  amountUsd: number;
};

function fmtUsd(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(n);
}

function fmtWhen(ts: number) {
  if (!ts) return "—";
  const d = new Date(ts);
  const now = Date.now();
  const diff = now - ts;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function ActivityList({ items }: { items: ActivityItem[] }) {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border bg-white p-8 text-center text-sm text-neutral-500">
        No activity yet. Payments will appear here as soon as your agent moves money.
      </div>
    );
  }
  return (
    <div className="rounded-lg border bg-white divide-y">
      {items.map((it, i) => (
        <div
          key={i}
          className="flex items-center justify-between px-4 py-3 text-sm"
        >
          <div className="flex items-center gap-3">
            <div
              className={
                it.direction === "out"
                  ? "rounded-full bg-red-50 p-1.5 text-red-600"
                  : "rounded-full bg-emerald-50 p-1.5 text-emerald-600"
              }
            >
              {it.direction === "out" ? (
                <ArrowUpRight className="h-3.5 w-3.5" />
              ) : (
                <ArrowDownLeft className="h-3.5 w-3.5" />
              )}
            </div>
            <div>
              <div className="font-medium">
                {it.direction === "out"
                  ? `Paid ${it.counterpartyLabel}`
                  : `Received from ${it.counterpartyLabel}`}
              </div>
              <div className="text-xs text-neutral-500">{fmtWhen(it.timestamp)}</div>
            </div>
          </div>
          <div
            className={
              it.direction === "out"
                ? "tabular-nums font-medium text-red-600"
                : "tabular-nums font-medium text-emerald-600"
            }
          >
            {it.direction === "out" ? "−" : "+"}
            {fmtUsd(it.amountUsd)}
          </div>
        </div>
      ))}
    </div>
  );
}
