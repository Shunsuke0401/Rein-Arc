"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  startAuthentication,
  startRegistration,
} from "@simplewebauthn/browser";
import { KeyRound, Loader2, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";

type Mode = "signin" | "signup";

export function LoginForm() {
  const router = useRouter();
  const { toast } = useToast();
  const [mode, setMode] = React.useState<Mode>("signup");
  const [email, setEmail] = React.useState("");
  const [companyName, setCompanyName] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const optionsResp = await fetch("/api/auth/signup/options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, companyName }),
      });
      const optionsBody = await optionsResp.json();
      if (!optionsResp.ok)
        throw new Error(optionsBody.error ?? "Couldn't start signup");

      const registrationResponse = await startRegistration({
        optionsJSON: optionsBody.options,
      });

      const resp = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, companyName, registrationResponse }),
      });
      const body = await resp.json();
      if (!resp.ok) throw new Error(body.error ?? "Signup failed");

      toast({
        title: "Welcome to Rein",
        description: `Company "${body.user.companyName}" is ready.`,
        variant: "success",
      });
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Unknown error during signup";
      toast({
        title: "Signup failed",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleSignin(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const optionsResp = await fetch("/api/auth/login/options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const optionsBody = await optionsResp.json();
      if (!optionsResp.ok)
        throw new Error(optionsBody.error ?? "Couldn't start sign-in");

      const authenticationResponse = await startAuthentication({
        optionsJSON: optionsBody.options,
      });

      const resp = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, authenticationResponse }),
      });
      const body = await resp.json();
      if (!resp.ok) throw new Error(body.error ?? "Login failed");

      toast({ title: "Signed in", variant: "success" });
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Unknown error during sign-in";
      toast({
        title: "Sign-in failed",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <div className="inline-flex items-center gap-2 self-start rounded-full border bg-neutral-50 px-2.5 py-0.5 text-xs text-neutral-600">
          <ShieldCheck className="h-3 w-3" /> Passkey-secured
        </div>
        <CardTitle className="mt-3 text-2xl">
          {mode === "signup" ? "Create your Rein account" : "Sign in to Rein"}
        </CardTitle>
        <CardDescription>
          {mode === "signup"
            ? "We'll register a passkey on this device. That passkey is how you'll sign in and authorize your agents."
            : "Authenticate with the passkey you registered at signup."}
        </CardDescription>
      </CardHeader>
      <form onSubmit={mode === "signup" ? handleSignup : handleSignin}>
        <CardContent className="space-y-4">
          {mode === "signup" ? (
            <div className="space-y-2">
              <Label htmlFor="companyName">Company name</Label>
              <Input
                id="companyName"
                placeholder="Acme, Inc."
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                required
                maxLength={80}
                disabled={busy}
              />
            </div>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="email">Work email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={busy}
            />
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          <Button type="submit" disabled={busy} className="w-full" size="lg">
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />{" "}
                {mode === "signup" ? "Provisioning…" : "Authenticating…"}
              </>
            ) : (
              <>
                <KeyRound className="h-4 w-4" />{" "}
                {mode === "signup"
                  ? "Create passkey & sign up"
                  : "Sign in with passkey"}
              </>
            )}
          </Button>
          <button
            type="button"
            className="text-sm text-neutral-600 hover:text-foreground"
            onClick={() =>
              setMode((m) => (m === "signup" ? "signin" : "signup"))
            }
            disabled={busy}
          >
            {mode === "signup"
              ? "Already have a Rein account? Sign in"
              : "New here? Create an account"}
          </button>
        </CardFooter>
      </form>
    </Card>
  );
}
