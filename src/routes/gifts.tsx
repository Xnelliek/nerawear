import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Gift } from "lucide-react";
import { supabase } from "@/lib/api-client";
import { fmtKES } from "@/store/cart";
import { gradientFor } from "@/lib/gradients";

export const Route = createFileRoute("/gifts")({
  component: GiftsPage,
  head: () => ({
    meta: [
      { title: "Gifts · Néra Wear — Curated bundles for the people you love" },
      { name: "description", content: "Affordable curated gift packages for birthdays, anniversaries, Valentine's, Mother's Day and more. Beautifully wrapped, ready to give." },
    ],
  }),
});

const OCCASIONS: { value: string; label: string }[] = [
  { value: "all", label: "All gifts" },
  { value: "birthday", label: "Birthday" },
  { value: "valentines", label: "Valentine's" },
  { value: "anniversary", label: "Anniversary" },
  { value: "womens_day", label: "Women's Day" },
  { value: "mothers_day", label: "Mother's Day" },
  { value: "graduation", label: "Graduation" },
  { value: "baby_shower", label: "Baby Shower" },
  { value: "just_because", label: "Just because" },
];

function GiftsPage() {
  const { data: packages = [], isLoading } = useQuery({
    queryKey: ["gift-packages"],
    queryFn: async () => {
      const { data } = await supabase
        .from("gift_packages")
        .select("id,name,slug,description,occasion,price_kes,item_count,image_url,gallery,contents,featured")
        .eq("active", true)
        .order("featured", { ascending: false })
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  return (
    <section className="px-6 pb-24 pt-12 md:px-12">
      {/* HERO */}
      <div className="mx-auto mb-14 max-w-3xl text-center">
        <div className="mb-4 inline-flex items-center gap-2 text-[color:var(--color-mocha)]">
          <Gift className="h-4 w-4" />
          <span className="eyebrow">Gift the feeling</span>
        </div>
        <h1 className="serif text-[clamp(2.4rem,5vw,3.8rem)] font-light leading-[1.1]">
          Beautifully curated <em className="italic text-[color:var(--color-mahogany)]">gift bundles</em>
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-[0.8rem] leading-[2] text-neutral-600">
          For her birthday, your anniversary, Valentine's, Mother's Day or simply because. Hand-picked pieces, wrapped with care, delivered with love.
        </p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="aspect-[3/4] animate-pulse bg-[color:var(--color-linen)]" />
          ))}
        </div>
      ) : packages.length === 0 ? (
        <div className="mx-auto max-w-md border border-dashed border-[color:var(--color-border)] bg-white p-12 text-center">
          <Gift className="mx-auto mb-4 h-8 w-8 text-[color:var(--color-mocha)]" />
          <h2 className="serif mb-2 text-xl">Gift bundles coming soon</h2>
          <p className="text-[0.75rem] leading-[1.8] text-neutral-600">We're putting the finishing touches on our gift collection. Check back very soon — or browse the main shop in the meantime.</p>
          <Link to="/shop" className="btn-dark mt-6 inline-block">Visit shop</Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
          {packages.map((g, i) => (
            <motion.article
              key={g.id}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: (i % 3) * 0.08 }}
              className="group border border-[color:var(--color-border)] bg-white"
            >
              <div className="relative aspect-[3/4] overflow-hidden bg-[color:var(--color-linen)]">
                {g.image_url ? (
                  <img src={g.image_url} alt={g.name} loading="lazy" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
                ) : (
                  <div className="h-full w-full" style={{ background: gradientFor(g.id) }} />
                )}
                <span className="absolute left-4 top-4 bg-[color:var(--color-mahogany)] px-3 py-1 text-[0.55rem] uppercase tracking-[0.22em] text-[color:var(--color-mist)]">
                  {(OCCASIONS.find((o) => o.value === g.occasion)?.label) ?? "Gift"}
                </span>
                {g.item_count > 1 && (
                  <span className="absolute right-4 top-4 bg-white/95 px-3 py-1 text-[0.55rem] uppercase tracking-[0.22em] text-[color:var(--color-ink)]">
                    {g.item_count} pieces
                  </span>
                )}
              </div>
              <div className="p-6">
                <h2 className="serif mb-1 text-xl">{g.name}</h2>
                <div className="mb-3 text-[0.75rem] text-[color:var(--color-mocha)]">{fmtKES(g.price_kes)}</div>
                {g.description && (
                  <p className="mb-4 line-clamp-3 text-[0.75rem] leading-[1.8] text-neutral-600">{g.description}</p>
                )}
                {g.contents && g.contents.length > 0 && (
                  <ul className="mb-4 space-y-1 text-[0.7rem] text-neutral-600">
                    {g.contents.slice(0, 4).map((c: string, idx: number) => (
                      <li key={idx}>· {c}</li>
                    ))}
                  </ul>
                )}
                <a
                  href={`https://wa.me/254700000000?text=${encodeURIComponent(`Hi Néra Wear, I'd like to order the "${g.name}" gift package.`)}`}
                  target="_blank"
                  rel="noopener"
                  className="btn-dark block w-full text-center"
                >
                  Order this gift
                </a>
              </div>
            </motion.article>
          ))}
        </div>
      )}
    </section>
  );
}
