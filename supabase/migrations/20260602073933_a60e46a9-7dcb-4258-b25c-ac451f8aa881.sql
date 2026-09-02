-- Fix 1: Tighten guest order_items insert — require order ownership match auth.uid().
-- After the recent checkout flow change, customers must create an account before paying,
-- so anonymous (guest) order_items inserts are no longer needed.
DROP POLICY IF EXISTS "insert order items for own order" ON public.order_items;

CREATE POLICY "insert order items for own order"
ON public.order_items
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_items.order_id
      AND o.user_id IS NOT NULL
      AND o.user_id = auth.uid()
  )
);

-- Fix 2: Restrict which columns non-admin users can update on their pending orders.
-- Only payment_ref is allowed; everything else (total_kes, discount_kes, coupon_code,
-- delivery_fee_kes, status, address, etc.) must remain immutable for the customer.
CREATE OR REPLACE FUNCTION public.enforce_order_user_update_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Admins can update anything.
  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  -- Non-admins: only payment_ref and updated_at may change.
  IF NEW.id              IS DISTINCT FROM OLD.id              OR
     NEW.user_id         IS DISTINCT FROM OLD.user_id         OR
     NEW.order_number    IS DISTINCT FROM OLD.order_number    OR
     NEW.first_name      IS DISTINCT FROM OLD.first_name      OR
     NEW.last_name       IS DISTINCT FROM OLD.last_name       OR
     NEW.phone           IS DISTINCT FROM OLD.phone           OR
     NEW.email           IS DISTINCT FROM OLD.email           OR
     NEW.county          IS DISTINCT FROM OLD.county          OR
     NEW.address         IS DISTINCT FROM OLD.address         OR
     NEW.subtotal_kes    IS DISTINCT FROM OLD.subtotal_kes    OR
     NEW.delivery_fee_kes IS DISTINCT FROM OLD.delivery_fee_kes OR
     NEW.discount_kes    IS DISTINCT FROM OLD.discount_kes    OR
     NEW.total_kes       IS DISTINCT FROM OLD.total_kes       OR
     NEW.payment_method  IS DISTINCT FROM OLD.payment_method  OR
     NEW.status          IS DISTINCT FROM OLD.status          OR
     NEW.coupon_code     IS DISTINCT FROM OLD.coupon_code     OR
     NEW.created_at      IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Only payment_ref may be updated on your order';
  END IF;

  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS enforce_order_user_update_columns ON public.orders;
CREATE TRIGGER enforce_order_user_update_columns
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.enforce_order_user_update_columns();
