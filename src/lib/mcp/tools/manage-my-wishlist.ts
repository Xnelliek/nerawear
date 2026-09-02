import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "manage_my_wishlist",
  title: "Manage my wishlist",
  description:
    "List the signed-in customer's wishlist, or add / remove a product by slug. Use action 'list', 'add' or 'remove'.",
  inputSchema: {
    action: z.enum(["list", "add", "remove"]).describe("What to do with the wishlist."),
    slug: z.string().trim().optional().describe("Product slug — required for 'add' and 'remove'."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ action, slug }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated." }], isError: true };
    }
    const supabase = supabaseForUser(ctx);

    if (action === "list") {
      const { data, error } = await supabase
        .from("wishlists")
        .select("product_id,created_at,products(name,slug,price_kes,image_url)")
        .order("created_at", { ascending: false });
      if (error) return { content: [{ type: "text", text: error.message }], isError: true };
      return {
        content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
        structuredContent: { wishlist: data ?? [] },
      };
    }

    if (!slug) {
      return { content: [{ type: "text", text: "slug is required for add/remove." }], isError: true };
    }
    const { data: product } = await supabase
      .from("products")
      .select("id,name")
      .eq("slug", slug)
      .maybeSingle();
    if (!product) {
      return { content: [{ type: "text", text: `No product with slug "${slug}".` }], isError: true };
    }

    if (action === "add") {
      const { error } = await supabase
        .from("wishlists")
        .insert({ user_id: ctx.getUserId()!, product_id: product.id });
      if (error && !/duplicate|unique/i.test(error.message)) {
        return { content: [{ type: "text", text: error.message }], isError: true };
      }
      return { content: [{ type: "text", text: `Saved ${product.name} to your wishlist.` }] };
    }

    const { error } = await supabase.from("wishlists").delete().eq("product_id", product.id);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return { content: [{ type: "text", text: `Removed ${product.name} from your wishlist.` }] };
  },
});
