import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/lib/api-client";
import { fmtKES, useCart } from "@/store/cart";
import { toast } from "sonner";
import { useAuthReady } from "@/hooks/useAuthReady";
import { withTimeout } from "@/lib/supabase-timeout";

export const Route = createFileRoute("/checkout")({
  component: Checkout,
  head: () => ({ meta: [{ title: "Checkout · Néra Wear" }] }),
});

const counties = ["Nairobi", "Mombasa", "Kisumu", "Nakuru", "Eldoret", "Thika", "Machakos", "Nyeri", "Other"];

const schema = z.object({
  first_name: z.string().trim().min(1).max(80),
  last_name: z.string().trim().min(1).max(80),
  phone: z.string().trim().regex(/^(?:\+?254|0)7\d{8}$/, "Enter a valid Kenyan phone (e.g. 07XX XXX XXX)"),
  email: z.string().trim().email().max(255).optional().or(z.literal("")),
  county: z.string().min(1, "Choose a delivery county"),
  address: z.string().trim().min(4).max(500),
});

function deliveryFor(county: string, subtotal: number): number {
  if (subtotal >= 10000 && county === "Nairobi") return 0;
  if (county === "Nairobi") return 300;
  if (!county) return 0;
  return 600;
}

type Coupon = { code: string; discount_type: "percent" | "fixed"; value: number; min_subtotal_kes: number; expires_at: string | null; max_uses: number | null; uses: number };

