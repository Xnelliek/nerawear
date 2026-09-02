
-- 1) Force order_items unit prices to come from products table
CREATE OR REPLACE FUNCTION public.enforce_order_item_price()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE p public.products%ROWTYPE;
BEGIN
  SELECT * INTO p FROM public.products WHERE id = NEW.product_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product % not found', NEW.product_id;
  END IF;
  NEW.unit_price_kes := p.price_kes;
  NEW.product_name := p.name;
  IF NEW.image_url IS NULL THEN
    NEW.image_url := p.image_url;
  END IF;
  IF NEW.quantity IS NULL OR NEW.quantity < 1 THEN
    RAISE EXCEPTION 'Quantity must be at least 1';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS order_items_enforce_price ON public.order_items;
CREATE TRIGGER order_items_enforce_price
BEFORE INSERT ON public.order_items
FOR EACH ROW EXECUTE FUNCTION public.enforce_order_item_price();

-- 2) Recompute order totals server-side from real items + real coupon
CREATE OR REPLACE FUNCTION public.recompute_order_totals()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  o public.orders%ROWTYPE;
  v_subtotal integer;
  v_delivery integer;
  v_discount integer := 0;
  c public.coupons%ROWTYPE;
  oid uuid;
BEGIN
  oid := COALESCE(NEW.order_id, OLD.order_id);
  SELECT * INTO o FROM public.orders WHERE id = oid;
  IF NOT FOUND THEN RETURN NEW; END IF;

  SELECT COALESCE(SUM(unit_price_kes * quantity), 0)::int INTO v_subtotal
  FROM public.order_items WHERE order_id = oid;

  IF v_subtotal >= 10000 AND o.county = 'Nairobi' THEN
    v_delivery := 0;
  ELSIF o.county = 'Nairobi' THEN
    v_delivery := 300;
  ELSE
    v_delivery := 600;
  END IF;

  IF o.coupon_code IS NOT NULL THEN
    SELECT * INTO c FROM public.coupons WHERE code = upper(o.coupon_code) AND active = true;
    IF FOUND
       AND (c.expires_at IS NULL OR c.expires_at >= now())
       AND (c.max_uses IS NULL OR c.uses <= c.max_uses)
       AND v_subtotal >= c.min_subtotal_kes THEN
      v_discount := CASE WHEN c.discount_type = 'percent'
                         THEN (v_subtotal * c.value / 100)
                         ELSE LEAST(c.value, v_subtotal) END;
    END IF;
  END IF;

  UPDATE public.orders
  SET subtotal_kes = v_subtotal,
      delivery_fee_kes = v_delivery,
      discount_kes = v_discount,
      total_kes = GREATEST(0, v_subtotal + v_delivery - v_discount)
  WHERE id = oid;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS order_items_recompute_totals ON public.order_items;
CREATE TRIGGER order_items_recompute_totals
AFTER INSERT OR UPDATE OR DELETE ON public.order_items
FOR EACH ROW EXECUTE FUNCTION public.recompute_order_totals();

-- 3) Increment coupon uses when an order is created with a code
CREATE OR REPLACE FUNCTION public.increment_coupon_uses()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE c public.coupons%ROWTYPE;
BEGIN
  IF NEW.coupon_code IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO c FROM public.coupons WHERE code = upper(NEW.coupon_code) AND active = true FOR UPDATE;
  IF NOT FOUND THEN
    NEW.coupon_code := NULL;
    RETURN NEW;
  END IF;
  IF c.max_uses IS NOT NULL AND c.uses >= c.max_uses THEN
    RAISE EXCEPTION 'Coupon % is no longer available', c.code;
  END IF;
  UPDATE public.coupons SET uses = uses + 1 WHERE id = c.id;
  NEW.coupon_code := c.code;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS orders_increment_coupon ON public.orders;
CREATE TRIGGER orders_increment_coupon
BEFORE INSERT ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.increment_coupon_uses();

-- 4) Force verified_buyer to be computed from real orders
CREATE OR REPLACE FUNCTION public.set_verified_buyer()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  NEW.verified_buyer := EXISTS (
    SELECT 1
    FROM public.order_items oi
    JOIN public.orders o ON o.id = oi.order_id
    WHERE oi.product_id = NEW.product_id
      AND o.user_id = NEW.user_id
      AND o.status IN ('paid','shipped','delivered')
  );
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS reviews_set_verified_buyer ON public.reviews;
CREATE TRIGGER reviews_set_verified_buyer
BEFORE INSERT OR UPDATE ON public.reviews
FOR EACH ROW EXECUTE FUNCTION public.set_verified_buyer();
