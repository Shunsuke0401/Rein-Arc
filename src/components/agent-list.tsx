"use client";

import { ArrowRight, Archive, MoreHorizontal } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type AgentRow = {
  id: string;
  name: string;
  balanceUsd: number;
  spentThisMonthUsd: number;
  permissionCount: number;
  status: string;
  createdAt: string;
};

function formatUsd(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(n);
}

export function AgentList({ agents }: { agents: AgentRow[] }) {
  return (
    <div className="rounded-lg border bg-white">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Balance</TableHead>
            <TableHead>Spent this month</TableHead>
            <TableHead>Permissions</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {agents.map((a) => (
            <TableRow key={a.id}>
              <TableCell className="font-medium">
                <Link
                  href={`/dashboard/agents/${a.id}`}
                  className="hover:underline"
                >
                  {a.name}
                </Link>
              </TableCell>
              <TableCell className="tabular-nums">
                {formatUsd(a.balanceUsd)}
              </TableCell>
              <TableCell className="tabular-nums text-neutral-600">
                {formatUsd(a.spentThisMonthUsd)}
              </TableCell>
              <TableCell className="text-sm">
                {a.permissionCount === 0 ? (
                  <span className="text-neutral-500">—</span>
                ) : (
                  a.permissionCount
                )}
              </TableCell>
              <TableCell>
                <Badge
                  variant={
                    a.status === "active"
                      ? "success"
                      : a.status === "paused"
                        ? "secondary"
                        : "outline"
                  }
                >
                  {a.status}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <Button asChild size="sm" variant="outline">
                  <Link href={`/dashboard/agents/${a.id}`}>
                    Open <ArrowRight className="h-3 w-3" />
                  </Link>
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="p-3 text-xs text-neutral-500 border-t flex items-center justify-between">
        <span>
          {agents.length} agent{agents.length === 1 ? "" : "s"}
        </span>
        <Link href="/dashboard/agents/new" className="hover:text-foreground">
          + New agent
        </Link>
      </div>
    </div>
  );
}
