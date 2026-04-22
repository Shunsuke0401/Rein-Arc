import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus } from "lucide-react";
import type { Address } from "viem";

import { ActivityList } from "@/components/activity-list";
import { AgentDepositPanel } from "@/components/agent-deposit-panel";
import { ArchiveDialog } from "@/components/archive-dialog";
import { IntegratePanel } from "@/components/integrate-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PayeeForm } from "@/components/payee-form";
import { PayeeList } from "@/components/payee-list";
import { PermissionList, type PermissionRow } from "@/components/permission-list";
import { getAgentActivity } from "@/lib/activity";
import { summarizeAgent } from "@/lib/agents";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";

function formatUsd(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(n);
}

const OPERATION_LABELS: Record<string, string> = {
  send_payment: "Send payment",
  approve_vendor: "Approve vendor",
  receive_refund: "Receive refund",
};

export default async function AgentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;
  const { tab } = await searchParams;
  const activeTab = (tab ?? "overview") as
    | "overview"
    | "permissions"
    | "payees"
    | "integrate";

  const agent = await db.agent.findUnique({
    where: { id },
    include: {
      permissions: { orderBy: { createdAt: "desc" } },
      payees: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!agent || agent.userId !== session.id) notFound();

  const [summary, activity] = await Promise.all([
    summarizeAgent(agent),
    getAgentActivity(agent.id, agent.accountAddress as Address, 25),
  ]);

  const payeeLabels = Object.fromEntries(
    agent.payees.map((p) => [p.id, p.label] as const),
  );

  const permissions: PermissionRow[] = agent.permissions.map((p) => {
    const scope = JSON.parse(p.scope) as {
      perPaymentLimitUsd: number;
      monthlyLimitUsd: number;
      payeeIds: string[];
      allowedOperations: string[];
    };
    return {
      id: p.id,
      name: p.name,
      status: p.status,
      perPaymentLimitUsd: scope.perPaymentLimitUsd,
      monthlyLimitUsd: scope.monthlyLimitUsd,
      payeeIds: scope.payeeIds,
      allowedOperations: scope.allowedOperations,
      createdAt: p.createdAt.toISOString(),
    };
  });

  const activePermissionCount = permissions.filter(
    (p) => p.status === "active",
  ).length;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/dashboard/agents"
          className="text-sm text-neutral-600 hover:text-foreground"
        >
          ← All agents
        </Link>
        <div className="mt-2 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">
                {agent.name}
              </h1>
              <Badge
                variant={
                  agent.status === "active"
                    ? "success"
                    : agent.status === "archived"
                      ? "secondary"
                      : "outline"
                }
              >
                {agent.status}
              </Badge>
            </div>
            <p className="text-sm text-neutral-600 mt-1">
              {activePermissionCount} active permission
              {activePermissionCount === 1 ? "" : "s"} ·{" "}
              {agent.payees.length} payee
              {agent.payees.length === 1 ? "" : "s"}
            </p>
          </div>
          {agent.status === "active" ? (
            <div className="flex gap-2">
              <AgentDepositPanel agentId={agent.id} agentName={agent.name} />
              <ArchiveDialog agentId={agent.id} agentName={agent.name} />
            </div>
          ) : null}
        </div>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Balance</CardDescription>
            <CardTitle className="text-3xl tabular-nums">
              {formatUsd(summary.balanceUsd)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Spent this month</CardDescription>
            <CardTitle className="text-3xl tabular-nums">
              {formatUsd(summary.spentThisMonthUsd)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Permissions</CardDescription>
            <CardTitle className="text-3xl tabular-nums">
              {activePermissionCount}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="flex gap-1 border-b">
        <TabLink
          id="overview"
          label="Overview"
          active={activeTab === "overview"}
          href={`/dashboard/agents/${agent.id}?tab=overview`}
        />
        <TabLink
          id="permissions"
          label="Permissions"
          active={activeTab === "permissions"}
          href={`/dashboard/agents/${agent.id}?tab=permissions`}
        />
        <TabLink
          id="payees"
          label="Payees"
          active={activeTab === "payees"}
          href={`/dashboard/agents/${agent.id}?tab=payees`}
        />
        <TabLink
          id="integrate"
          label="Integrate"
          active={activeTab === "integrate"}
          href={`/dashboard/agents/${agent.id}?tab=integrate`}
        />
      </div>

      {activeTab === "overview" ? (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Activity</CardTitle>
              <CardDescription>
                Recent payments in and out of {agent.name}.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ActivityList
                items={activity.map((a) => ({
                  timestamp: a.timestamp,
                  direction: a.direction,
                  counterpartyLabel: a.counterpartyLabel,
                  amountUsd: a.amountUsd,
                }))}
              />
            </CardContent>
          </Card>
          {permissions.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Limits summary</CardTitle>
                <CardDescription>
                  What each active permission can spend.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="divide-y rounded-md border">
                  {permissions
                    .filter((p) => p.status === "active")
                    .map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between px-4 py-3 text-sm"
                      >
                        <div>
                          <div className="font-medium">{p.name}</div>
                          <div className="text-xs text-neutral-500">
                            {p.allowedOperations
                              .map((op) => OPERATION_LABELS[op] ?? op)
                              .join(" · ")}
                          </div>
                        </div>
                        <div className="text-right text-sm tabular-nums">
                          <div>{formatUsd(p.perPaymentLimitUsd)} / payment</div>
                          <div className="text-xs text-neutral-500">
                            {formatUsd(p.monthlyLimitUsd)} / month
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          ) : null}
        </div>
      ) : null}

      {activeTab === "permissions" ? (
        <div className="space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-semibold">Permissions</h2>
              <p className="text-sm text-neutral-600 mt-0.5">
                Each permission is a credential your agent runtime uses to
                make payments, with its own limits and payees.
              </p>
            </div>
            {agent.status === "active" ? (
              <Button asChild>
                <Link href={`/dashboard/agents/${agent.id}/permissions/new`}>
                  <Plus className="h-4 w-4" /> New permission
                </Link>
              </Button>
            ) : null}
          </div>
          <PermissionList
            agentId={agent.id}
            permissions={permissions}
            payeeLabels={payeeLabels}
          />
        </div>
      ) : null}

      {activeTab === "payees" ? (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Payees</h2>
            <p className="text-sm text-neutral-600 mt-0.5">
              Add a payee to give permissions a destination for payments.
              Once added, payees are shown by label only.
            </p>
          </div>
          {agent.status === "active" ? (
            <Card>
              <CardContent className="pt-6">
                <PayeeForm agentId={agent.id} />
              </CardContent>
            </Card>
          ) : null}
          <PayeeList
            payees={agent.payees.map((p) => ({
              id: p.id,
              label: p.label,
              address: p.address,
              createdAt: p.createdAt.toISOString(),
            }))}
          />
        </div>
      ) : null}

      {activeTab === "integrate" ? (
        <IntegratePanel
          agentName={agent.name}
          firstPayeeLabel={agent.payees[0]?.label}
          hasPermission={permissions.some((p) => p.status === "active")}
        />
      ) : null}
    </div>
  );
}

function TabLink({
  id,
  label,
  active,
  href,
}: {
  id: string;
  label: string;
  active: boolean;
  href: string;
}) {
  return (
    <Link
      href={href}
      className={
        active
          ? "px-4 py-2 text-sm font-medium border-b-2 border-foreground -mb-px"
          : "px-4 py-2 text-sm text-neutral-500 hover:text-foreground -mb-px"
      }
      scroll={false}
      id={`tab-${id}`}
    >
      {label}
    </Link>
  );
}
