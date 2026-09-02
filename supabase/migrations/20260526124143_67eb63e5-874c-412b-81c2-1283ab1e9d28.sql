
-- Fix 1: Privilege escalation on user_roles — add RESTRICTIVE policy so only admins can insert/update/delete roles
CREATE POLICY "only admins insert roles" ON public.user_roles
  AS RESTRICTIVE FOR INSERT TO authenticated, anon
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "only admins update roles" ON public.user_roles
  AS RESTRICTIVE FOR UPDATE TO authenticated, anon
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "only admins delete roles" ON public.user_roles
  AS RESTRICTIVE FOR DELETE TO authenticated, anon
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Fix 2: orders INSERT — require user_id to be NULL (guest) or match auth.uid()
DROP POLICY IF EXISTS "anyone can create order" ON public.orders;
CREATE POLICY "create order own or guest" ON public.orders
  FOR INSERT TO authenticated, anon
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());

-- Fix 3: order_items INSERT — require referenced order belongs to caller (or guest order)
DROP POLICY IF EXISTS "anyone insert order items" ON public.order_items;
CREATE POLICY "insert order items for own order" ON public.order_items
  FOR INSERT TO authenticated, anon
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id
        AND (o.user_id IS NULL OR o.user_id = auth.uid())
    )
  );

-- Fix 4: Restrict EXECUTE on SECURITY DEFINER has_role to internal use only.
-- RLS policy evaluation does not require EXECUTE grants on the caller's role.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
