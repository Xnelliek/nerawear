import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/api-client";
import { ProductCard } from "@/components/ProductCard";
import { withTimeout } from "@/lib/supabase-timeout";
import heroImg from "@/assets/hero.jpg";
import catDresses from "@/assets/cat-dresses.jpg";
import catTops from "@/assets/cat-tops.jpg";
import catBottoms from "@/assets/cat-bottoms.jpg";
import slideOffice from "@/assets/slide-office.jpg";
import slideChurch from "@/assets/slide-church.jpg";
import slideCasual from "@/assets/slide-casual.jpg";
import slideWarmwear from "@/assets/slide-warmwear.jpg";

export const Route = createFileRoute("/")({
  component: Home,
  head: () => ({
    meta: [
      { title: "Néra Wear — Modern Fits. Confident You." },
      { name: "description", content: "Luxury essentials designed in Nairobi. Shop dresses, tops, bottoms and sets for the modern African woman." },
    ],
  }),
});

const categoryArt: Record<string, string> = {
  dresses: catDresses,
  tops: catTops,
  bottoms: catBottoms,
  "warm-wear": slideWarmwear,
};

const storySlides = [
  { title: "Office polish", label: "Tailored workwear", image: slideOffice },
  { title: "Sunday grace", label: "Church-ready dresses", image: slideChurch },
  { title: "Everyday ease", label: "Casual refined fits", image: slideCasual },
  { title: "Warm layers", label: "Trench coats · leather · fur", image: slideWarmwear },
];

