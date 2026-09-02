import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/api-client";
import { fmtKES } from "@/store/cart";
import { toast } from "sonner";
import { z } from "zod";
import { useAuthReady } from "@/hooks/useAuthReady";
import { withTimeout } from "@/lib/supabase-timeout";

export const Route = createFileRoute("/admin")({
  component: Admin,
  head: () => ({ meta: [{ title: "Admin · Néra Wear" }] }),
});

type Tab = "dashboard" | "products" | "upload" | "orders" | "coupons" | "gifts";

function Admin() {
  const { user, ready } = useAuthReady();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [tab, setTab] = useState<Tab>("dashboard");

  useEffect(() => {
    if (!ready) return;
    if (!user) return setIsAdmin(false);
    // Authoritative check: the server decides admin status.
    withTimeout(supabase.auth.getUser(), "Checking admin access", 8_000)
      .then(({ data }) => setIsAdmin(!!(data.user as { is_store_admin?: boolean } | null)?.is_store_admin))
      .catch(() => setIsAdmin(false));
  }, [ready, user]);

      //.then(({ data }) => setIsAdmin(!!data))
      //.catch(() => setIsAdmin(false));
  //}, [ready, user]);

  if (!ready || (isAdmin === null && user)) {
    return <div className="p-12 text-center text-[0.7rem] uppercase tracking-[0.2em]">Loading…</div>;
  }
  if (!user) {
    return (
      <section className="mx-auto max-w-md px-6 py-20 text-center">
        <h1 className="serif mb-4 text-3xl font-light">Admin access</h1>
        <p className="mb-6 text-[0.75rem] text-neutral-600">Please sign in with an admin account.</p>
        <Link to="/auth" className="btn-dark inline-block">Sign in</Link>
      </section>
    );
  }
  if (!isAdmin) {
    return (
      <section className="mx-auto max-w-xl px-6 py-20 text-center">
        <h1 className="serif mb-4 text-3xl font-light">Not authorized</h1>
        <p className="mb-3 text-[0.75rem] leading-[1.9] text-neutral-600">
          Your account ({user.email}) doesn't have admin access. Please contact the store owner.
        </p>
        <Link to="/" className="btn-dark mt-4 inline-block">Back to store</Link>
      </section>
    );
  }

  return (
    <div className="grid min-h-screen grid-cols-1 md:grid-cols-[220px_1fr]">
      <aside className="border-r border-[color:var(--color-border)] bg-white py-6">
        <div className="px-6 pb-4">
          <div className="serif text-lg tracking-[0.2em]">NÉRA · Admin</div>
          <div className="text-[0.6rem] uppercase tracking-[0.2em] text-neutral-500">{user.email}</div>
        </div>
        {(["dashboard", "products", "upload", "orders", "coupons", "gifts"] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`block w-full border-l-2 px-6 py-3 text-left text-[0.65rem] uppercase tracking-[0.2em] transition-all ${tab === t ? "border-[color:var(--color-mocha)] bg-[color:var(--color-mocha)]/10 text-[color:var(--color-mocha)]" : "border-transparent hover:bg-[color:var(--color-mocha)]/5"}`}>
            {t === "upload" ? "Upload Item" : t}
          </button>
        ))}
        <Link to="/" className="mt-6 block px-6 text-[0.6rem] uppercase tracking-[0.2em] text-neutral-500">← Back to store</Link>
      </aside>
      <main className="p-10">
        {tab === "dashboard" && <Dashboard />}
        {tab === "products" && <ProductsList />}
        {tab === "upload" && <UploadForm />}
        {tab === "orders" && <OrdersList />}
        {tab === "coupons" && <CouponsAdmin />}
        {tab === "gifts" && <GiftsAdmin />}
      </main>
    </div>
  );
}

