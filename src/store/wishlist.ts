import { create } from "zustand";
import { supabase } from "@/lib/api-client";

type WishlistState = {
  ids: Set<string>;
  loaded: boolean;
  load: (userId?: string) => Promise<void>;
  toggle: (productId: string, userId?: string) => Promise<boolean>;
  has: (productId: string) => boolean;
};

export const useWishlist = create<WishlistState>((set, get) => ({
  ids: new Set(),
  loaded: false,
  has: (id) => get().ids.has(id),
  load: async (userId) => {
    if (!userId) {
      const { data: u } = await supabase.auth.getSession();
      userId = u.session?.user.id;
    }
    if (!userId) {
      set({ ids: new Set(), loaded: true });
      return;
    }
    const { data } = await supabase.from("wishlists").select("product_id").eq("user_id", userId);
    set({ ids: new Set((data ?? []).map((r) => r.product_id)), loaded: true });
  },
  toggle: async (productId, userId) => {
    if (!userId) {
      const { data: u } = await supabase.auth.getSession();
      userId = u.session?.user.id;
    }
    if (!userId) return false;
    const ids = new Set(get().ids);
    if (ids.has(productId)) {
      await supabase.from("wishlists").delete().eq("user_id", userId).eq("product_id", productId);
      ids.delete(productId);
      set({ ids });
      return false;
    }
    await supabase.from("wishlists").insert({ user_id: userId, product_id: productId });
    ids.add(productId);
    set({ ids });
    return true;
  },
}));
