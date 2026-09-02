import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Heart } from "lucide-react";
import { supabase } from "@/lib/api-client";
import { fmtKES, useCart } from "@/store/cart";
import { useWishlist } from "@/store/wishlist";
import { gradientFor } from "@/lib/gradients";
import { Reviews } from "@/components/Reviews";
import { YouMayAlsoLike } from "@/components/YouMayAlsoLike";
import { RecentlyViewed } from "@/components/RecentlyViewed";
import { addRecent } from "@/store/recentlyViewed";
import { useAuthReady } from "@/hooks/useAuthReady";
import { withTimeout } from "@/lib/supabase-timeout";
import { toast } from "sonner";

export const Route = createFileRoute("/product/$slug")({
  component: ProductPage,
});

function ProductPage() {
  const { slug } = Route.useParams();
  const add = useCart((s) => s.add);
  const [size, setSize] = useState<string | null>(null);
  const loadWish = useWishlist((s) => s.load);
  const toggleWish = useWishlist((s) => s.toggle);
  const wishIds = useWishlist((s) => s.ids);
  const { user, ready } = useAuthReady();

  useEffect(() => { if (ready && user) loadWish(user.id); }, [loadWish, ready, user]);

  const { data: p, isLoading, isError, refetch } = useQuery({
    queryKey: ["product", slug],
    queryFn: async () => {
      const { data, error } = await withTimeout(
        supabase
          .from("products")
          .select("*")
          .eq("slug", slug)
          .maybeSingle(),
        "Loading this product",
      );
      if (error) throw error;
      if (!data) throw notFound();
      return data;
    },
  });

  useEffect(() => { if (p?.id) addRecent(p.id); }, [p?.id]);

  const images = useMemo(() => {
    if (!p) return [];
    const gallery = (p.gallery as string[] | null) ?? [];
    const all = [p.image_url, ...gallery].filter(Boolean) as string[];
    return all.length ? all : [];
  }, [p]);
  const [active, setActive] = useState(0);

  if (isLoading) return <div className="px-12 py-24 text-center text-[0.7rem] uppercase tracking-[0.2em] text-neutral-500">Loading…</div>;
  if (isError) {
    return (
      <section className="mx-auto max-w-md px-6 py-24 text-center">
        <h1 className="serif mb-4 text-3xl font-light">This item didn’t load</h1>
        <p className="mb-6 text-[0.75rem] leading-[1.8] text-neutral-600">Please check your connection and try again.</p>
        <button onClick={() => refetch()} className="btn-dark">Retry</button>
      </section>
    );
  }
  if (!p) return null;

  const handleAdd = () => {
    if (!size) return toast.error("Please select a size.");
    add({ productId: p.id, name: p.name, size, price: p.price_kes, qty: 1, image: p.image_url });
    toast.success(`${p.name} added to your bag.`);
  };

  const handleWish = async () => {
    if (!ready) return toast.error("Please wait a moment while your session opens.");
    if (!user) return toast.error("Sign in to save items to your wishlist.");
    const added = await toggleWish(p.id, user.id);
    toast.success(added ? "Saved to wishlist." : "Removed from wishlist.");
  };

  const isWished = wishIds.has(p.id);

  return (
    <section className="mx-auto max-w-7xl px-6 py-12 md:px-12 md:py-16">
      <div className="grid grid-cols-1 gap-12 md:grid-cols-2">
        <div>
          <div className="aspect-[3/4] overflow-hidden bg-[color:var(--color-linen)]">
            {images[active] ? (
              <img src={images[active]} alt={p.name} className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full" style={{ background: gradientFor(p.id) }} />
            )}
          </div>
          {images.length > 1 && (
            <div className="mt-3 grid grid-cols-5 gap-2">
              {images.map((src, i) => (
                <button
                  key={i}
                  onClick={() => setActive(i)}
                  className={`aspect-square overflow-hidden border ${i === active ? "border-[color:var(--color-ink)]" : "border-transparent opacity-70 hover:opacity-100"}`}
                >
                  <img src={src} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col justify-center md:pl-8">
          <Link to="/shop" className="mb-8 text-[0.6rem] uppercase tracking-[0.2em] text-[color:var(--color-mocha)]">← Back to Shop</Link>
          {p.tag && (
            <span className="mb-4 inline-block w-fit bg-[color:var(--color-mahogany)] px-3 py-1 text-[0.55rem] uppercase tracking-[0.22em] text-[color:var(--color-mist)]">
              {p.tag}
            </span>
          )}
          <h1 className="serif mb-3 text-4xl font-light md:text-5xl">{p.name}</h1>
          <div className="mb-7 text-[0.85rem] tracking-wide text-[color:var(--color-mocha)]">{fmtKES(p.price_kes)}</div>
          <p className="mb-10 max-w-md text-[0.8rem] leading-[1.9] text-neutral-600">{p.description}</p>

          <div className="mb-3 text-[0.6rem] uppercase tracking-[0.25em] text-[color:var(--color-mocha)]">Select size</div>
          <div className="mb-8 flex flex-wrap gap-2">
            {p.sizes.map((s: string) => (
              <button
                key={s}
                onClick={() => setSize(s)}
                className={`h-11 min-w-12 border text-[0.7rem] uppercase tracking-wider transition-all ${size === s ? "border-[color:var(--color-ink)] bg-[color:var(--color-ink)] text-[color:var(--color-mist)]" : "border-[color:var(--color-border)] hover:border-[color:var(--color-mocha)]"}`}
              >
                {s}
              </button>
            ))}
          </div>

          <div className="flex max-w-sm gap-3">
            <button onClick={handleAdd} disabled={p.sold} className="btn-dark flex-1 disabled:opacity-40">
              {p.sold ? "Sold Out" : "Add to Bag"}
            </button>
            <button
              onClick={handleWish}
              aria-label="Save to wishlist"
              className={`flex h-12 w-12 items-center justify-center border ${isWished ? "border-[color:var(--color-mahogany)] bg-[color:var(--color-mahogany)] text-white" : "border-[color:var(--color-border)] hover:border-[color:var(--color-mocha)]"}`}
            >
              <Heart className={`h-4 w-4 ${isWished ? "fill-current" : ""}`} />
            </button>
          </div>

          <div className="mt-10 space-y-2 border-t border-[color:var(--color-border)] pt-6 text-[0.7rem] leading-[1.9] text-neutral-600">
            <div>· Free delivery in Nairobi over KSh 10,000</div>
            <div>· 7-day returns on unworn items</div>
            <div>· Pay via M-Pesa Pochi la Biashara</div>
          </div>
        </div>
      </div>

      <Reviews productId={p.id} />
      <YouMayAlsoLike productId={p.id} categoryId={p.category_id} />
      <RecentlyViewed excludeId={p.id} />
    </section>
  );
}