function Dashboard() {
  const { data: stats } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const [{ count: totalProducts }, { count: inStock }, { data: revData }] = await Promise.all([
        supabase.from("products").select("*", { count: "exact", head: true }),
        supabase.from("products").select("*", { count: "exact", head: true }).eq("sold", false),
        supabase.from("orders").select("total_kes,status").eq("status", "paid"),
      ]);
      const revenue = (revData ?? []).reduce((s, o) => s + (o.total_kes ?? 0), 0);
      return { totalProducts, inStock, revenue, orderCount: revData?.length ?? 0 };
    },
  });
  return (
    <>
      <h1 className="serif mb-8 border-b border-[color:var(--color-border)] pb-4 text-3xl font-light">Dashboard</h1>
      <div className="mb-10 grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Total products" value={stats?.totalProducts ?? "—"} />
        <Stat label="In stock" value={stats?.inStock ?? "—"} />
        <Stat label="Paid orders" value={stats?.orderCount ?? 0} />
        <Stat label="Revenue" value={fmtKES(stats?.revenue ?? 0)} />
      </div>
      <h2 className="serif mb-2 text-xl font-light">Recent orders</h2>
      <p className="mb-4 text-[0.7rem] text-neutral-600">After confirming the M-Pesa payment on your phone, approve or decline below. The customer is messaged on WhatsApp automatically.</p>
      <OrdersList limit={8} />
    </>
  );
}

function ProductsList() {
  const qc = useQueryClient();
  const { data: products = [] } = useQuery({
    queryKey: ["admin-products"],
    queryFn: async () => {
      const { data } = await supabase.from("products").select("id,name,price_kes,tag,sold,featured,category_id").order("created_at", { ascending: false });
      return data ?? [];
    },
  });
  const { data: cats = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data } = await supabase.from("categories").select("id,name").order("sort_order");
      return data ?? [];
    },
  });
  async function toggleSold(id: string, sold: boolean) {
    const { error } = await supabase.from("products").update({ sold: !sold }).eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["admin-products"] });
  }
  async function toggleFeatured(id: string, featured: boolean) {
    const { error } = await supabase.from("products").update({ featured: !featured }).eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["admin-products"] });
    qc.invalidateQueries({ queryKey: ["featured"] });
    toast.success(!featured ? "Pinned to homepage." : "Removed from homepage.");
  }
  async function setCategory(id: string, category_id: string) {
    const { error } = await supabase.from("products").update({ category_id: category_id || null }).eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["admin-products"] });
    toast.success("Category updated.");
  }
  async function updatePrice(id: string, current: number) {
    const raw = window.prompt("New price in KSh:", String(current));
    if (raw === null) return;
    const next = Number(raw);
    if (!Number.isFinite(next) || next < 1 || next > 10_000_000) return toast.error("Enter a valid price.");
    const { error } = await supabase.from("products").update({ price_kes: Math.round(next) }).eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["admin-products"] });
    qc.invalidateQueries({ queryKey: ["featured"] });
    toast.success("Price updated.");
  }
  async function remove(id: string) {
    if (!confirm("Delete this product?")) return;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["admin-products"] });
    toast.success("Deleted.");
  }
  return (
    <>
      <h1 className="serif mb-8 border-b border-[color:var(--color-border)] pb-4 text-3xl font-light">Products</h1>
      <Table head={["Name","Category","Price","Tag","Status",""]}
        rows={products.map((p) => [
          p.name,
          <select key="cat" value={p.category_id ?? ""} onChange={(e) => setCategory(p.id, e.target.value)}
            className="border border-[color:var(--color-input)] bg-white px-2 py-1 text-[0.7rem]">
            <option value="">— none —</option>
            {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>,
          <button key="price" onClick={() => updatePrice(p.id, p.price_kes)} className="text-left text-[0.75rem] text-[color:var(--color-mocha)] underline-offset-4 hover:underline" title="Click to edit price">
            {fmtKES(p.price_kes)}
          </button>,
          p.tag ?? "—", p.sold ? "Sold out" : "Live",
          <span key="a" className="flex flex-wrap gap-2">
            <button onClick={() => toggleFeatured(p.id, p.featured)} className={`text-[0.6rem] uppercase tracking-[0.15em] ${p.featured ? "text-[color:var(--color-mahogany)]" : "text-[color:var(--color-mocha)]"}`}>{p.featured ? "★ Featured" : "☆ Feature"}</button>
            <button onClick={() => toggleSold(p.id, p.sold)} className="text-[0.6rem] uppercase tracking-[0.15em] text-[color:var(--color-mocha)]">{p.sold ? "Restock" : "Mark sold"}</button>
            <button onClick={() => remove(p.id)} className="text-[0.6rem] uppercase tracking-[0.15em] text-[color:var(--color-err)]">Delete</button>
          </span>,
        ])} />
    </>
  );
}

