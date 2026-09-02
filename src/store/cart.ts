import { create } from "zustand";
import { persist } from "zustand/middleware";

export type CartItem = {
  productId: string;
  name: string;
  size: string;
  price: number; // KES
  qty: number;
  image?: string | null;
};

type CartState = {
  items: CartItem[];
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  add: (item: CartItem) => void;
  remove: (productId: string, size: string) => void;
  setQty: (productId: string, size: string, qty: number) => void;
  clear: () => void;
  subtotal: () => number;
  count: () => number;
};

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      isOpen: false,
      open: () => set({ isOpen: true }),
      close: () => set({ isOpen: false }),
      toggle: () => set((s) => ({ isOpen: !s.isOpen })),
      add: (item) =>
        set((s) => {
          const existing = s.items.find(
            (i) => i.productId === item.productId && i.size === item.size,
          );
          if (existing) {
            return {
              items: s.items.map((i) =>
                i === existing ? { ...i, qty: i.qty + item.qty } : i,
              ),
              isOpen: true,
            };
          }
          return { items: [...s.items, item], isOpen: true };
        }),
      remove: (productId, size) =>
        set((s) => ({
          items: s.items.filter(
            (i) => !(i.productId === productId && i.size === size),
          ),
        })),
      setQty: (productId, size, qty) =>
        set((s) => ({
          items: s.items
            .map((i) =>
              i.productId === productId && i.size === size
                ? { ...i, qty: Math.max(0, qty) }
                : i,
            )
            .filter((i) => i.qty > 0),
        })),
      clear: () => set({ items: [] }),
      subtotal: () =>
        get().items.reduce((sum, i) => sum + i.price * i.qty, 0),
      count: () => get().items.reduce((sum, i) => sum + i.qty, 0),
    }),
    { name: "nera-cart" },
  ),
);

export const fmtKES = (n: number) =>
  "KSh " + new Intl.NumberFormat("en-KE").format(Math.round(n));
