import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseAnon } from "../supabase";

export default defineTool({
  name: "get_product",
  title: "Get product details",
  description:
    "Get full details for one Néra Wear product by its slug, including description, gallery images, sizes and public review summary.",
  inputSchema: { slug: z.string().trim().min(1).describe("Product slug from search_products.") },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ slug }) => {
    const supabase = supabaseAnon();
    const { data: product, error } = await supabase
      .from("products")
      .select("id,name,slug,description,price_kes,sizes,gallery,image_url,tag,sold,featured,category_id")
      .eq("slug", slug)
      .maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!product) {
      return { content: [{ type: "text", text: `No product with slug "${slug}".` }], isError: true };
    }

    const { data: reviews } = await supabase
      .from("reviews_public")
      .select("rating,comment,created_at")
      .eq("product_id", product.id)
      .order("created_at", { ascending: false })
      .limit(10);

    const list = reviews ?? [];
    const summary = {
      review_count: list.length,
      average_rating:
        list.length > 0
          ? Math.round((list.reduce((sum, r) => sum + (r.rating ?? 0), 0) / list.length) * 10) / 10
          : null,
      recent_reviews: list,
    };

    const payload = { product, reviews: summary };
    return {
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload,
    };
  },
});
