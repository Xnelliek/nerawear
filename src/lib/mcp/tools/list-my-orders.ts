import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_my_orders",
  title: "List my orders",
  description:
    "List the signed-in customer's own Néra Wear orders with status, totals in KES and delivery details. Newest first.",
  inputSchema: {
    status: z
      .enum(["pending", "paid", "shipped", "delivered", "cancelled"])
      .optional()
      .describe("Only return orders with this status."),
    limit: z.number().int().optional().describe("Max orders to return (default 10, max 50)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ status, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated." }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const take = Math.min(Math.max(limit ?? 10, 1), 50);

    let q = supabase
      .from("orders")
      .select(
        "id,order_number,status,total_kes,subtotal_kes,delivery_fee_kes,discount_kes,county,address,payment_method,payment_ref,created_at",
      )
      .order("created_at", { ascending: false })
      .limit(take);
    if (status) q = q.eq("status", status);

    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { orders: data ?? [] },
    };
  },
});
