/**
 * rein-sdk — bounded payments for AI agents.
 *
 * Minimal client. One API key. Every call is auth-gated and every payment
 * is signed server-side by an on-chain-scoped session key. The caps, payee
 * allow-list, and monthly rate-limit are enforced by the smart account
 * itself — over-spend attempts revert before any money moves.
 *
 * Usage:
 *
 *   import { Rein } from "rein-sdk";
 *
 *   const rein = new Rein({ apiKey: process.env.REIN_API_KEY! });
 *
 *   const payment = await rein.payments.create({
 *     to: "0x5D262Ad5F60189Bb21Eb6cF6BCA7Db04F2C01518", // raw address only
 *     amountUsd: 50,
 *   });
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ReinErrorCode =
  | "INVALID_API_KEY"
  | "INSUFFICIENT_BALANCE"
  | "PERMISSION_CAP_EXCEEDED"
  | "PAYEE_NOT_ALLOWED"
  | "PAYMENT_IN_FLIGHT"
  | "NOT_FOUND"
  | "NETWORK_ERROR"
  | "INTERNAL";

export class ReinError extends Error {
  readonly code: ReinErrorCode;
  readonly status: number;
  readonly requestId?: string;

  constructor(opts: {
    code: ReinErrorCode;
    message: string;
    status: number;
    requestId?: string;
  }) {
    super(opts.message);
    this.name = "ReinError";
    this.code = opts.code;
    this.status = opts.status;
    this.requestId = opts.requestId;
  }
}

export type Payment = {
  id: string;
  status: "pending" | "confirmed" | "failed";
  amountUsd: number;
  to: string;
  createdAt: string;
};

export type AgentStatus = {
  name: string;
  balanceUsd: number;
  spentThisMonthUsd: number;
  perPaymentLimitUsd: number;
  monthlyLimitUsd: number;
  remainingMonthlyUsd: number;
  status: "active" | "paused" | "revoked";
};

export type Payee = {
  id: string;
  label: string;
};

export type ActivityEntry = {
  timestamp: string;
  direction: "out" | "in";
  counterpartyLabel: string;
  amountUsd: number;
  status: "pending" | "confirmed" | "failed";
};

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

const DEFAULT_BASE_URL = "https://rein-arc-production.up.railway.app";
const DEFAULT_TIMEOUT_MS = 30_000;

export type ReinOptions = {
  apiKey: string;
  baseUrl?: string;
  timeoutMs?: number;
  fetch?: typeof fetch;
};

export class Rein {
  readonly payments: PaymentsResource;
  readonly agent: AgentResource;

  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: ReinOptions) {
    if (!opts.apiKey || !opts.apiKey.startsWith("rein_")) {
      throw new ReinError({
        code: "INVALID_API_KEY",
        message: "apiKey must be a Rein API key (starts with 'rein_').",
        status: 400,
      });
    }
    this.apiKey = opts.apiKey;
    this.baseUrl = (opts.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
    this.timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.fetchImpl = opts.fetch ?? globalThis.fetch;
    this.payments = new PaymentsResource(this);
    this.agent = new AgentResource(this);
  }

  /** @internal */
  async request<T>(
    method: "GET" | "POST",
    path: string,
    body?: unknown,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const resp = await this.fetchImpl(url, {
        method,
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${this.apiKey}`,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
      const requestId = resp.headers.get("x-request-id") ?? undefined;
      let payload: unknown;
      try {
        payload = await resp.json();
      } catch {
        payload = null;
      }
      if (!resp.ok) {
        const data = (payload ?? {}) as {
          error?: string;
          code?: ReinErrorCode;
        };
        throw new ReinError({
          code: data.code ?? mapStatus(resp.status),
          message: data.error ?? resp.statusText ?? "Request failed.",
          status: resp.status,
          requestId,
        });
      }
      return payload as T;
    } catch (err) {
      if (err instanceof ReinError) throw err;
      if (err instanceof DOMException && err.name === "AbortError") {
        throw new ReinError({
          code: "NETWORK_ERROR",
          message: `Request to ${path} timed out after ${this.timeoutMs}ms.`,
          status: 0,
        });
      }
      throw new ReinError({
        code: "NETWORK_ERROR",
        message: err instanceof Error ? err.message : "Network error.",
        status: 0,
      });
    } finally {
      clearTimeout(timer);
    }
  }
}

function mapStatus(status: number): ReinErrorCode {
  if (status === 401) return "INVALID_API_KEY";
  if (status === 402) return "INSUFFICIENT_BALANCE";
  if (status === 403) return "PERMISSION_CAP_EXCEEDED";
  if (status === 404) return "NOT_FOUND";
  if (status === 429) return "PAYMENT_IN_FLIGHT";
  if (status >= 500) return "INTERNAL";
  return "INTERNAL";
}

// ---------------------------------------------------------------------------
// Resources
// ---------------------------------------------------------------------------

export type CreatePaymentInput = {
  /**
   * Recipient address. Must be a `0x…` 40-hex-char EVM address. Labels are
   * NOT accepted — the on-chain allow-list pins specific addresses, and
   * server-side label resolution has been removed to eliminate the
   * ambiguity of duplicate or typo'd labels.
   */
  to: `0x${string}`;
  amountUsd: number;
  /** Optional memo stored server-side; never touches the chain. */
  note?: string;
};

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

class PaymentsResource {
  constructor(private readonly client: Rein) {}

  async create(input: CreatePaymentInput): Promise<Payment> {
    if (!ADDRESS_RE.test(input.to)) {
      throw new ReinError({
        code: "PAYEE_NOT_ALLOWED",
        message:
          "`to` must be a 0x-address (40 hex chars). Labels are not accepted.",
        status: 400,
      });
    }
    const resp = await this.client.request<{ payment: Payment }>(
      "POST",
      "/api/v1/payments",
      input,
    );
    return resp.payment;
  }
}

class AgentResource {
  constructor(private readonly client: Rein) {}

  async status(): Promise<AgentStatus> {
    const resp = await this.client.request<{ agent: AgentStatus }>(
      "GET",
      "/api/v1/agent",
    );
    return resp.agent;
  }

  async payees(): Promise<Payee[]> {
    const resp = await this.client.request<{ payees: Payee[] }>(
      "GET",
      "/api/v1/agent/payees",
    );
    return resp.payees;
  }

  async activity(opts: { limit?: number } = {}): Promise<ActivityEntry[]> {
    const limit = opts.limit ?? 10;
    const resp = await this.client.request<{ activity: ActivityEntry[] }>(
      "GET",
      `/api/v1/agent/activity?limit=${limit}`,
    );
    return resp.activity;
  }
}
