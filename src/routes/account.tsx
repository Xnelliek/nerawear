import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/api-client";
import { fmtKES } from "@/store/cart";
import { toast } from "sonner";
import { useAuthReady } from "@/hooks/useAuthReady";
import { withTimeout } from "@/lib/supabase-timeout";

export const Route = createFileRoute("/account")({
  component: Account,
  head: () => ({ meta: [{ title: "Your account · Néra Wear" }] }),
});

function Account() {
  const navigate = useNavigate();
  const { user, ready } = useAuthReady();

  const { data: orders = [], isError, refetch } = useQuery({
    enabled: !!user,
    queryKey: ["my-orders", user?.id],
    queryFn: async () => {
      const { data, error } = await withTimeout(
        supabase
          .from("orders")
          .select("id,order_number,total_kes,status,created_at,order_items(product_name,size,quantity)")
          .order("created_at", { ascending: false }),
        "Loading your orders",
      );
      if (error) throw error;
      return data ?? [];
    },
  });

  if (!ready) return <div className="px-12 py-24 text-center text-[0.7rem] uppercase tracking-[0.2em] text-neutral-500">Opening account…</div>;
  if (!user) {
    return (
      <section className="mx-auto max-w-md px-6 py-24 text-center">
        <h1 className="serif mb-4 text-3xl font-light">Your account</h1>
        <p className="mb-6 text-[0.75rem] tracking-wide text-neutral-600">Sign in to view your orders and addresses.</p>
        <Link to="/auth" className="btn-dark inline-block">Sign in</Link>
      </section>
    );
  }

  async function logout() {
    await supabase.auth.signOut();
    toast.success("Signed out.");
    navigate({ to: "/" });
  }

  return (
    <section className="mx-auto max-w-4xl px-6 py-16 md:px-12">
      <div className="mb-10 flex items-end justify-between border-b border-[color:var(--color-border)] pb-6">
        <div>
          <span className="eyebrow mb-2 block">Your account</span>
          <h1 className="serif text-3xl font-light">{user.email}</h1>
        </div>
        <button onClick={logout} className="text-[0.6rem] uppercase tracking-[0.2em] text-[color:var(--color-mocha)] underline-offset-4 hover:underline">
          Sign out
        </button>
      </div>

      <h2 className="serif mb-6 text-2xl font-light">Order history</h2>
      {isError ? (
        <div className="border border-[color:var(--color-border)] bg-white p-8 text-center">
          <p className="mb-5 text-[0.75rem] leading-[1.8] text-neutral-600">Your orders didn’t load. Please try again.</p>
          <button onClick={() => refetch()} className="btn-dark">Retry</button>
        </div>
      ) : orders.length === 0 ? (
        <p className="text-[0.75rem] tracking-wide text-neutral-500">No orders yet.</p>
      ) : (
        <ul className="space-y-4">
          {orders.map((o) => (
            <li key={o.id} className="border border-[color:var(--color-border)] bg-white p-6">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <span className="serif text-lg">{o.order_number}</span>
                <span className="bg-[color:var(--color-linen)] px-3 py-1 text-[0.55rem] uppercase tracking-[0.22em] text-[color:var(--color-mahogany)]">
                  {o.status}
                </span>
              </div>
              <div className="mb-2 text-[0.7rem] tracking-wide text-neutral-600">
                {o.order_items?.map((i: any) => `${i.product_name} (${i.size}) ×${i.quantity}`).join(" · ")}
              </div>
              <div className="flex justify-between text-[0.75rem]">
                <span className="text-neutral-500">{new Date(o.created_at).toLocaleDateString()}</span>
                <strong className="serif text-base">{fmtKES(o.total_kes)}</strong>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
