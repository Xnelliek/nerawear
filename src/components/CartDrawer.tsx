import { AnimatePresence, motion } from "framer-motion";
import { X, Minus, Plus, Trash2 } from "lucide-react";
import { useCart, fmtKES } from "@/store/cart";
import { gradientFor } from "@/lib/gradients";
import { useNavigate } from "@tanstack/react-router";

export function CartDrawer() {
  const { isOpen, close, items, setQty, remove, subtotal } = useCart();
  const navigate = useNavigate();

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={close}
            className="fixed inset-0 z-40 bg-[rgba(17,17,17,0.5)]"
          />
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "tween", ease: [0.4, 0, 0.2, 1], duration: 0.35 }}
            className="fixed right-0 top-0 z-50 flex h-full w-full max-w-[420px] flex-col bg-[color:var(--color-mist)] shadow-2xl"
          >
            <header className="flex items-center justify-between border-b border-[color:var(--color-border)] px-8 py-6">
              <h3 className="serif text-2xl font-normal">Your Bag</h3>
              <button onClick={close} aria-label="Close cart">
                <X className="h-5 w-5" />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto px-8 py-6">
              {items.length === 0 ? (
                <div className="py-16 text-center text-[0.75rem] uppercase tracking-[0.15em] text-neutral-500">
                  Your bag is empty
                </div>
              ) : (
                <ul className="divide-y divide-[color:var(--color-border)]">
                  {items.map((i) => (
                    <li key={`${i.productId}-${i.size}`} className="grid grid-cols-[80px_1fr_auto] items-start gap-4 py-5">
                      <div
                        className="h-[100px] w-[80px] bg-[color:var(--color-linen)] bg-cover bg-center"
                        style={{ backgroundImage: i.image ? `url(${i.image})` : gradientFor(i.productId) }}
                      />
                      <div>
                        <div className="serif text-base">{i.name}</div>
                        <div className="mb-2 text-[0.6rem] uppercase tracking-[0.15em] text-neutral-500">
                          Size {i.size}
                        </div>
                        <div className="text-[0.72rem] tracking-wide text-[color:var(--color-mocha)]">
                          {fmtKES(i.price)}
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                          <button
                            onClick={() => setQty(i.productId, i.size, i.qty - 1)}
                            className="flex h-6 w-6 items-center justify-center border border-black/20"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="min-w-5 text-center text-[0.75rem]">{i.qty}</span>
                          <button
                            onClick={() => setQty(i.productId, i.size, i.qty + 1)}
                            className="flex h-6 w-6 items-center justify-center border border-black/20"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                      <button
                        onClick={() => remove(i.productId, i.size)}
                        className="text-neutral-400 hover:text-[color:var(--color-err)]"
                        aria-label="Remove"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <footer className="border-t border-[color:var(--color-border)] px-8 py-6">
              <div className="mb-5 flex items-center justify-between">
                <span className="text-[0.7rem] uppercase tracking-[0.12em]">Subtotal</span>
                <strong className="serif text-xl font-normal">{fmtKES(subtotal())}</strong>
              </div>
              <button
                disabled={items.length === 0}
                onClick={() => {
                  close();
                  navigate({ to: "/checkout" });
                }}
                className="w-full bg-[color:var(--color-ink)] py-4 text-[0.68rem] uppercase tracking-[0.22em] text-[color:var(--color-mist)] transition-colors hover:bg-[color:var(--color-mahogany)] disabled:opacity-40"
              >
                Proceed to Checkout
              </button>
              <p className="mt-3 text-center text-[0.6rem] tracking-wide text-neutral-500">
                Free delivery within Nairobi over KSh 10,000
              </p>
            </footer>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
