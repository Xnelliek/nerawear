import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/lib/api-client";
import { toast } from "sonner";
import { z } from "zod";

const emailSchema = z.string().trim().email().max(255);

export function Footer() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  async function subscribe(e: React.FormEvent) {
    e.preventDefault();
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) {
      toast.error("Please enter a valid email.");
      return;
    }
    setBusy(true);
    const { error } = await supabase
      .from("newsletter_subscribers")
      .insert({ email: parsed.data });
    setBusy(false);
    if (error) {
      if (error.code === "23505") toast.success("You're already subscribed.");
      else toast.error("Could not subscribe. Try again.");
      return;
    }
    setEmail("");
    toast.success("Welcome to Néra Wear.");
  }

  return (
    <footer className="bg-[color:var(--color-ink)] px-6 pb-8 pt-16 text-white/55 md:px-12">
      {/* Newsletter band */}
      <section className="mx-auto mb-16 max-w-2xl text-center">
        <span className="eyebrow !text-[color:var(--color-mocha)]">Join the List</span>
        <h2 className="serif my-4 text-3xl font-light text-white md:text-4xl">
          The Néra <em className="italic text-[color:var(--color-blush)]">muse</em>
        </h2>
        <p className="mx-auto mb-8 max-w-md text-[0.72rem] leading-loose text-white/55">
          Early access to drops, styling letters, and a 10% welcome offer.
        </p>
        <form onSubmit={subscribe} className="mx-auto flex max-w-md">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            className="flex-1 border border-white/20 bg-white/5 px-4 py-3 text-[0.75rem] tracking-wide text-white outline-none placeholder:text-white/35 focus:border-[color:var(--color-mocha)]"
          />
          <button
            disabled={busy}
            className="bg-[color:var(--color-mocha)] px-6 py-3 text-[0.62rem] uppercase tracking-[0.2em] text-white transition-colors hover:bg-[color:var(--color-linen)] hover:text-[color:var(--color-ink)] disabled:opacity-50"
          >
            {busy ? "…" : "Subscribe"}
          </button>
        </form>
      </section>

      <div className="grid gap-12 border-t border-white/10 pt-12 md:grid-cols-[2fr_1fr_1fr_1fr]">
        <div>
          <div className="serif mb-2 text-lg tracking-[0.35em] text-white">NÉRA WEAR</div>
          <div className="mb-3 text-[0.6rem] uppercase tracking-[0.25em] text-[color:var(--color-mocha)]">
            Modern fits. Confident you.
          </div>
          <p className="max-w-xs text-[0.7rem] leading-loose">
            Luxury essentials designed in Nairobi for the modern African woman. Considered cuts, beautiful fabrics, made to last.
          </p>
        </div>
        {([
          { title: "Shop", links: [["New In", "/shop", false], ["Dresses", "/shop?cat=dresses", false], ["Tops", "/shop?cat=tops", false], ["Bottoms", "/shop?cat=bottoms", false], ["Sets", "/shop?cat=sets", false]] },
          { title: "Help", links: [["Size Guide", "#", false], ["7-Day Returns", "#", false], ["Track Order", "/account", false], ["WhatsApp Us", "https://wa.me/254734416944", true], ["Call 0734 416 944", "tel:+254734416944", true]] },
          { title: "Connect", links: [["Instagram", "https://www.instagram.com/nera.wearr/", true], ["TikTok", "https://www.tiktok.com/@nera.wear", true], ["WhatsApp Group", "https://chat.whatsapp.com/Cc3kKS0PEuWEceGUqsPR5X", true], ["Email", "mailto:hello@nerawear.co", true]] },
        ] as { title: string; links: [string, string, boolean][] }[]).map((c) => (
          <div key={c.title}>
            <h4 className="mb-5 text-[0.6rem] font-normal uppercase tracking-[0.3em] text-white">{c.title}</h4>
            <ul className="space-y-3">
              {c.links.map(([label, href, external]) =>
                external ? (
                  <li key={label}>
                    <a href={href as string} target="_blank" rel="noreferrer" className="text-[0.7rem] transition-colors hover:text-white">{label}</a>
                  </li>
                ) : (
                  <li key={label}>
                    <Link to={href as string} className="text-[0.7rem] transition-colors hover:text-white">{label}</Link>
                  </li>
                )
              )}
            </ul>
          </div>
        ))}
      </div>

      <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-6 md:flex-row">
        <span className="text-[0.62rem] tracking-wider">© 2026 Néra Wear · Nairobi, Kenya · 0734 416 944</span>
        <div className="flex gap-5 text-[0.62rem] tracking-wider text-white/45">
          <a href="https://www.instagram.com/nera.wearr/" target="_blank" rel="noreferrer" className="hover:text-[color:var(--color-mocha)]">Instagram</a>
          <a href="https://www.tiktok.com/@nera.wear" target="_blank" rel="noreferrer" className="hover:text-[color:var(--color-mocha)]">TikTok</a>
          <a href="https://chat.whatsapp.com/Cc3kKS0PEuWEceGUqsPR5X" target="_blank" rel="noreferrer" className="hover:text-[color:var(--color-mocha)]">WhatsApp</a>
        </div>
      </div>
    </footer>
  );
}
