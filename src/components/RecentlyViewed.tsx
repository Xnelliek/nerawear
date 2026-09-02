import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/api-client";
import { ProductCard } from "@/components/ProductCard";
import { getRecent } from "@/store/recentlyViewed";

export function RecentlyViewed({ excludeId }: { excludeId?: string }) {
  const [ids, setIds] = useState<string[]>([]);
  useEffect(() => { setIds(getRecent().filter((id) => id !== excludeId)); }, [excludeId]);

  const { data = [] } = useQuery({
    queryKey: ["recently-viewed", ids.join(",")],
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("id,slug,name,price_kes,tag,image_url,sold")
        .in("id", ids);
      const order = new Map(ids.map((id, i) => [id, i]));
      return (data ?? []).sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
    },
  });

  if (data.length === 0) return null;

  return (
    <section className="mt-16 border-t border-[color:var(--color-border)] pt-12">
      <div className="mb-8">
        <span className="eyebrow mb-2 block">Your trail</span>
        <h2 className="serif text-2xl font-light md:text-3xl">Recently <em className="italic text-[color:var(--color-mocha)]">viewed</em></h2>
      </div>
      <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
        {data.slice(0, 4).map((p, i) => <ProductCard key={p.id} p={p} index={i} />)}
      </div>
    </section>
  );
}
