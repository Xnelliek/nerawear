import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/lib/api-client";

type OAuthDetails = {
  client?: { name?: string | null } | null;
  redirect_url?: string | null;
  redirect_to?: string | null;
};

type OAuthApi = {
  getAuthorizationDetails: (id: string) => Promise<{ data: OAuthDetails | null; error: Error | null }>;
  approveAuthorization: (id: string) => Promise<{ data: OAuthDetails | null; error: Error | null }>;
  denyAuthorization: (id: string) => Promise<{ data: OAuthDetails | null; error: Error | null }>;
};

function oauthApi(): OAuthApi {
  return (supabase.auth as unknown as { oauth: OAuthApi }).oauth;
}

export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s.authorization_id === "string" ? s.authorization_id : "",
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("Missing authorization_id");
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      const next = location.pathname + location.searchStr;
      throw redirect({ to: "/auth", search: { mode: "signin", redirect: next } as never });
    }
  },
  loader: async ({ location }) => {
    const authorizationId = new URLSearchParams(location.search).get("authorization_id")!;
    const { data, error } = await oauthApi().getAuthorizationDetails(authorizationId);
    if (error) throw error;
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) throw redirect({ href: immediate });
    return data;
  },
  component: Consent,
  errorComponent: ({ error }) => (
    <main className="mx-auto max-w-md px-6 py-20 text-center text-[0.8rem]">
      Could not load this authorization request: {String((error as Error)?.message ?? error)}
    </main>
  ),
});

function Consent() {
  const details = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const clientName = details?.client?.name ?? "this app";

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    const api = oauthApi();
    const { data, error: err } = approve
      ? await api.approveAuthorization(authorization_id)
      : await api.denyAuthorization(authorization_id);
    if (err) {
      setBusy(false);
      setError(err.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("No redirect was returned. Please try again.");
      return;
    }
    window.location.href = target;
  }

  return (
    <main className="mx-auto max-w-md px-6 py-20">
      <div className="border border-[color:var(--color-border)] bg-white p-8 text-center">
        <div className="serif mb-2 text-2xl font-light tracking-[0.2em]">NÉRA WEAR</div>
        <p className="mb-6 text-[0.6rem] uppercase tracking-[0.3em] text-[color:var(--color-mocha)]">
          Connect an assistant
        </p>
        <h1 className="serif mb-3 text-2xl font-light">Allow {clientName} to use your account?</h1>
        <p className="mb-6 text-[0.78rem] leading-[1.9] text-neutral-600">
          {clientName} will be able to browse the shop and read your own orders and wishlist as you. You
          can revoke this at any time.
        </p>
        {error && (
          <div role="alert" className="mb-4 border border-[color:var(--color-err)]/40 bg-[color:var(--color-err)]/5 px-3 py-2 text-[0.7rem] text-[color:var(--color-err)]">
            {error}
          </div>
        )}
        <button disabled={busy} onClick={() => decide(true)} className="btn-dark w-full disabled:opacity-50">
          {busy ? "…" : "Approve"}
        </button>
        <button
          disabled={busy}
          onClick={() => decide(false)}
          className="mt-3 w-full border border-[color:var(--color-ink)] px-4 py-3 text-[0.65rem] uppercase tracking-[0.2em] disabled:opacity-50"
        >
          Deny
        </button>
      </div>
    </main>
  );
}
