import "server-only";

import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import type {
  AuthenticationResponseJSON,
  RegistrationResponseJSON,
} from "@simplewebauthn/types";

// Direct WebAuthn ceremony — no Turnkey, no ZeroDev passkey server. We run
// registration and authentication ourselves via @simplewebauthn/server and
// persist the credential id + COSE public key on the User row so we can
// re-verify assertions on every admin mutation.

export const RP_ID = process.env.WEBAUTHN_RP_ID ?? "localhost";
export const RP_NAME = process.env.WEBAUTHN_RP_NAME ?? "Rein";

function origin(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

export async function buildRegistrationOptions(params: {
  userId: string;
  userName: string;
}) {
  return generateRegistrationOptions({
    rpID: RP_ID,
    rpName: RP_NAME,
    userName: params.userName,
    userID: new TextEncoder().encode(params.userId),
    attestationType: "none",
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred",
    },
  });
}

export async function verifyRegistration(params: {
  response: RegistrationResponseJSON;
  expectedChallenge: string;
}) {
  const result = await verifyRegistrationResponse({
    response: params.response,
    expectedChallenge: params.expectedChallenge,
    expectedOrigin: origin(),
    expectedRPID: RP_ID,
    requireUserVerification: false,
  });

  if (!result.verified || !result.registrationInfo) {
    throw new Error("Passkey registration could not be verified.");
  }

  const info = result.registrationInfo;
  const cred = info.credential;
  return {
    credentialId: cred.id,
    publicKey: Buffer.from(cred.publicKey).toString("base64url"),
    counter: cred.counter,
  };
}

export async function buildAuthenticationOptions(params: {
  allowCredentialId?: string;
}) {
  return generateAuthenticationOptions({
    rpID: RP_ID,
    userVerification: "preferred",
    allowCredentials: params.allowCredentialId
      ? [
          {
            id: params.allowCredentialId,
            transports: ["internal", "hybrid", "usb", "ble", "nfc"],
          },
        ]
      : undefined,
  });
}

export async function verifyAssertion(params: {
  response: AuthenticationResponseJSON;
  expectedChallenge: string;
  credential: {
    id: string;
    publicKey: string;
    counter: number;
  };
}) {
  const result = await verifyAuthenticationResponse({
    response: params.response,
    expectedChallenge: params.expectedChallenge,
    expectedOrigin: origin(),
    expectedRPID: RP_ID,
    credential: {
      id: params.credential.id,
      publicKey: new Uint8Array(
        Buffer.from(params.credential.publicKey, "base64url"),
      ),
      counter: params.credential.counter,
    },
    requireUserVerification: false,
  });

  if (!result.verified) {
    throw new Error("Passkey assertion failed verification.");
  }
  return { newCounter: result.authenticationInfo.newCounter };
}
