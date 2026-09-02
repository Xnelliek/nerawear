import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/lib/api-client";
import { ProductCard } from "@/components/ProductCard";
import { withTimeout } from "@/lib/supabase-timeout";

const searchSchema = z.object({
  cat: z.string().optional(),
  q: z.string().optional(),
});

export const Route = createFileRoute("/shop")({
  component: Shop,
  validateSearch: searchSchema,
  head: () => ({ meta: [{ title: "Shop · Néra Wear" }] }),
});

function Shop() {
  const { cat, q } = useSearch({ from: "/shop" });
  const navigate = useNavigate({ from: "/shop" });

  const { data: categories = [], isLoading: catsLoading } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await withTimeout(
        supabase.from("categories").select("id,name,slug").order("sort_order"),
        "Loading categories",
      );
      if (error) throw error;
      return data ?? [];
    },
  });

  const activeCategoryId = cat ? categories.find((c) => c.slug === cat)?.id : null;

  const { data: products = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["products", activeCategoryId ?? cat ?? "all", q ?? ""],
    enabled: !cat || !catsLoading,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      let query = supabase
        .from("products")
        .select("id,slug,name,price_kes,tag,image_url,sold")
        .order("created_at", { ascending: false });
      if (cat) {
        if (!activeCategoryId) return [];
        query = query.eq("category_id", activeCategoryId);
      }
      if (q) query = query.ilike("name", `%${q}%`);
      const { data, error } = await withTimeout(query, "Loading products");
      if (error) throw error;
      return data ?? [];
    },
  });

  const active = cat ?? "all";

  return (
    <section className="px-6 pb-24 pt-12 md:px-12">
      <div className="mb-12 text-center">
        <span className="eyebrow mb-4 block">The Collection</span>
        <h1 className="serif text-[clamp(2rem,4vw,3.2rem)] font-light tracking-wide">
          Shop <em className="italic text-[color:var(--color-mocha)]">all</em>
        </h1>
      </div>

      <div className="mb-10 flex flex-wrap justify-center gap-3">
        <button
          onClick={() => navigate({ search: {} })}
          className={`border px-5 py-2 text-[0.6rem] uppercase tracking-[0.2em] transition-all ${active === "all" ? "border-[color:var(--color-ink)] bg-[color:var(--color-ink)] text-[color:var(--color-mist)]" : "border-[color:var(--color-border)]"}`}
        >
          All
        </button>
        {categories.map((c) => (
          <button
            key={c.id}
            onClick={() => navigate({ search: { cat: c.slug } })}
            className={`border px-5 py-2 text-[0.6rem] uppercase tracking-[0.2em] transition-all ${active === c.slug ? "border-[color:var(--color-ink)] bg-[color:var(--color-ink)] text-[color:var(--color-mist)]" : "border-[color:var(--color-border)]"}`}
          >
            {c.name}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="text-center text-[0.7rem] uppercase tracking-[0.2em] text-neutral-500">Loading…</p>
      ) : isError ? (
        <div className="mx-auto max-w-md text-center">
          <p className="mb-5 text-[0.75rem] leading-[1.8] text-neutral-600">The collection took too long to load. Please try again.</p>
          <button onClick={() => refetch()} className="btn-dark">Retry</button>
        </div>
      ) : products.length === 0 ? (
        <p className="text-center text-[0.7rem] uppercase tracking-[0.2em] text-neutral-500">No items in this edit yet</p>
      ) : (
        <div className="grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-4">
          {products.map((p, i) => <ProductCard key={p.id} p={p} index={i} />)}
        </div>
      )}
    </section>
  );
}
