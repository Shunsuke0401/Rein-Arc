// SDK payees endpoint. Returns saved payees (id + label only — never
// addresses) for the authenticated permission. If the permission is
// "open mode" (no payee allow-list pinned), returns an empty list.

import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { authenticateSdkRequest } from "@/lib/sdk-auth";

export async function GET(req: Request) {
  const auth = await authenticateSdkRequest(req);
  if (!auth.ok) return auth.response;

  const scope = JSON.parse(auth.permission.scope) as {
    payeeIds?: string[];
  };

  if (!scope.payeeIds?.length) {
    return NextResponse.json({ payees: [], mode: "open" });
  }

  const rows = await db.payee.findMany({
    where: { id: { in: scope.payeeIds } },
    select: { id: true, label: true },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ payees: rows, mode: "closed" });
}
