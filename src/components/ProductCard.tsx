import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { fmtKES } from "@/store/cart";
import { gradientFor } from "@/lib/gradients";

export type ProductCardData = {
  id: string;
  slug: string;
  name: string;
  price_kes: number;
  tag: string | null;
  image_url: string | null;
  sold: boolean;
};

export function ProductCard({ p, index = 0 }: { p: ProductCardData; index?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5, delay: (index % 4) * 0.06 }}
      className="group relative"
    >
      <Link to="/product/$slug" params={{ slug: p.slug }} preload="intent" className="block">
        <div className="relative mb-4 aspect-[3/4] overflow-hidden bg-[color:var(--color-linen)]">
          {p.image_url ? (
            <img
              src={p.image_url}
              alt={p.name}
              width={720}
              height={960}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
            />
          ) : (
            <div
              className="h-full w-full transition-transform duration-700 group-hover:scale-105"
              style={{ background: gradientFor(p.id) }}
            />
          )}
          {p.tag && (
            <span className="absolute left-4 top-4 bg-[color:var(--color-mahogany)] px-3 py-1 text-[0.52rem] uppercase tracking-[0.22em] text-[color:var(--color-mist)]">
              {p.tag}
            </span>
          )}
          {p.sold && (
            <div className="absolute inset-0 flex items-center justify-center bg-[rgba(246,242,237,0.85)]">
              <span className="text-[0.65rem] uppercase tracking-[0.3em] text-[color:var(--color-mocha)]">
                Sold Out
              </span>
            </div>
          )}
        </div>
        <h3 className="serif mb-1 text-[1.05rem]">{p.name}</h3>
        <div className="text-[0.72rem] tracking-wide text-[color:var(--color-mocha)]">
          {fmtKES(p.price_kes)}
        </div>
      </Link>
    </motion.div>
  );
}
