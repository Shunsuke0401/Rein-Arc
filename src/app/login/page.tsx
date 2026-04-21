import { redirect } from "next/navigation";

import { LoginForm } from "@/components/login-form";
import { getSession } from "@/lib/auth";

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect("/dashboard");

  return (
    <main className="min-h-screen bg-white flex flex-col">
      <nav className="max-w-6xl mx-auto px-6 py-5 flex justify-between items-center w-full">
        <span className="font-semibold text-xl tracking-tight">rein</span>
      </nav>
      <section className="flex-1 flex items-center justify-center px-6 py-10">
        <LoginForm />
      </section>
    </main>
  );
}
