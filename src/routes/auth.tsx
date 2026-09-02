import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/lib/api-client";
import { toast } from "sonner";
import { z } from "zod";
import { withTimeout } from "@/lib/supabase-timeout";

type AuthSearch = { mode?: "signin" | "signup"; redirect?: string };

export const Route = createFileRoute("/auth")({
  component: Auth,
  validateSearch: (s: Record<string, unknown>): AuthSearch => ({
    mode: s.mode === "signup" ? "signup" : s.mode === "signin" ? "signin" : undefined,
    redirect: typeof s.redirect === "string" ? s.redirect : undefined,
  }),
  head: () => ({ meta: [{ title: "Sign in · Néra Wear" }] }),
});

const emailSchema = z.string().trim().email().max(255);

function Auth() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [mode, setMode] = useState<"signin" | "signup">(search.mode ?? "signin");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const redirect = search.redirect;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!emailSchema.safeParse(email).success) {
      setErr("Enter a valid email.");
      return toast.error("Enter a valid email.");
    }
    if (pw.length < 6) {
      setErr("Password must be at least 6 characters.");
      return toast.error("Password must be at least 6 characters.");
    }
    setBusy(true);
    try {
      if (mode === "signup") {
        // After confirming email, Supabase will redirect to /auth — user lands on sign-in tab
        const confirmRedirect = `${window.location.origin}/auth?mode=signin${redirect ? `&redirect=${encodeURIComponent(redirect)}` : ""}`;
        const { error } = await withTimeout(
          supabase.auth.signUp({
            email,
            password: pw,
            options: {
              emailRedirectTo: confirmRedirect,
              data: { full_name: name },
            },
          }),
          "Creating your account",
        );
        if (error) throw error;
        toast.success("Account created. Check your email to confirm, then sign in.");
        setMode("signin");
      } else {
        const { error } = await withTimeout(
          supabase.auth.signInWithPassword({ email, password: pw }),
          "Signing you in",
        );
        if (error) throw error;
        // Preserve a full same-origin relative path (may include a query string,
        // e.g. the assistant consent screen) — router navigate can't carry raw search.
        if (redirect && redirect.startsWith("/") && !redirect.startsWith("//")) {
          window.location.replace(redirect);
        } else {
          navigate({ to: "/account", replace: true });
        }
        toast.success("Welcome back.");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Something went wrong. Please try again.";
      const msg = /confirm/i.test(message)
        ? "Please confirm your email first — check your inbox for the confirmation link."
        : message;
      setErr(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mx-auto max-w-md px-6 py-20">
      <div className="mb-10 text-center">
        <div className="serif mb-2 text-3xl font-light tracking-[0.2em]">NÉRA WEAR</div>
        <div className="text-[0.6rem] uppercase tracking-[0.3em] text-[color:var(--color-mocha)]">
          {mode === "signin" ? "Sign in" : "Create account"}
        </div>
        {redirect === "/checkout" && (
          <p className="mt-4 text-[0.7rem] leading-[1.8] text-neutral-600">
            {mode === "signup"
              ? "Create an account to complete your order."
              : "Sign in to continue to checkout."}
          </p>
        )}
      </div>
      <form onSubmit={submit} className="space-y-5 border border-[color:var(--color-border)] bg-white p-8">
        {mode === "signup" && (
          <Input label="Full name" value={name} onChange={setName} />
        )}
        <Input label="Email" type="email" value={email} onChange={setEmail} />
        <Input label="Password" type="password" value={pw} onChange={setPw} />
        {err && (
          <div role="alert" className="border border-[color:var(--color-err)]/40 bg-[color:var(--color-err)]/5 px-3 py-2 text-[0.7rem] leading-[1.6] text-[color:var(--color-err)]">
            {err}
          </div>
        )}
        <button disabled={busy} className="btn-dark w-full">
          {busy ? "…" : mode === "signin" ? "Sign in" : "Create account"}
        </button>
        <button
          type="button"
          onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setErr(null); }}
          className="w-full text-[0.65rem] uppercase tracking-[0.2em] text-[color:var(--color-mocha)]"
        >
          {mode === "signin" ? "Need an account? Sign up" : "Have an account? Sign in"}
        </button>
        <Link to="/" className="block text-center text-[0.6rem] uppercase tracking-[0.2em] text-neutral-500">
          ← Back to store
        </Link>
      </form>
    </section>
  );
}

function Input({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <label className="mb-2 block text-[0.6rem] uppercase tracking-[0.2em] text-[color:var(--color-mocha)]">{label}</label>
      <input
        type={type}
        value={value}
        required
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-[color:var(--color-input)] bg-white/70 px-4 py-3 text-[0.78rem] outline-none focus:border-[color:var(--color-mocha)]"
      />
    </div>
  );
}
