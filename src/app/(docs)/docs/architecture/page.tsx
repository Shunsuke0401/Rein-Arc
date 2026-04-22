import {
  Callout,
  Code,
  H1,
  H2,
  Lead,
  LI,
  P,
  Pre,
  UL,
} from "@/components/docs-prose";

export const metadata = {
  title: "Architecture — Rein docs",
  description:
    "How Rein works: ZeroDev Kernel v3 smart accounts on Arc, session keys with on-chain call and rate-limit policies, TEE-style custody.",
};

export default function ArchitecturePage() {
  return (
    <article>
      <div className="text-xs uppercase tracking-wider text-neutral-500 mb-2">
        Documentation
      </div>
      <H1>Architecture</H1>
      <Lead>
        Rein is a thin layer over ERC-4337 smart accounts. Every agent is a
        Kernel account on Arc with one or more session keys scoped by policies
        the smart account itself enforces.
      </Lead>

      <H2 id="layers">Three layers</H2>
      <Pre>{`Company        = the customer               (1 WebAuthn passkey)
 └── Agent     = a named spender             (1 ZeroDev Kernel, holds USDC)
      ├── Payee      = a label'd destination (server-only)
      └── Permission = a scoped API key      (1 session key on the Kernel)`}</Pre>
      <P>
        Balance lives on the Agent. An API key = a Permission = a session key
        on that Agent&rsquo;s smart account. Today every Agent gets exactly one
        Permission issued at creation; a future release will let a single
        Agent issue multiple scoped keys for different callers.
      </P>

      <H2 id="smart-accounts">Smart accounts on Arc</H2>
      <P>
        Agents are{" "}
        <a
          href="https://docs.zerodev.app/"
          className="underline hover:no-underline"
          target="_blank"
          rel="noreferrer"
        >
          ZeroDev
        </a>{" "}
        Kernel v3.1 accounts on{" "}
        <a
          href="https://arc.network"
          className="underline hover:no-underline"
          target="_blank"
          rel="noreferrer"
        >
          Arc
        </a>
        , Circle&rsquo;s L1 where USDC is the native gas token. Deploying the
        Kernel + installing a session key is sponsored end-to-end by the
        ZeroDev paymaster — agents never hold gas.
      </P>
      <P>
        The Kernel&rsquo;s sudo validator is an ECDSA key we generate per
        agent and encrypt at rest (AES-256-GCM under{" "}
        <Code>APP_ENCRYPTION_KEY</Code>). It only signs administrative flows
        — installing permissions, revoking, archiving. Every customer-facing
        payment is signed by a session key instead.
      </P>

      <H2 id="session-keys">Session keys &amp; on-chain policies</H2>
      <P>
        Each Permission installs a{" "}
        <a
          href="https://docs.zerodev.app/permissions/intro"
          className="underline hover:no-underline"
          target="_blank"
          rel="noreferrer"
        >
          ZeroDev session key plugin
        </a>{" "}
        on the Kernel with two policies the validator enforces before any
        userOp executes:
      </P>
      <UL>
        <LI>
          <Code>CallPolicy v0.0.5</Code> — pins the target to the USDC ERC-20
          contract, the selector to <Code>transfer(address,uint256)</Code>,
          the <b>recipient</b> argument to the permission&rsquo;s payee
          allow-list via <Code>ParamCondition.ONE_OF</Code>, and the{" "}
          <b>amount</b> argument to <Code>LESS_THAN perPaymentCapWei + 1</Code>.
        </LI>
        <LI>
          <Code>RateLimitPolicy</Code> — approximates a monthly cap as{" "}
          <Code>ceil(monthlyLimitUsd / perPaymentLimitUsd)</Code> transfers
          per 30-day window. Once the quota is burned, further calls revert
          at validation time.
        </LI>
      </UL>
      <Callout tone="info" title="Why this matters">
        A compromised Rein server cannot widen these caps. The policies live
        in the smart account&rsquo;s validator — not in application code —
        so an attacker with full DB access still can&rsquo;t drain an agent
        or send to a new recipient.
      </Callout>

      <H2 id="custody">Custody of the signing material</H2>
      <UL>
        <LI>
          The Kernel <b>owner</b> ECDSA key is encrypted at rest with
          AES-256-GCM. Plaintext exists only in-memory during an admin
          request.
        </LI>
        <LI>
          The <b>session key</b> private key is the <Code>apiSecret</Code>
          half of your <Code>REIN_API_KEY</Code>. It is returned <b>once</b>{" "}
          at permission creation and never persisted server-side in
          plaintext. The server stores only the <i>serialized permission
          account</i> (policy structure + session key address) encrypted at
          rest.
        </LI>
        <LI>
          Every payment request must present the <Code>apiSecret</Code> in
          the <Code>Authorization: Bearer</Code> header — the server
          reconstructs the signer per-request and submits the userOp.
        </LI>
      </UL>

      <H2 id="gas">Gas</H2>
      <P>
        ZeroDev&rsquo;s paymaster sponsors every userOp — Kernel deployment,
        session-key install, payment sends, revoke. On Arc that means the
        paymaster pays USDC for gas; agents hold only the customer&rsquo;s
        funded balance.
      </P>

      <H2 id="enforcement-table">On-chain vs server-side enforcement</H2>
      <div className="overflow-x-auto my-4 rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wider text-neutral-500">
            <tr>
              <th className="px-4 py-2 font-medium">Rule</th>
              <th className="px-4 py-2 font-medium">Enforced by</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            <tr>
              <td className="px-4 py-2">Target contract = USDC</td>
              <td className="px-4 py-2">
                <b>On-chain</b> (CallPolicy)
              </td>
            </tr>
            <tr>
              <td className="px-4 py-2">Function = transfer</td>
              <td className="px-4 py-2">
                <b>On-chain</b> (CallPolicy)
              </td>
            </tr>
            <tr>
              <td className="px-4 py-2">Recipient ∈ payee allow-list</td>
              <td className="px-4 py-2">
                <b>On-chain</b> (CallPolicy + ONE_OF)
              </td>
            </tr>
            <tr>
              <td className="px-4 py-2">Amount ≤ per-payment cap</td>
              <td className="px-4 py-2">
                <b>On-chain</b> (CallPolicy + LESS_THAN)
              </td>
            </tr>
            <tr>
              <td className="px-4 py-2">Monthly cap</td>
              <td className="px-4 py-2">
                <b>On-chain</b> (RateLimitPolicy, approximated)
              </td>
            </tr>
            <tr>
              <td className="px-4 py-2">Label → address resolution</td>
              <td className="px-4 py-2">Server-side</td>
            </tr>
            <tr>
              <td className="px-4 py-2">Activity history rendering</td>
              <td className="px-4 py-2">Server-side</td>
            </tr>
          </tbody>
        </table>
      </div>

      <H2 id="source">Source references</H2>
      <UL>
        <LI>
          <Code>src/lib/kernel.ts</Code> — Kernel account construction, session
          key install, policy encoding.
        </LI>
        <LI>
          <Code>src/lib/encryption.ts</Code> — AES-256-GCM for at-rest keys.
        </LI>
        <LI>
          <Code>src/lib/sdk-auth.ts</Code> — Bearer token parsing for the
          public <Code>/api/v1/*</Code> surface.
        </LI>
        <LI>
          <Code>scripts/deploy-zerodev-policies.ts</Code> — one-shot deploy of
          the ZeroDev permission contracts on Arc via Arachnid&rsquo;s CREATE2
          factory.
        </LI>
      </UL>
    </article>
  );
}
