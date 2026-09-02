import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "get_my_order",
  title: "Get one of my orders",
  description:
    "Get one of the signed-in customer's own orders by order number, including every line item (product, size, quantity, unit price in KES).",
  inputSchema: {
    order_number: z.string().trim().min(1).describe("Order number, e.g. from list_my_orders."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ order_number }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated." }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const { data: order, error } = await supabase
      .from("orders")
      .select(
        "id,order_number,status,total_kes,subtotal_kes,delivery_fee_kes,discount_kes,coupon_code,county,address,phone,payment_method,payment_ref,created_at",
      )
      .eq("order_number", order_number)
      .maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!order) {
      return {
        content: [{ type: "text", text: `No order ${order_number} found on your account.` }],
        isError: true,
      };
    }

    const { data: items } = await supabase
      .from("order_items")
      .select("product_name,size,quantity,unit_price_kes,image_url")
      .eq("order_id", order.id);

    const payload = { order, items: items ?? [] };
    return {
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload,
    };
  },
});
