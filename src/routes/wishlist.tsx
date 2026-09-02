import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/lib/api-client";
import { useWishlist } from "@/store/wishlist";
import { ProductCard } from "@/components/ProductCard";

export const Route = createFileRoute("/wishlist")({
  component: WishlistPage,
  head: () => ({ meta: [{ title: "Wishlist · Néra Wear" }] }),
});

function WishlistPage() {
  const load = useWishlist((s) => s.load);
  const ids = useWishlist((s) => s.ids);
  useEffect(() => { load(); }, [load]);

  const { data: products = [] } = useQuery({
    queryKey: ["wishlist-products", Array.from(ids).sort().join(",")],
    queryFn: async () => {
      if (ids.size === 0) return [];
      const { data } = await supabase.from("products").select("*").in("id", Array.from(ids));
      return data ?? [];
    },
  });

  return (
    <section className="mx-auto max-w-7xl px-6 py-12 md:px-12 md:py-16">
      <h1 className="serif mb-2 text-4xl font-light">Your Wishlist</h1>
      <p className="mb-10 text-[0.75rem] uppercase tracking-[0.2em] text-[color:var(--color-mocha)]">
        {products.length} {products.length === 1 ? "piece" : "pieces"} saved
      </p>
      {products.length === 0 ? (
        <div className="border border-[color:var(--color-border)] bg-white p-12 text-center">
          <p className="mb-6 text-[0.8rem] text-neutral-600">Nothing saved yet. Sign in and tap the heart on pieces you love.</p>
          <Link to="/shop" className="btn-dark inline-block">Browse the collection</Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-4">
          {products.map((p) => <ProductCard key={p.id} p={p} />)}
        </div>
      )}
    </section>
  );
}