async function uploadOne(file: File, prefix: string): Promise<string | null> {
  if (file.size > 5_000_000) { toast.error(`${file.name} is over 5MB.`); return null; }
  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `${prefix}${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  try {
    const res = await withTimeout(
      supabase.storage.from("product-images").upload(path, file, { contentType: file.type, upsert: false }),
      `Uploading ${file.name}`,
      45_000,
    );
    if (res?.error) { toast.error(res.error.message); return null; }
    const { data } = supabase.storage.from("product-images").getPublicUrl(path);
    return data.publicUrl;
  } catch (e) {
    toast.error(e instanceof Error ? e.message : `${file.name} failed to upload.`);
    return null;
  }
}

const productSchema = z.object({
  name: z.string().trim().min(2).max(120),
  category_id: z.string().uuid(),
  price_kes: z.number().int().min(1).max(10_000_000),
  tag: z.string().trim().max(40).optional().or(z.literal("")),
  sizes: z.string().trim().min(1),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
});

function UploadForm() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const { data: cats = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data } = await supabase.from("categories").select("id,name").order("sort_order");
      return data ?? [];
    },
  });
  const [form, setForm] = useState({ name: "", category_id: "", price_kes: "", tag: "", sizes: "XS, S, M, L", description: "" });
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleFiles(files: FileList | null) {
    if (!files || !files.length) return;
    setUploading(true);
    try {
      const results = await Promise.all(Array.from(files).map((f) => uploadOne(f, "")));
      const ok = results.filter((u): u is string => !!u);
      if (ok.length) setImages((prev) => [...prev, ...ok]);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = productSchema.safeParse({ ...form, price_kes: Number(form.price_kes) });
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    if (images.length === 0) return toast.error("Upload at least one product image.");
    setBusy(true);
    try {
      const slug = parsed.data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") + "-" + Math.random().toString(36).slice(2, 6);
      const sizes = parsed.data.sizes.split(",").map((s) => s.trim()).filter(Boolean);
      const { error } = await withTimeout(
        supabase.from("products").insert({
          name: parsed.data.name, slug, category_id: parsed.data.category_id,
          price_kes: parsed.data.price_kes, tag: parsed.data.tag || null,
          sizes, description: parsed.data.description || null,
          image_url: images[0], gallery: images.slice(1),
        }),
        "Publishing this item",
        12_000,
      );
      if (error) return toast.error(error.message);
      toast.success("Published to store.");
      qc.invalidateQueries({ queryKey: ["admin-products"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["featured"] });
      setForm({ name: "", category_id: "", price_kes: "", tag: "", sizes: "XS, S, M, L", description: "" });
      setImages([]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Publishing failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h1 className="serif mb-8 border-b border-[color:var(--color-border)] pb-4 text-3xl font-light">Upload new item</h1>
      <form onSubmit={submit} className="max-w-2xl space-y-5 border border-[color:var(--color-border)] bg-white p-8">
        <F label="Product name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-2 block text-[0.6rem] uppercase tracking-[0.2em] text-[color:var(--color-mocha)]">Category</label>
            <select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}
              className="w-full border border-[color:var(--color-input)] bg-white px-4 py-3 text-[0.78rem] outline-none">
              <option value="">Select…</option>
              {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <F label="Price (KSh)" type="number" value={form.price_kes} onChange={(v) => setForm({ ...form, price_kes: v })} />
        </div>
        <F label="Tag (e.g. New In)" value={form.tag} onChange={(v) => setForm({ ...form, tag: v })} />
        <F label="Sizes (comma separated)" value={form.sizes} onChange={(v) => setForm({ ...form, sizes: v })} />

        <div>
          <label className="mb-2 block text-[0.6rem] uppercase tracking-[0.2em] text-[color:var(--color-mocha)]">
            Product images (first one is the main photo)
          </label>
          <input ref={fileRef} type="file" accept="image/*" multiple onChange={(e) => handleFiles(e.target.files)}
            className="block w-full text-[0.7rem] file:mr-4 file:border-0 file:bg-[color:var(--color-ink)] file:px-4 file:py-2 file:text-[0.65rem] file:uppercase file:tracking-wider file:text-[color:var(--color-mist)]" />
          {uploading && <div className="mt-2 text-[0.65rem] uppercase tracking-wider text-[color:var(--color-mocha)]">Uploading…</div>}
          {images.length > 0 && (
            <div className="mt-3 grid grid-cols-5 gap-2">
              {images.map((url, i) => (
                <div key={url} className="relative aspect-square overflow-hidden border border-[color:var(--color-border)]">
                  <img src={url} alt="" className="h-full w-full object-cover" />
                  <button type="button" onClick={() => setImages((p) => p.filter((_, j) => j !== i))}
                    className="absolute right-1 top-1 bg-black/70 px-1.5 text-[0.55rem] text-white">×</button>
                  {i === 0 && <span className="absolute bottom-1 left-1 bg-[color:var(--color-mahogany)] px-1.5 text-[0.5rem] uppercase tracking-wider text-white">Main</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="mb-2 block text-[0.6rem] uppercase tracking-[0.2em] text-[color:var(--color-mocha)]">Description</label>
          <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={4}
            className="w-full border border-[color:var(--color-input)] bg-white px-4 py-3 text-[0.78rem] outline-none focus:border-[color:var(--color-mocha)]" />
        </div>
        <button disabled={busy} className="btn-dark w-full">{busy ? "Publishing…" : "Publish item"}</button>
      </form>
    </>
  );
}

function OrdersList({ limit }: { limit?: number } = {}) {
  const qc = useQueryClient();
  const { data: orders = [] } = useQuery({
    queryKey: ["admin-orders", limit ?? "all"],
    queryFn: async () => {
      let q = supabase.from("orders")
        .select("id,order_number,first_name,last_name,phone,county,total_kes,status,payment_ref,created_at")
        .order("created_at", { ascending: false });
      if (limit) q = q.limit(limit);
      const { data } = await q;
      return data ?? [];
    },
  });
  async function setStatus(id: string, status: "pending"|"paid"|"shipped"|"delivered"|"cancelled") {
    const { error } = await supabase.from("orders").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["admin-orders"] });
    toast.success("Updated.");
  }
  function normalizePhone(raw: string): string {
    const digits = raw.replace(/\D/g, "");
    if (digits.startsWith("254")) return digits;
    if (digits.startsWith("0")) return "254" + digits.slice(1);
    if (digits.startsWith("7") && digits.length === 9) return "254" + digits;
    return digits;
  }
  function openWhatsApp(phone: string, msg: string) {
    const url = `https://wa.me/${normalizePhone(phone)}?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank", "noopener");
  }
  async function approveAndNotify(o: { id: string; order_number: string; first_name: string; phone: string; total_kes: number }) {
    const msg = `Hi ${o.first_name} ✨\n\nYour Néra Wear order *${o.order_number}* has been confirmed 💛\n\nWe've received your payment of *KSh ${o.total_kes.toLocaleString()}* and your order is now being prepared for transit 🚚\n\nYou'll hear from us as soon as it arrives so you can pick it up. Thank you for shopping with us — we hope this order brightens your day 🌸\n\nWith love,\nNéra Wear`;
    // Open WhatsApp FIRST while we still have user-gesture activation
    openWhatsApp(o.phone, msg);
    const { error } = await supabase.from("orders").update({ status: "paid" }).eq("id", o.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["admin-orders"] });
    toast.success("Order approved & WhatsApp opened.");
  }
  async function declineAndNotify(o: { id: string; order_number: string; first_name: string; phone: string; total_kes: number }) {
    const msg = `Hi ${o.first_name} 🌷\n\nThank you for your order *${o.order_number}* with Néra Wear.\n\nWe haven't been able to confirm your M-Pesa payment of *KSh ${o.total_kes.toLocaleString()}* on our side just yet. Could you kindly send us a screenshot of your M-Pesa confirmation message, or try the payment again so we can get your order moving? 💛\n\nIf you need any help we're right here — just reply to this message.\n\nThank you for your patience,\nNéra Wear`;
    // Open WhatsApp FIRST while we still have user-gesture activation (no confirm dialog)
    openWhatsApp(o.phone, msg);
    const { error } = await supabase.from("orders").update({ status: "cancelled" }).eq("id", o.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["admin-orders"] });
    toast.success("Order declined & WhatsApp opened.");
  }
  return (
    <>
      {!limit && <h1 className="serif mb-8 border-b border-[color:var(--color-border)] pb-4 text-3xl font-light">All orders</h1>}
      {!limit && <p className="mb-4 text-[0.7rem] text-neutral-600">Confirm M-Pesa code against your Pochi la Biashara messages, then click <strong>Approve</strong> to mark the order as paid and send a WhatsApp confirmation to the customer. Use <strong>Decline</strong> if the payment isn't found.</p>}
      <Table head={["Order","Customer","Phone","County","Total","M-Pesa Code","Status","Action"]}
        rows={orders.map((o) => [o.order_number, `${o.first_name} ${o.last_name}`, o.phone, o.county, fmtKES(o.total_kes),
          o.payment_ref ? <span key="c" className="font-mono text-[0.7rem]">{o.payment_ref}</span> : <span key="c" className="text-[0.65rem] text-neutral-400">—</span>,
          o.status,
          <div key="s" className="flex flex-col gap-1.5">
            {o.status === "pending" && (
              <>
                <button onClick={() => approveAndNotify(o)} className="bg-[color:var(--color-ink)] px-3 py-1.5 text-[0.6rem] uppercase tracking-wider text-[color:var(--color-mist)] hover:bg-[color:var(--color-mahogany)]">
                  Approve & message
                </button>
                <button onClick={() => declineAndNotify(o)} className="border border-[color:var(--color-err)] px-3 py-1.5 text-[0.6rem] uppercase tracking-wider text-[color:var(--color-err)] hover:bg-[color:var(--color-err)] hover:text-white">
                  Decline & message
                </button>
              </>
            )}
            <select value={o.status} onChange={(e) => setStatus(o.id, e.target.value as "pending"|"paid"|"shipped"|"delivered"|"cancelled")}
              className="border border-[color:var(--color-input)] bg-white px-2 py-1 text-[0.65rem] uppercase tracking-wider">
              {["pending","paid","shipped","delivered","cancelled"].map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>,
        ])} />
    </>
  );
}

const couponSchema = z.object({
  code: z.string().trim().min(2).max(40).regex(/^[A-Z0-9_-]+$/i, "Letters, numbers, _ and - only"),
  discount_type: z.enum(["percent","fixed"]),
  value: z.number().int().min(1),
  min_subtotal_kes: z.number().int().min(0),
  max_uses: z.number().int().min(1).nullable(),
  expires_at: z.string().nullable(),
});

function CouponsAdmin() {
  const qc = useQueryClient();
  const { data: coupons = [] } = useQuery({
    queryKey: ["admin-coupons"],
    queryFn: async () => {
      const { data } = await supabase.from("coupons").select("*").order("created_at", { ascending: false });
      return data ?? [];
    },
  });
  const [form, setForm] = useState({ code: "", discount_type: "percent" as "percent"|"fixed", value: "", min_subtotal_kes: "0", max_uses: "", expires_at: "" });

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const parsed = couponSchema.safeParse({
      code: form.code.toUpperCase(),
      discount_type: form.discount_type,
      value: Number(form.value),
      min_subtotal_kes: Number(form.min_subtotal_kes || 0),
      max_uses: form.max_uses ? Number(form.max_uses) : null,
      expires_at: form.expires_at || null,
    });
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    const { error } = await supabase.from("coupons").insert(parsed.data);
    if (error) return toast.error(error.message);
    toast.success("Coupon created.");
    setForm({ code: "", discount_type: "percent", value: "", min_subtotal_kes: "0", max_uses: "", expires_at: "" });
    qc.invalidateQueries({ queryKey: ["admin-coupons"] });
  }

  async function toggleActive(id: string, active: boolean) {
    const { error } = await supabase.from("coupons").update({ active: !active }).eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["admin-coupons"] });
  }

  async function remove(id: string) {
    if (!confirm("Delete coupon?")) return;
    const { error } = await supabase.from("coupons").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["admin-coupons"] });
  }

  return (
    <>
      <h1 className="serif mb-8 border-b border-[color:var(--color-border)] pb-4 text-3xl font-light">Promo codes</h1>
      <form onSubmit={create} className="mb-10 max-w-2xl space-y-5 border border-[color:var(--color-border)] bg-white p-6">
        <h2 className="serif text-xl">Create new code</h2>
        <div className="grid grid-cols-2 gap-4">
          <F label="Code" value={form.code} onChange={(v) => setForm({ ...form, code: v.toUpperCase() })} placeholder="WELCOME10" />
          <div>
            <label className="mb-2 block text-[0.6rem] uppercase tracking-[0.2em] text-[color:var(--color-mocha)]">Type</label>
            <select value={form.discount_type} onChange={(e) => setForm({ ...form, discount_type: e.target.value as "percent"|"fixed" })}
              className="w-full border border-[color:var(--color-input)] bg-white px-4 py-3 text-[0.78rem] outline-none">
              <option value="percent">Percent off</option>
              <option value="fixed">Fixed KSh off</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <F label={form.discount_type === "percent" ? "Percent (1–100)" : "Amount (KSh)"} type="number" value={form.value} onChange={(v) => setForm({ ...form, value: v })} />
          <F label="Minimum subtotal (KSh)" type="number" value={form.min_subtotal_kes} onChange={(v) => setForm({ ...form, min_subtotal_kes: v })} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <F label="Max uses (blank = unlimited)" type="number" value={form.max_uses} onChange={(v) => setForm({ ...form, max_uses: v })} />
          <F label="Expires at (optional)" type="datetime-local" value={form.expires_at} onChange={(v) => setForm({ ...form, expires_at: v })} />
        </div>
        <button className="btn-dark w-full">Create code</button>
      </form>

      <Table head={["Code","Discount","Min spend","Uses","Status","Expires",""]}
        rows={coupons.map((c) => [
          <span key="code" className="font-mono">{c.code}</span>,
          c.discount_type === "percent" ? `${c.value}% off` : `${fmtKES(c.value)} off`,
          fmtKES(c.min_subtotal_kes),
          `${c.uses}${c.max_uses ? ` / ${c.max_uses}` : ""}`,
          c.active ? "Active" : "Paused",
          c.expires_at ? new Date(c.expires_at).toLocaleDateString() : "—",
          <span key="a" className="flex gap-3">
            <button onClick={() => toggleActive(c.id, c.active)} className="text-[0.6rem] uppercase tracking-[0.15em] text-[color:var(--color-mocha)]">{c.active ? "Pause" : "Resume"}</button>
            <button onClick={() => remove(c.id)} className="text-[0.6rem] uppercase tracking-[0.15em] text-[color:var(--color-err)]">Delete</button>
          </span>,
        ])} />
    </>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="border border-[color:var(--color-border)] bg-white p-5">
      <div className="serif text-2xl font-normal text-[color:var(--color-mahogany)]">{value}</div>
      <div className="mt-1 text-[0.6rem] uppercase tracking-[0.2em] text-neutral-500">{label}</div>
    </div>
  );
}

