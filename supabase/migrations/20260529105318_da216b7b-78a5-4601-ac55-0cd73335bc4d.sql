
-- 1. Coupons: stop exposing internal columns (uses, max_uses, expires_at, min_subtotal_kes)
DROP POLICY IF EXISTS "public read active coupons" ON public.coupons;

CREATE OR REPLACE FUNCTION public.validate_coupon(_code text, _subtotal_kes integer)
RETURNS TABLE(code text, discount_type discount_type, value integer, discount_kes integer, message text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE c public.coupons%ROWTYPE;
BEGIN
  SELECT * INTO c FROM public.coupons WHERE coupons.code = upper(_code) AND active = true;
  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::text, NULL::discount_type, NULL::integer, 0, 'Invalid code.'; RETURN;
  END IF;
  IF c.expires_at IS NOT NULL AND c.expires_at < now() THEN
    RETURN QUERY SELECT NULL::text, NULL::discount_type, NULL::integer, 0, 'This code has expired.'; RETURN;
  END IF;
  IF c.max_uses IS NOT NULL AND c.uses >= c.max_uses THEN
    RETURN QUERY SELECT NULL::text, NULL::discount_type, NULL::integer, 0, 'This code has been fully redeemed.'; RETURN;
  END IF;
  IF _subtotal_kes < c.min_subtotal_kes THEN
    RETURN QUERY SELECT NULL::text, NULL::discount_type, NULL::integer, 0,
      'Spend at least KSh ' || c.min_subtotal_kes || ' to use this code.'; RETURN;
  END IF;
  RETURN QUERY SELECT c.code, c.discount_type, c.value,
    CASE WHEN c.discount_type = 'percent' THEN (_subtotal_kes * c.value / 100)
         ELSE LEAST(c.value, _subtotal_kes) END,
    'ok'::text;
END $$;

REVOKE ALL ON FUNCTION public.validate_coupon(text, integer) FROM public;
GRANT EXECUTE ON FUNCTION public.validate_coupon(text, integer) TO anon, authenticated;

-- 2. Order items: prevent appending items to other people's guest orders
DROP POLICY IF EXISTS "insert order items for own order" ON public.order_items;
CREATE POLICY "insert order items for own order"
ON public.order_items FOR INSERT TO anon, authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_items.order_id
      AND (
        (o.user_id IS NOT NULL AND o.user_id = auth.uid())
        OR (o.user_id IS NULL AND o.created_at > now() - interval '10 minutes')
      )
  )
);

-- 3. Storage: stop allowing public listing of product-images bucket.
-- Files remain accessible via public URLs (public bucket bypasses RLS for direct file serves).
DROP POLICY IF EXISTS "public read product images" ON storage.objects;
