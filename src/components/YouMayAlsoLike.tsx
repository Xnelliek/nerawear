import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/lib/api-client";
import { ProductCard } from "@/components/ProductCard";

export function YouMayAlsoLike({ productId, categoryId }: { productId: string; categoryId: string | null }) {
  const { data = [] } = useQuery({
    queryKey: ["related", categoryId, productId],
    enabled: !!categoryId,
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("id,slug,name,price_kes,tag,image_url,sold")
        .eq("category_id", categoryId as string)
        .neq("id", productId)
        .order("created_at", { ascending: false })
        .limit(8);
      return data ?? [];
    },
  });

  if (data.length === 0) return null;

  return (
    <section className="mt-20 border-t border-[color:var(--color-border)] pt-12">
      <div className="mb-8 flex items-end justify-between">
        <div>
          <span className="eyebrow mb-2 block">Curated for you</span>
          <h2 className="serif text-2xl font-light md:text-3xl">You may also <em className="italic text-[color:var(--color-mocha)]">like</em></h2>
        </div>
        <Link to="/shop" className="text-[0.6rem] uppercase tracking-[0.2em] text-[color:var(--color-mocha)]">View all →</Link>
      </div>
      <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
        {data.slice(0, 4).map((p, i) => <ProductCard key={p.id} p={p} index={i} />)}
      </div>
    </section>
  );
}
