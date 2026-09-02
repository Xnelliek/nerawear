REVOKE ALL ON public.orders FROM anon;
REVOKE ALL ON public.order_items FROM anon;

REVOKE UPDATE ON public.orders FROM authenticated;
GRANT SELECT, INSERT ON public.orders TO authenticated;
GRANT UPDATE (payment_ref, status) ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;

REVOKE ALL ON public.order_items FROM authenticated;
GRANT SELECT, INSERT ON public.order_items TO authenticated;
GRANT ALL ON public.order_items TO service_role;

DROP POLICY IF EXISTS "create order own or guest" ON public.orders;
CREATE POLICY "authenticated users create own orders"
ON public.orders
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "users submit payment ref on own pending orders" ON public.orders;
CREATE POLICY "users submit payment ref on own pending orders"
ON public.orders
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id AND status = 'pending'::order_status)
WITH CHECK (auth.uid() = user_id AND status = 'pending'::order_status);

DROP POLICY IF EXISTS "insert order items for own order" ON public.order_items;
CREATE POLICY "insert order items for own order"
ON public.order_items
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.orders o
    WHERE o.id = order_items.order_id
      AND o.user_id = auth.uid()
  )
);

DROP TRIGGER IF EXISTS enforce_order_user_update_columns ON public.orders;
DROP FUNCTION IF EXISTS public.enforce_order_user_update_columns();

CREATE OR REPLACE FUNCTION public.orders_restrict_customer_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.order_number IS DISTINCT FROM OLD.order_number
     OR NEW.first_name IS DISTINCT FROM OLD.first_name
     OR NEW.last_name IS DISTINCT FROM OLD.last_name
     OR NEW.phone IS DISTINCT FROM OLD.phone
     OR NEW.email IS DISTINCT FROM OLD.email
     OR NEW.county IS DISTINCT FROM OLD.county
     OR NEW.address IS DISTINCT FROM OLD.address
     OR NEW.subtotal_kes IS DISTINCT FROM OLD.subtotal_kes
     OR NEW.delivery_fee_kes IS DISTINCT FROM OLD.delivery_fee_kes
     OR NEW.discount_kes IS DISTINCT FROM OLD.discount_kes
     OR NEW.total_kes IS DISTINCT FROM OLD.total_kes
     OR NEW.payment_method IS DISTINCT FROM OLD.payment_method
     OR NEW.status IS DISTINCT FROM OLD.status
     OR NEW.coupon_code IS DISTINCT FROM OLD.coupon_code
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Customers may only update the M-Pesa payment reference';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.orders_restrict_customer_columns() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS orders_restrict_customer_columns_trg ON public.orders;
CREATE TRIGGER orders_restrict_customer_columns_trg
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.orders_restrict_customer_columns();