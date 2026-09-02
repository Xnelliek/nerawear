import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseAnon } from "../supabase";

export default defineTool({
  name: "search_products",
  title: "Search products",
  description:
    "Search the Néra Wear catalogue. Filter by free-text name, category name, or featured items. Returns name, slug, price in KES, sizes, tag and availability.",
  inputSchema: {
    query: z.string().trim().optional().describe("Free-text match against the product name."),
    category: z.string().trim().optional().describe("Category name, e.g. Dresses, Tops, Warm Wear."),
    featured_only: z.boolean().optional().describe("Only return featured products."),
    limit: z.number().int().optional().describe("Max products to return (default 20, max 50)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ query, category, featured_only, limit }) => {
    const supabase = supabaseAnon();
    const take = Math.min(Math.max(limit ?? 20, 1), 50);

    let categoryId: string | undefined;
    if (category) {
      const { data: cat } = await supabase
        .from("categories")
        .select("id")
        .ilike("name", category)
        .maybeSingle();
      if (!cat) {
        return { content: [{ type: "text", text: `No category named "${category}".` }], isError: true };
      }
      categoryId = cat.id;
    }

    let q = supabase
      .from("products")
      .select("id,name,slug,price_kes,sizes,tag,sold,featured,image_url,category_id")
      .order("created_at", { ascending: false })
      .limit(take);
    if (query) q = q.ilike("name", `%${query}%`);
    if (categoryId) q = q.eq("category_id", categoryId);
    if (featured_only) q = q.eq("featured", true);

    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { products: data ?? [] },
    };
  },
});
