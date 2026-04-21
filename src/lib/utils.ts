import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatUsd(cents: bigint | number): string {
  const n = typeof cents === "bigint" ? Number(cents) : cents;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(n / 100);
}

export function truncateAddress(addr: string, chars = 4): string {
  if (!addr) return "";
  return `${addr.slice(0, 2 + chars)}…${addr.slice(-chars)}`;
}

export function shortHash(hash: string, chars = 6): string {
  if (!hash) return "";
  return `${hash.slice(0, 2 + chars)}…${hash.slice(-chars)}`;
}
