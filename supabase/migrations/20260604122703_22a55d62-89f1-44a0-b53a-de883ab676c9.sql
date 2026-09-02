CREATE OR REPLACE FUNCTION public.orders_restrict_customer_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Admins and service_role bypass this check
  IF auth.uid() IS NULL OR public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;
  -- Customers may only change payment_ref on their own pending orders
  IF NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.status IS DISTINCT FROM OLD.status
     OR NEW.total_kes IS DISTINCT FROM OLD.total_kes
     OR NEW.subtotal_kes IS DISTINCT FROM OLD.subtotal_kes
     OR NEW.delivery_fee_kes IS DISTINCT FROM OLD.delivery_fee_kes
     OR NEW.discount_kes IS DISTINCT FROM OLD.discount_kes
     OR NEW.coupon_code IS DISTINCT FROM OLD.coupon_code
     OR NEW.first_name IS DISTINCT FROM OLD.first_name
     OR NEW.last_name IS DISTINCT FROM OLD.last_name
     OR NEW.phone IS DISTINCT FROM OLD.phone
     OR NEW.email IS DISTINCT FROM OLD.email
     OR NEW.address IS DISTINCT FROM OLD.address
     OR NEW.county IS DISTINCT FROM OLD.county
     OR NEW.payment_method IS DISTINCT FROM OLD.payment_method
  THEN
    RAISE EXCEPTION 'Customers may only update the M-Pesa payment reference';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_restrict_customer_columns_trg ON public.orders;
CREATE TRIGGER orders_restrict_customer_columns_trg
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.orders_restrict_customer_columns();