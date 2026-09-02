import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Heart, Search, ShoppingBag, User, Shield, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useCart } from "@/store/cart";
import { supabase } from "@/lib/api-client";

const links = [
  { to: "/", label: "Home" },
  { to: "/shop", label: "Shop" },
  { to: "/shop?cat=dresses", label: "Dresses" },
  { to: "/shop?cat=tops", label: "Tops" },
  { to: "/shop?cat=sets", label: "Sets" },
  { to: "/gifts", label: "Gifts" },
];

export function Nav() {
  const count = useCart((s) => s.count());
  const openCart = useCart((s) => s.open);
  const path = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [q, setQ] = useState("");

useEffect(() => {
    let active = true;
    const check = async (uid?: string) => {
      if (!uid) { if (active) setIsAdmin(false); return; }
      const { data } = await supabase.auth.getUser();
      if (active) setIsAdmin(!!(data.user as { is_store_admin?: boolean } | null)?.is_store_admin);
    };
    supabase.auth.getUser().then(({ data }) => check(data.user?.id));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => check(session?.user?.id));
    return () => { active = false; sub.subscription.unsubscribe(); };
  }, []);


  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    const term = q.trim();
    if (!term) return;
    setSearchOpen(false);
    navigate({ to: "/shop", search: { q: term } as never });
  }

  return (
    <header className="sticky top-0 z-40 border-b border-[color:var(--color-border)] bg-[rgba(246,242,237,0.92)] backdrop-blur-md">
      <div className="flex items-center justify-between px-6 py-4 md:px-12">
        <Link to="/" className="serif text-[1.35rem] font-normal tracking-[0.38em]">
          NÉRA <span className="text-[color:var(--color-mocha)]">WEAR</span>
        </Link>

        <nav className="hidden gap-9 md:flex">
          {links.map((l) => {
            const active = l.to === path || (l.to !== "/" && path.startsWith(l.to.split("?")[0]));
            return (
              <Link
                key={l.to}
                to={l.to}
                className={`text-[0.65rem] uppercase tracking-[0.22em] transition-colors hover:text-[color:var(--color-mocha)] ${active ? "text-[color:var(--color-mocha)]" : ""}`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3">
          {isAdmin && (
            <Link to="/admin" aria-label="Admin" title="Admin dashboard" className="flex items-center gap-1 text-[0.6rem] uppercase tracking-[0.2em] text-[color:var(--color-mocha)] hover:opacity-80">
              <Shield className="h-4 w-4" /> <span className="hidden md:inline">Admin</span>
            </Link>
          )}
          <Link to="/wishlist" aria-label="Wishlist" className="opacity-70 hover:opacity-100">
            <Heart className="h-4 w-4" />
          </Link>
          <Link to="/account" aria-label="Account" className="opacity-70 hover:opacity-100">
            <User className="h-4 w-4" />
          </Link>
          <button aria-label="Search" onClick={() => setSearchOpen((v) => !v)} className="opacity-70 hover:opacity-100">
            <Search className="h-4 w-4" />
          </button>
          <button
            onClick={openCart}
            className="relative bg-[color:var(--color-ink)] px-5 py-2.5 text-[0.65rem] uppercase tracking-[0.18em] text-[color:var(--color-mist)] transition-colors hover:bg-[color:var(--color-mahogany)]"
          >
            <ShoppingBag className="mr-1.5 inline h-3.5 w-3.5" />
            Bag
            {count > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex h-[1.1rem] w-[1.1rem] items-center justify-center rounded-full bg-[color:var(--color-mocha)] text-[0.55rem] text-white">
                {count}
              </span>
            )}
          </button>
        </div>
      </div>

      {searchOpen && (
        <div className="border-t border-[color:var(--color-border)] bg-[color:var(--color-mist)] px-6 py-4 md:px-12">
          <form onSubmit={submitSearch} className="mx-auto flex max-w-2xl items-center gap-3">
            <Search className="h-4 w-4 text-[color:var(--color-mocha)]" />
            <input
              autoFocus
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search dresses, tops, sets…"
              className="flex-1 border-b border-[color:var(--color-border)] bg-transparent py-2 text-[0.85rem] outline-none placeholder:text-neutral-400 focus:border-[color:var(--color-mocha)]"
            />
            <button type="submit" className="bg-[color:var(--color-ink)] px-4 py-2 text-[0.6rem] uppercase tracking-[0.2em] text-[color:var(--color-mist)]">Search</button>
            <button type="button" onClick={() => setSearchOpen(false)} aria-label="Close" className="opacity-60 hover:opacity-100"><X className="h-4 w-4" /></button>
          </form>
        </div>
      )}
    </header>
  );
}