function Home() {
  const [activeStory, setActiveStory] = useState(0);

  useEffect(() => {
    let last = 0;
    const advance = () => {
      const now = Date.now();
      if (now - last < 700) return;
      last = now;
      setActiveStory((i) => (i + 1) % storySlides.length);
    };
    window.addEventListener("mousemove", advance, { passive: true });
    window.addEventListener("touchmove", advance, { passive: true });
    window.addEventListener("scroll", advance, { passive: true });
    return () => {
      window.removeEventListener("mousemove", advance);
      window.removeEventListener("touchmove", advance);
      window.removeEventListener("scroll", advance);
    };
  }, []);

  const { data: featured = [], isLoading: featLoading } = useQuery({
    queryKey: ["featured"],
    staleTime: 60_000,
    queryFn: async () => {
      // Prefer admin-curated featured items; fall back to latest if none flagged.
      const { data: flagged, error } = await withTimeout(
        supabase
          .from("products")
          .select("id,slug,name,price_kes,tag,image_url,sold,featured,created_at")
          .order("featured", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(8),
        "Loading new arrivals",
      );
      if (error) throw error;
      return flagged ?? [];
    },
  });

  const { data: categories = [], isLoading: catLoading } = useQuery({
    queryKey: ["categories"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await withTimeout(
        supabase
          .from("categories")
          .select("id,name,slug,description")
          .order("sort_order"),
        "Loading categories",
      );
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <>
      {/* HERO */}
      <section className="grid min-h-[88vh] grid-cols-1 md:grid-cols-2">
        <div className="flex flex-col justify-center px-8 py-20 md:px-16">
          <div className="eyebrow mb-9 flex items-center gap-4">
            <span className="block h-px w-8 bg-[color:var(--color-mocha)]" />
            New Season · Autumn 2026
          </div>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="serif mb-6 text-[clamp(3rem,5.5vw,5rem)] font-light leading-[1.06]"
          >
            Modern fits.<br />
            <em className="italic text-[color:var(--color-mocha)]">Confident</em> you.
          </motion.h1>
          <p className="mb-10 max-w-md text-[0.75rem] leading-[2] tracking-wide text-neutral-600">
            Considered silhouettes in luxurious natural fabrics. Each piece is designed in Nairobi and made to live in your wardrobe for years.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Link to="/shop" className="btn-dark">Shop The Collection</Link>
            <Link to="/shop" search={{ cat: "sets" } as never} className="btn-outline">Explore Sets</Link>
          </div>
        </div>
        <div className="relative overflow-hidden bg-[color:var(--color-linen)]">
          <img
            src={heroImg}
            alt="Néra Wear autumn collection"
            width={1024}
            height={1280}
            className="absolute inset-0 h-full w-full object-cover"
          />
          <span className="absolute bottom-10 left-10 bg-[color:var(--color-ink)] px-5 py-2.5 text-[0.58rem] uppercase tracking-[0.25em] text-[color:var(--color-mist)]">
            Shot in Nairobi
          </span>
        </div>
      </section>

      {/* MARQUEE */}
      <div className="overflow-hidden bg-[color:var(--color-mahogany)] py-3.5">
        <div className="animate-marquee flex whitespace-nowrap text-[color:var(--color-linen)]">
          {Array.from({ length: 2 }).map((_, k) => (
            <div key={k} className="flex shrink-0">
              {["Free Delivery in Nairobi over KSh 10,000", "·", "M-Pesa Express Checkout", "·", "7-Day Returns", "·", "Made in Kenya", "·"].map((s, i) => (
                <span key={i} className="serif px-10 text-base italic">{s}</span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* INTERACTIVE PRODUCT STORY */}
      <section className="relative min-h-[72vh] overflow-hidden bg-[color:var(--color-ink)]">
        {storySlides.map((slide, i) => (
          <img
            key={slide.title}
            src={slide.image}
            alt={`${slide.title} by Néra Wear`}
            width={1024}
            height={1280}
            loading={i === 0 ? "eager" : "lazy"}
            decoding="async"
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${i === activeStory ? "opacity-100" : "opacity-0"}`}
          />
        ))}
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(17,17,17,0.68),rgba(17,17,17,0.12))]" />
        <div className="relative z-10 flex min-h-[72vh] flex-col justify-end px-8 pb-14 md:px-16 md:pb-20">
          <span className="mb-5 block text-[0.6rem] uppercase tracking-[0.32em] text-[color:var(--color-linen)]/80">
            Move · scroll · discover
          </span>
          <h2 className="serif max-w-2xl text-[clamp(2.4rem,5vw,4.5rem)] font-light leading-[1.05] text-[color:var(--color-mist)]">
            {storySlides[activeStory].title}
          </h2>
          <p className="mt-4 max-w-md text-[0.78rem] uppercase tracking-[0.22em] text-[color:var(--color-linen)]">
            {storySlides[activeStory].label}
          </p>
          <div className="mt-8 flex gap-2">
            {storySlides.map((slide, i) => (
              <button
                key={slide.title}
                onClick={() => setActiveStory(i)}
                aria-label={`Show ${slide.title}`}
                className={`h-1.5 transition-all ${i === activeStory ? "w-12 bg-[color:var(--color-linen)]" : "w-5 bg-[color:var(--color-linen)]/45"}`}
              />
            ))}
          </div>
        </div>
      </section>

      {/* WARM WEAR */}
      <section className="grid grid-cols-1 bg-[color:var(--color-mist)] md:grid-cols-2">
        <div className="order-2 flex flex-col justify-center px-8 py-16 md:order-1 md:px-16">
          <span className="eyebrow mb-5 block">Warm Wear</span>
          <h2 className="serif mb-5 text-[clamp(2.1rem,4vw,3.6rem)] font-light leading-tight">
            Trench coats, leather jackets & <em className="italic text-[color:var(--color-mocha)]">fur layers</em>.
          </h2>
          <p className="mb-8 max-w-md text-[0.78rem] leading-[2] text-neutral-600">
            Elegant outerwear for chilly mornings, travel days, church, office and polished weekend plans.
          </p>
          <Link to="/shop" search={{ cat: "warm-wear" } as never} className="btn-dark w-fit">Shop Warm Wear</Link>
        </div>
        <div className="order-1 aspect-[4/5] overflow-hidden md:order-2 md:aspect-auto">
          <img src={slideWarmwear} alt="Néra Wear warm wear trench coat and jacket edit" width={1024} height={1280} loading="lazy" decoding="async" className="h-full w-full object-cover" />
        </div>
      </section>

      {/* CATEGORIES */}
      <section className="px-6 py-20 md:px-12">
        <div className="mb-14 text-center">
          <span className="eyebrow mb-4 block">Curated Edits</span>
          <h2 className="serif text-[clamp(2rem,4vw,3rem)] font-light tracking-wide">
            Shop by <em className="italic text-[color:var(--color-mocha)]">category</em>
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {catLoading && categories.length === 0
            ? Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="aspect-[3/4] animate-pulse bg-[color:var(--color-linen)]" />
              ))
            : categories.slice(0, 3).map((c) => (
                <Link
                  key={c.id}
                  to="/shop"
                  search={{ cat: c.slug } as never}
                  className="group relative aspect-[3/4] overflow-hidden"
                >
                  {categoryArt[c.slug] ? (
                    <img
                      src={categoryArt[c.slug]}
                      alt={c.name}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                    />
                  ) : (
                    <div className="h-full w-full bg-[color:var(--color-linen)]" />
                  )}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent p-6 pt-12">
                    <div className="serif mb-1 text-xl text-white">{c.name}</div>
                    <div className="text-[0.58rem] uppercase tracking-[0.22em] text-white/65">{c.description}</div>
                  </div>
                </Link>
              ))}
        </div>
      </section>

      {/* FEATURED PRODUCTS */}
      <section className="bg-[color:var(--color-mist)] px-6 py-20 md:px-12">
        <div className="mb-14 text-center">
          <span className="eyebrow mb-4 block">The Edit</span>
          <h2 className="serif text-[clamp(2rem,4vw,3rem)] font-light tracking-wide">
            Just <em className="italic text-[color:var(--color-mocha)]">arrived</em>
          </h2>
        </div>
        <div className="grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-4">
          {featLoading && featured.length === 0
            ? Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="aspect-[3/4] animate-pulse bg-[color:var(--color-linen)]" />
              ))
            : featured.map((p, i) => <ProductCard key={p.id} p={p} index={i} />)}
        </div>
        <div className="mt-12 text-center">
          <Link to="/shop" className="btn-outline inline-block">View All</Link>
        </div>
      </section>

      {/* BANNER */}
      <section className="grid grid-cols-1 bg-[color:var(--color-mahogany)] md:min-h-[50vh] md:grid-cols-2">
        <div className="flex flex-col justify-center px-10 py-16 md:px-16">
          <span className="mb-5 block text-[0.6rem] uppercase tracking-[0.32em] text-[color:var(--color-linen)] opacity-70">
            Coming this season
          </span>
          <h3 className="serif mb-5 text-[clamp(2rem,3.5vw,3rem)] font-light leading-tight text-white">
            The art of <em className="italic text-[color:var(--color-blush)]">quiet luxury.</em>
          </h3>
          <p className="mb-8 max-w-md text-[0.75rem] leading-[2] text-white/65">
            A capsule built around fabric and fit. Nothing loud. Everything considered.
          </p>
          <Link to="/shop" className="inline-block w-fit bg-[color:var(--color-linen)] px-9 py-3.5 text-[0.62rem] uppercase tracking-[0.22em] text-[color:var(--color-mahogany)] transition-colors hover:bg-white">
            Pre-order
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3 p-8">
          <div className="aspect-[1/1.4] bg-[color:var(--color-blush)]" />
          <div className="mt-8 aspect-square bg-[#c4a88e]" />
          <div className="aspect-square bg-[color:var(--color-linen)]" />
          <div className="aspect-[1/1.3] bg-[#d8cec8]" />
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="px-6 py-20 md:px-12">
        <div className="mb-14 text-center">
          <span className="eyebrow mb-4 block">From The Muses</span>
          <h2 className="serif text-[clamp(2rem,4vw,3rem)] font-light tracking-wide">
            Worn by <em className="italic text-[color:var(--color-mocha)]">her</em>
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {[
            { stars: "★★★★★", q: "The fabric, the fit, the finishing — every piece I've ordered feels like it was made for me. Néra Wear is my new wardrobe staple.", a: "Wanjiku · Nairobi" },
            { stars: "★★★★★", q: "Beautifully made, arrived next day in the most stunning packaging. The linen wrap blouse is now in my permanent rotation.", a: "Amina · Mombasa" },
            { stars: "★★★★★", q: "Finally, luxury essentials designed for us. The cut on the wide trousers is impeccable. I've ordered four colours.", a: "Zawadi · Kisumu" },
          ].map((t, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              className="border border-[color:var(--color-border)] bg-white p-10"
            >
              <div className="mb-5 text-base tracking-widest text-[color:var(--color-gold)]">{t.stars}</div>
              <p className="serif mb-6 text-[0.95rem] italic leading-[1.9] text-neutral-700">"{t.q}"</p>
              <div className="text-[0.6rem] uppercase tracking-[0.22em] text-[color:var(--color-mocha)]">{t.a}</div>
            </motion.div>
          ))}
        </div>
      </section>
    </>
  );
}