function Table({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="overflow-x-auto border border-[color:var(--color-border)] bg-white">
      <table className="w-full text-left text-[0.75rem]">
        <thead className="bg-[color:var(--color-mist)]">
          <tr>{head.map((h) => <th key={h} className="px-4 py-3 text-[0.6rem] uppercase tracking-[0.18em] text-[color:var(--color-mocha)]">{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={head.length} className="px-4 py-8 text-center text-neutral-400">Nothing here yet.</td></tr>
          ) : rows.map((r, i) => (
            <tr key={i} className="border-t border-[color:var(--color-border)]">
              {r.map((c, j) => <td key={j} className="px-4 py-3">{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function F({ label, value, onChange, type = "text", placeholder }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <div>
      <label className="mb-2 block text-[0.6rem] uppercase tracking-[0.2em] text-[color:var(--color-mocha)]">{label}</label>
      <input type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)}
        className="w-full border border-[color:var(--color-input)] bg-white px-4 py-3 text-[0.78rem] outline-none focus:border-[color:var(--color-mocha)]" />
    </div>
  );
}

// ============ GIFT PACKAGES ADMIN ============
const giftSchema = z.object({
  name: z.string().trim().min(2).max(120),
  occasion: z.enum(["birthday","anniversary","valentines","mothers_day","womens_day","graduation","baby_shower","just_because","other"]),
  price_kes: z.number().int().min(1).max(10_000_000),
  item_count: z.number().int().min(1).max(10),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  contents: z.string().trim().max(2000).optional().or(z.literal("")),
});

function GiftsAdmin() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const { data: packages = [] } = useQuery({
    queryKey: ["admin-gifts"],
    queryFn: async () => {
      const { data } = await supabase.from("gift_packages").select("*").order("created_at", { ascending: false });
      return data ?? [];
    },
  });
  const [form, setForm] = useState({ name: "", occasion: "birthday" as const, price_kes: "", item_count: "1", description: "", contents: "" });
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleFiles(files: FileList | null) {
    if (!files || !files.length) return;
    setUploading(true);
    try {
      const results = await Promise.all(Array.from(files).map((f) => uploadOne(f, "gifts/")));
      const ok = results.filter((u): u is string => !!u);
      if (ok.length) setImages((prev) => [...prev, ...ok]);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = giftSchema.safeParse({
      name: form.name, occasion: form.occasion,
      price_kes: Number(form.price_kes), item_count: Number(form.item_count),
      description: form.description, contents: form.contents,
    });
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    if (images.length === 0) return toast.error("Upload at least one photo.");
    setBusy(true);
    const slug = parsed.data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") + "-" + Math.random().toString(36).slice(2, 6);
    const contents = parsed.data.contents
      ? parsed.data.contents.split("\n").map((s) => s.trim()).filter(Boolean)
      : [];
    const { error } = await supabase.from("gift_packages").insert({
      name: parsed.data.name, slug, occasion: parsed.data.occasion,
      price_kes: parsed.data.price_kes, item_count: parsed.data.item_count,
      description: parsed.data.description || null,
      contents, image_url: images[0], gallery: images.slice(1), active: true,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Gift package published.");
    qc.invalidateQueries({ queryKey: ["admin-gifts"] });
    setForm({ name: "", occasion: "birthday", price_kes: "", item_count: "1", description: "", contents: "" });
    setImages([]);
  }

  async function toggleActive(id: string, active: boolean) {
    const { error } = await supabase.from("gift_packages").update({ active: !active }).eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["admin-gifts"] });
  }
  async function remove(id: string) {
    if (!confirm("Delete this gift package?")) return;
    const { error } = await supabase.from("gift_packages").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["admin-gifts"] });
  }

  return (
    <>
      <h1 className="serif mb-2 border-b border-[color:var(--color-border)] pb-4 text-3xl font-light">Gift packages</h1>
      <p className="mb-6 text-[0.7rem] text-neutral-600">Curated bundles for birthdays, Valentine's, Mother's Day and more. Up to 10 items per package.</p>

      <form onSubmit={submit} className="mb-10 max-w-2xl space-y-5 border border-[color:var(--color-border)] bg-white p-8">
        <h2 className="serif text-xl">New gift package</h2>
        <F label="Package name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} placeholder="The Birthday Glow Box" />
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-2 block text-[0.6rem] uppercase tracking-[0.2em] text-[color:var(--color-mocha)]">Occasion</label>
            <select value={form.occasion} onChange={(e) => setForm({ ...form, occasion: e.target.value as typeof form.occasion })}
              className="w-full border border-[color:var(--color-input)] bg-white px-4 py-3 text-[0.78rem] outline-none">
              <option value="birthday">Birthday</option>
              <option value="valentines">Valentine's</option>
              <option value="anniversary">Anniversary</option>
              <option value="womens_day">Women's Day</option>
              <option value="mothers_day">Mother's Day</option>
              <option value="graduation">Graduation</option>
              <option value="baby_shower">Baby Shower</option>
              <option value="just_because">Just because</option>
              <option value="other">Other</option>
            </select>
          </div>
          <F label="Price (KSh)" type="number" value={form.price_kes} onChange={(v) => setForm({ ...form, price_kes: v })} />
        </div>
        <F label="Items in package (1–10)" type="number" value={form.item_count} onChange={(v) => setForm({ ...form, item_count: v })} />

        <div>
          <label className="mb-2 block text-[0.6rem] uppercase tracking-[0.2em] text-[color:var(--color-mocha)]">Photos (first is the cover)</label>
          <input ref={fileRef} type="file" accept="image/*" multiple onChange={(e) => handleFiles(e.target.files)}
            className="block w-full text-[0.7rem] file:mr-4 file:border-0 file:bg-[color:var(--color-ink)] file:px-4 file:py-2 file:text-[0.65rem] file:uppercase file:tracking-wider file:text-[color:var(--color-mist)]" />
          {uploading && <div className="mt-2 text-[0.65rem] uppercase tracking-wider text-[color:var(--color-mocha)]">Uploading…</div>}
          {images.length > 0 && (
            <div className="mt-3 grid grid-cols-5 gap-2">
              {images.map((url, i) => (
                <div key={url} className="relative aspect-square overflow-hidden border border-[color:var(--color-border)]">
                  <img src={url} alt="" className="h-full w-full object-cover" />
                  <button type="button" onClick={() => setImages((p) => p.filter((_, j) => j !== i))}
                    className="absolute right-1 top-1 bg-black/70 px-1.5 text-[0.55rem] text-white">×</button>
                  {i === 0 && <span className="absolute bottom-1 left-1 bg-[color:var(--color-mahogany)] px-1.5 text-[0.5rem] uppercase tracking-wider text-white">Cover</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="mb-2 block text-[0.6rem] uppercase tracking-[0.2em] text-[color:var(--color-mocha)]">Description</label>
          <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3}
            className="w-full border border-[color:var(--color-input)] bg-white px-4 py-3 text-[0.78rem] outline-none focus:border-[color:var(--color-mocha)]" />
        </div>
        <div>
          <label className="mb-2 block text-[0.6rem] uppercase tracking-[0.2em] text-[color:var(--color-mocha)]">What's inside (one item per line)</label>
          <textarea value={form.contents} onChange={(e) => setForm({ ...form, contents: e.target.value })} rows={4}
            placeholder="1 silk scarf&#10;1 perfume miniature&#10;1 handwritten card"
            className="w-full border border-[color:var(--color-input)] bg-white px-4 py-3 text-[0.78rem] outline-none focus:border-[color:var(--color-mocha)]" />
        </div>
        <button disabled={busy} className="btn-dark w-full">{busy ? "Publishing…" : "Publish gift package"}</button>
      </form>

      <Table head={["Cover","Name","Occasion","Items","Price","Status",""]}
        rows={packages.map((g) => [
          g.image_url ? <img key="img" src={g.image_url} alt="" className="h-14 w-14 object-cover" /> : <div key="img" className="h-14 w-14 bg-[color:var(--color-linen)]" />,
          g.name,
          g.occasion.replace("_", " "),
          g.item_count,
          fmtKES(g.price_kes),
          g.active ? "Active" : "Paused",
          <span key="a" className="flex gap-3">
            <button onClick={() => toggleActive(g.id, g.active)} className="text-[0.6rem] uppercase tracking-[0.15em] text-[color:var(--color-mocha)]">{g.active ? "Pause" : "Resume"}</button>
            <button onClick={() => remove(g.id)} className="text-[0.6rem] uppercase tracking-[0.15em] text-[color:var(--color-err)]">Delete</button>
          </span>,
        ])} />
    </>
  );
}
