import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/lib/api-client";
import { toast } from "sonner";
import { z } from "zod";
import { useAuthReady } from "@/hooks/useAuthReady";

const reviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  title: z.string().trim().max(120).optional().or(z.literal("")),
  body: z.string().trim().max(2000).optional().or(z.literal("")),
});

export function Reviews({ productId }: { productId: string }) {
  const qc = useQueryClient();
  const { user } = useAuthReady();
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: reviews = [] } = useQuery({
    queryKey: ["reviews", productId],
    queryFn: async () => {
      const { data } = await supabase
        .from("reviews_public" as any)
        .select("id,rating,title,body,verified_buyer,created_at")
        .eq("product_id", productId)
        .order("created_at", { ascending: false });
      return (data ?? []) as any[];
    },
  });

  const avg = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return toast.error("Please sign in to leave a review.");
    const parsed = reviewSchema.safeParse({ rating, title, body });
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    setBusy(true);
    // verified_buyer is computed server-side by a trigger from the user's real orders
    const { error } = await supabase.from("reviews").upsert({
      product_id: productId,
      user_id: user.id,
      rating,
      title: title || null,
      body: body || null,
    }, { onConflict: "product_id,user_id" });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Thank you for your review.");
    setTitle(""); setBody("");
    qc.invalidateQueries({ queryKey: ["reviews", productId] });
  }

  return (
    <section className="mt-16 border-t border-[color:var(--color-border)] pt-12">
      <div className="mb-8 flex items-end justify-between">
        <h2 className="serif text-3xl font-light">Reviews</h2>
        <div className="text-right">
          <Stars value={avg} />
          <div className="mt-1 text-[0.65rem] uppercase tracking-[0.2em] text-[color:var(--color-mocha)]">
            {reviews.length} {reviews.length === 1 ? "review" : "reviews"}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-10 md:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          {reviews.length === 0 && <p className="text-[0.78rem] text-neutral-500">Be the first to share your thoughts.</p>}
          {reviews.map((r) => (
            <article key={r.id} className="border border-[color:var(--color-border)] bg-white p-5">
              <div className="mb-2 flex items-center justify-between">
                <Stars value={r.rating} />
                {r.verified_buyer && (
                  <span className="text-[0.55rem] uppercase tracking-[0.22em] text-[color:var(--color-success)]">✓ Verified buyer</span>
                )}
              </div>
              {r.title && <h3 className="serif mb-1 text-lg">{r.title}</h3>}
              {r.body && <p className="text-[0.8rem] leading-[1.8] text-neutral-700">{r.body}</p>}
              <div className="mt-3 text-[0.6rem] uppercase tracking-[0.2em] text-neutral-400">
                {new Date(r.created_at).toLocaleDateString()}
              </div>
            </article>
          ))}
        </div>

        <form onSubmit={submit} className="h-fit border border-[color:var(--color-border)] bg-white p-6">
          <h3 className="serif mb-4 text-xl">Write a review</h3>
          {!user ? (
            <p className="text-[0.75rem] text-neutral-600">Please sign in to leave a review.</p>
          ) : (
            <>
              <label className="mb-2 block text-[0.6rem] uppercase tracking-[0.2em] text-[color:var(--color-mocha)]">Rating</label>
              <div className="mb-4 flex gap-1">
                {[1,2,3,4,5].map((n) => (
                  <button type="button" key={n} onClick={() => setRating(n)} aria-label={`${n} stars`}>
                    <Star className={`h-6 w-6 ${n <= rating ? "fill-[color:var(--color-mahogany)] text-[color:var(--color-mahogany)]" : "text-neutral-300"}`} />
                  </button>
                ))}
              </div>
              <label className="mb-2 block text-[0.6rem] uppercase tracking-[0.2em] text-[color:var(--color-mocha)]">Title</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120}
                className="mb-4 w-full border border-[color:var(--color-input)] bg-white px-4 py-3 text-[0.78rem] outline-none focus:border-[color:var(--color-mocha)]" />
              <label className="mb-2 block text-[0.6rem] uppercase tracking-[0.2em] text-[color:var(--color-mocha)]">Your review</label>
              <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} maxLength={2000}
                className="mb-4 w-full border border-[color:var(--color-input)] bg-white px-4 py-3 text-[0.78rem] outline-none focus:border-[color:var(--color-mocha)]" />
              <button disabled={busy} className="btn-dark w-full">{busy ? "Submitting…" : "Submit review"}</button>
            </>
          )}
        </form>
      </div>
    </section>
  );
}

function Stars({ value }: { value: number }) {
  return (
    <div className="flex gap-0.5">
      {[1,2,3,4,5].map((n) => (
        <Star key={n} className={`h-4 w-4 ${n <= Math.round(value) ? "fill-[color:var(--color-mahogany)] text-[color:var(--color-mahogany)]" : "text-neutral-300"}`} />
      ))}
    </div>
  );
}
