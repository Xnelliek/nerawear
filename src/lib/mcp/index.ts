import { auth, defineMcp } from "@lovable.dev/mcp-js";
import searchProducts from "./tools/search-products";
import getProduct from "./tools/get-product";
import listMyOrders from "./tools/list-my-orders";
import getMyOrder from "./tools/get-my-order";
import manageMyWishlist from "./tools/manage-my-wishlist";

// The OAuth issuer must be the direct Supabase host; the project ref is the only
// value that survives publish unchanged and is inlined by Vite at build time.
const projectRef = import.meta.env['VITE_SUPABASE_PROJECT_ID'] ?? "project-ref-unset";

export default defineMcp({
  name: "nera-chic-suite",
  title: "Néra Chic Suite",
  version: "0.1.0",
  instructions:
    "Tools for the Néra Wear online store (Kenya). Use `search_products` and `get_product` to browse the catalogue, `list_my_orders` / `get_my_order` for the signed-in customer's own orders, and `manage_my_wishlist` to view or change their saved items. Prices are in Kenyan Shillings (KES).",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [searchProducts, getProduct, listMyOrders, getMyOrder, manageMyWishlist],
});