function Checkout() {
  const { items, subtotal, clear } = useCart();
  const navigate = useNavigate();
  const [form, setForm] = useState({ first_name: "", last_name: "", phone: "", email: "", county: "", address: "" });
  const [busy, setBusy] = useState(false);
  const [coupon, setCoupon] = useState<Coupon | null>(null);
  const [couponCode, setCouponCode] = useState("");
  const [placed, setPlaced] = useState<{ id: string; number: string; total: number } | null>(null);
  const [mpesaCode, setMpesaCode] = useState("");
  const [confirming, setConfirming] = useState(false);
  const { user, ready } = useAuthReady();

  // Redirect guests to create an account before checkout
  useEffect(() => {
    if (ready && !user) navigate({ to: "/auth", search: { mode: "signup", redirect: "/checkout" } as never });
  }, [navigate, ready, user]);
  const sub = subtotal();
  const delivery = deliveryFor(form.county, sub);
  const discount = coupon
    ? coupon.discount_type === "percent"
      ? Math.round((sub * coupon.value) / 100)
      : Math.min(coupon.value, sub)
    : 0;
  const total = Math.max(0, sub + delivery - discount);

  async function applyCoupon() {
    const code = couponCode.trim().toUpperCase();
    if (!code) return;
    const { data, error } = await supabase.rpc("validate_coupon", { _code: code, _subtotal_kes: sub });
    const row = Array.isArray(data) ? data[0] : data;
    if (error || !row || !row.code) return toast.error(row?.message ?? "Invalid code.");
    setCoupon({ code: row.code, discount_type: row.discount_type, value: row.value, min_subtotal_kes: 0 } as Coupon);
    toast.success(`Code ${row.code} applied.`);
  }

  if (items.length === 0 && !placed) {
    return (
      <div className="px-6 py-24 text-center md:px-12">
        <h1 className="serif mb-4 text-3xl font-light">Your bag is empty</h1>
        <Link to="/shop" className="btn-dark mt-4 inline-block">Browse the collection</Link>
      </div>
    );
  }

  async function placeOrder(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    if (!user) return navigate({ to: "/auth", search: { mode: "signup", redirect: "/checkout" } as never });
    setBusy(true);
    try {
      const { data: order, error } = await withTimeout(
        supabase
          .from("orders")
          .insert({
            user_id: user.id,
            ...parsed.data,
            email: parsed.data.email || null,
            subtotal_kes: sub,
            delivery_fee_kes: delivery,
            discount_kes: discount,
            coupon_code: coupon?.code ?? null,
            total_kes: total,
            payment_method: "mpesa",
          })
          .select("id,order_number")
          .single(),
        "Placing your order",
        12_000,
      );

      if (error || !order) return toast.error("Could not place order. Please try again.");
      const lineItems = items.map((i) => ({
        order_id: order.id,
        product_id: i.productId,
        product_name: i.name,
        size: i.size,
        unit_price_kes: i.price,
        quantity: i.qty,
        image_url: i.image ?? null,
      }));
            let itemsSaved = false;
      try {
        const { error: itemsError } = await withTimeout(
          supabase.from("order_items").insert(lineItems),
          "Saving your order items",
          30_000,
        );
        itemsSaved = !itemsError;
      } catch {
        itemsSaved = false;
      }

      if (!itemsSaved) {
        const { data: saved } = await supabase.from("order_items").select("id").eq("order_id", order.id).limit(1);
        if (!saved || saved.length === 0) {
          return toast.error("Could not save your order items. Please try again.");
        }
      }

      const { data: finalOrder } = await supabase
        .from("orders")
        .select("total_kes")
        .eq("id", order.id)
        .maybeSingle();
      clear();
      setPlaced({ id: order.id, number: order.order_number, total: finalOrder?.total_kes ?? total });

    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not place order. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmPayment() {
    if (!placed) return;
    const code = mpesaCode.trim().toUpperCase();
    if (code.length < 8) return toast.error("Enter the full M-Pesa confirmation code.");
    setConfirming(true);
    try {
      const { error } = await withTimeout(
        supabase.from("orders").update({ payment_ref: code }).eq("id", placed.id),
        "Saving your M-Pesa code",
        10_000,
      );
      if (error) return toast.error("Couldn't save the code. Try again or WhatsApp us.");
      toast.success("Thank you! We'll confirm and dispatch shortly.");
      navigate({ to: "/account" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't save the code. Try again or WhatsApp us.");
    } finally {
      setConfirming(false);
    }
  }

  if (placed) {
    return (
      <section className="mx-auto max-w-xl px-6 py-16 md:px-12">
        <span className="eyebrow mb-3 block">Order {placed.number}</span>
        <h1 className="serif mb-4 text-3xl font-light">Almost there — complete payment</h1>
        <p className="mb-6 text-[0.78rem] leading-[1.9] text-neutral-600">
          Pay <strong className="serif text-base">{fmtKES(placed.total)}</strong> via M-Pesa Pochi la Biashara, then paste your confirmation code below so we can dispatch your order.
        </p>
        <ol className="mb-8 space-y-3 border border-[color:var(--color-border)] bg-white p-6 text-[0.78rem] leading-[1.9]">
          <li>1. Open M-Pesa → <strong>Lipa na M-Pesa</strong> → <strong>Pochi la Biashara</strong></li>
          <li>2. Phone number: <strong className="font-mono">0748 609 410</strong></li>
          <li>3. Recipient name: <strong>Nelvine Isubire</strong></li>
          <li>4. Amount: <strong>KSh {placed.total.toLocaleString()}</strong></li>
          <li>5. Reference: <strong>{placed.number}</strong></li>
          <li>6. Enter your M-Pesa PIN to confirm</li>
        </ol>
        <label className="mb-2 block text-[0.6rem] uppercase tracking-[0.2em] text-[color:var(--color-mocha)]">M-Pesa confirmation code</label>
        <input value={mpesaCode} onChange={(e) => setMpesaCode(e.target.value.toUpperCase())} placeholder="e.g. SLA1B2C3D4"
          className="w-full border border-[color:var(--color-input)] bg-white px-4 py-3 font-mono text-[0.85rem] tracking-wider outline-none focus:border-[color:var(--color-mocha)]" />
        <button onClick={confirmPayment} disabled={confirming} className="btn-dark mt-5 w-full disabled:opacity-50">
          {confirming ? "Saving…" : "I've paid — submit code"}
        </button>
        <a href="https://wa.me/254734416944" target="_blank" rel="noreferrer" className="mt-4 block text-center text-[0.7rem] uppercase tracking-[0.2em] text-[color:var(--color-mocha)] underline-offset-4 hover:underline">
          Need help? WhatsApp us
        </a>
      </section>
    );
  }

  return (
    <section className="mx-auto flex max-w-6xl flex-col gap-12 px-6 py-12 md:grid md:grid-cols-[1fr_380px] md:px-12">
      <form onSubmit={placeOrder} className="order-2 space-y-6 md:order-1">

        <h1 className="serif text-3xl font-light">Delivery details</h1>
        <div className="grid grid-cols-2 gap-4">
          <Field label="First name" value={form.first_name} onChange={(v) => setForm({ ...form, first_name: v })} />
          <Field label="Last name" value={form.last_name} onChange={(v) => setForm({ ...form, last_name: v })} />
        </div>
        <Field label="Phone (M-Pesa)" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} placeholder="07XX XXX XXX" />
        <Field label="Email (optional)" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
        <div>
          <label className="mb-2 block text-[0.6rem] uppercase tracking-[0.2em] text-[color:var(--color-mocha)]">Delivery county</label>
          <select value={form.county} onChange={(e) => setForm({ ...form, county: e.target.value })}
            className="w-full border border-[color:var(--color-input)] bg-white/70 px-4 py-3 text-[0.78rem] outline-none focus:border-[color:var(--color-mocha)]">
            <option value="">Select county…</option>
            {counties.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-2 block text-[0.6rem] uppercase tracking-[0.2em] text-[color:var(--color-mocha)]">Specific address / estate</label>
          <textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })}
            className="w-full border border-[color:var(--color-input)] bg-white/70 px-4 py-3 text-[0.78rem] outline-none focus:border-[color:var(--color-mocha)]"
            rows={3} placeholder="e.g. Westlands, near ABC Hotel" />
        </div>

        <div className="border border-[color:var(--color-border)] bg-gradient-to-br from-[#1a4d2e] to-[#0f3320] p-6 text-white">
          <h3 className="mb-2 text-[0.68rem] uppercase tracking-[0.2em]">💚 Pay via M-Pesa Pochi la Biashara</h3>
          <p className="text-[0.72rem] leading-[1.8] opacity-90">
            After placing your order, you'll get step-by-step instructions to send <strong>KSh {total.toLocaleString()}</strong> to
            <strong> 0748 609 410 (Nelvine Isubire)</strong>, then paste your M-Pesa code so we can dispatch.
          </p>
        </div>

        <button disabled={busy} type="submit" className="btn-dark w-full disabled:opacity-50">
          {busy ? "Placing order…" : `Place Order · ${fmtKES(total)}`}
        </button>
      </form>

      <aside className="order-1 h-fit border border-[color:var(--color-border)] bg-white p-6 md:order-2">
        <h3 className="mb-5 text-[0.65rem] uppercase tracking-[0.25em] text-[color:var(--color-mocha)]">Order summary</h3>
        <ul className="mb-5 divide-y divide-[color:var(--color-border)]">
          {items.map((i) => (
            <li key={`${i.productId}-${i.size}`} className="flex justify-between py-3 text-[0.78rem]">
              <span>{i.name} · {i.size} × {i.qty}</span>
              <span>{fmtKES(i.price * i.qty)}</span>
            </li>
          ))}
        </ul>

        <div className="mb-4 border-y border-[color:var(--color-border)] py-4">
          <label className="mb-2 block text-[0.6rem] uppercase tracking-[0.2em] text-[color:var(--color-mocha)]">Promo code</label>
          {coupon ? (
            <div className="flex items-center justify-between text-[0.75rem]">
              <span className="font-mono">{coupon.code}</span>
              <button type="button" onClick={() => { setCoupon(null); setCouponCode(""); }} className="text-[0.6rem] uppercase tracking-wider text-[color:var(--color-err)]">Remove</button>
            </div>
          ) : (
            <div className="flex gap-2">
              <input value={couponCode} onChange={(e) => setCouponCode(e.target.value)} placeholder="ENTER CODE"
                className="flex-1 border border-[color:var(--color-input)] bg-white px-3 py-2 text-[0.75rem] uppercase outline-none focus:border-[color:var(--color-mocha)]" />
              <button type="button" onClick={applyCoupon} className="border border-[color:var(--color-ink)] px-3 text-[0.6rem] uppercase tracking-wider hover:bg-[color:var(--color-ink)] hover:text-[color:var(--color-mist)]">Apply</button>
            </div>
          )}
        </div>

        <Row label="Subtotal" value={fmtKES(sub)} />
        <Row label="Delivery" value={delivery === 0 ? "Free" : fmtKES(delivery)} />
        {discount > 0 && <Row label="Discount" value={`− ${fmtKES(discount)}`} />}
        <div className="mt-4 flex justify-between border-t border-[color:var(--color-border)] pt-4">
          <span className="text-[0.7rem] uppercase tracking-[0.18em]">Total</span>
          <strong className="serif text-xl">{fmtKES(total)}</strong>
        </div>
      </aside>
    </section>
  );
}

function Field({ label, value, onChange, type = "text", placeholder }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <div>
      <label className="mb-2 block text-[0.6rem] uppercase tracking-[0.2em] text-[color:var(--color-mocha)]">{label}</label>
      <input type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)}
        className="w-full border border-[color:var(--color-input)] bg-white/70 px-4 py-3 text-[0.78rem] outline-none focus:border-[color:var(--color-mocha)]" />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-1 text-[0.75rem]">
      <span className="text-neutral-600">{label}</span>
      <span>{value}</span>
    </div>
  );
}
