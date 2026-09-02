
REVOKE EXECUTE ON FUNCTION public.enforce_order_item_price() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recompute_order_totals() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.increment_coupon_uses() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_verified_buyer() FROM PUBLIC, anon, authenticated;
