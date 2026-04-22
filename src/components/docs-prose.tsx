"use client";

import { Check, Copy } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";

// Shared prose primitives used by every /docs/* page so typography and code
// blocks stay consistent without pulling in @tailwindcss/typography or MDX.

export function H1({ children, id }: { children: React.ReactNode; id?: string }) {
  return (
    <h1
      id={id}
      className="text-3xl font-semibold tracking-tight text-foreground mb-3"
    >
      {children}
    </h1>
  );
}

export function H2({ children, id }: { children: React.ReactNode; id?: string }) {
  return (
    <h2
      id={id}
      className="mt-10 mb-3 text-xl font-semibold tracking-tight text-foreground scroll-mt-20"
    >
      {children}
    </h2>
  );
}

export function H3({ children, id }: { children: React.ReactNode; id?: string }) {
  return (
    <h3
      id={id}
      className="mt-6 mb-2 text-base font-semibold tracking-tight text-foreground scroll-mt-20"
    >
      {children}
    </h3>
  );
}

export function Lead({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-lg text-neutral-600 leading-relaxed mb-6">{children}</p>
  );
}

export function P({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-neutral-700 leading-7 mb-4">{children}</p>;
}

export function UL({ children }: { children: React.ReactNode }) {
  return (
    <ul className="list-disc pl-6 text-sm text-neutral-700 leading-7 mb-4 space-y-1">
      {children}
    </ul>
  );
}

export function LI({ children }: { children: React.ReactNode }) {
  return <li>{children}</li>;
}

export function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded bg-neutral-100 border px-1.5 py-0.5 font-mono text-[0.85em] text-neutral-800">
      {children}
    </code>
  );
}

export function Pre({ children, language }: { children: string; language?: string }) {
  const [copied, setCopied] = React.useState(false);
  async function copy() {
    await navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <div className="relative my-4">
      {language ? (
        <div className="absolute top-2 left-3 text-[10px] uppercase tracking-wider text-neutral-500 font-mono">
          {language}
        </div>
      ) : null}
      <pre className="rounded-lg border bg-neutral-950 text-neutral-100 p-4 pt-7 text-xs overflow-x-auto whitespace-pre leading-relaxed font-mono">
        {children}
      </pre>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={copy}
        className="absolute top-2 right-2 bg-background h-7 px-2 text-xs"
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
  );
}

export function Callout({
  tone = "info",
  title,
  children,
}: {
  tone?: "info" | "warn" | "soon";
  title?: string;
  children: React.ReactNode;
}) {
  const palette =
    tone === "warn"
      ? "border-amber-200 bg-amber-50 text-amber-900"
      : tone === "soon"
      ? "border-neutral-300 bg-neutral-50 text-neutral-700"
      : "border-blue-200 bg-blue-50 text-blue-900";
  return (
    <div className={`rounded-lg border p-4 my-4 text-sm ${palette}`}>
      {title ? <div className="font-medium mb-1">{title}</div> : null}
      <div className="leading-relaxed">{children}</div>
    </div>
  );
}

export function EndpointBlock({
  method,
  path,
  description,
  request,
  response,
  errors,
  example,
}: {
  method: "GET" | "POST";
  path: string;
  description: React.ReactNode;
  request?: string;
  response: string;
  errors?: { code: string; meaning: string }[];
  example: string;
}) {
  const methodColor =
    method === "POST"
      ? "bg-emerald-100 text-emerald-800 border-emerald-200"
      : "bg-sky-100 text-sky-800 border-sky-200";
  return (
    <section className="my-8 rounded-xl border bg-white overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 border-b bg-neutral-50">
        <span
          className={`inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-mono font-semibold ${methodColor}`}
        >
          {method}
        </span>
        <code className="font-mono text-sm text-neutral-900 break-all">
          {path}
        </code>
      </div>
      <div className="p-4 space-y-4">
        <p className="text-sm text-neutral-700 leading-relaxed">
          {description}
        </p>
        {request ? (
          <div>
            <div className="text-xs uppercase tracking-wider text-neutral-500 mb-1">
              Request body
            </div>
            <Pre language="json">{request}</Pre>
          </div>
        ) : null}
        <div>
          <div className="text-xs uppercase tracking-wider text-neutral-500 mb-1">
            Response
          </div>
          <Pre language="json">{response}</Pre>
        </div>
        {errors && errors.length ? (
          <div>
            <div className="text-xs uppercase tracking-wider text-neutral-500 mb-1">
              Errors
            </div>
            <div className="rounded-md border divide-y text-sm">
              {errors.map((e) => (
                <div key={e.code} className="px-3 py-2 flex gap-3">
                  <Code>{e.code}</Code>
                  <span className="text-neutral-700">{e.meaning}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
        <div>
          <div className="text-xs uppercase tracking-wider text-neutral-500 mb-1">
            Example
          </div>
          <Pre language="bash">{example}</Pre>
        </div>
      </div>
    </section>
  );
}
