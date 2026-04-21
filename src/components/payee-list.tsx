"use client";

export type PayeeRow = {
  id: string;
  label: string;
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
          className="flex items-center justify-between px-4 py-3 text-sm"
        >
          <div className="font-medium">{p.label}</div>
          <div className="text-xs text-neutral-500">
            Added {new Date(p.createdAt).toLocaleDateString()}
          </div>
        </div>
      ))}
    </div>
  );
}
