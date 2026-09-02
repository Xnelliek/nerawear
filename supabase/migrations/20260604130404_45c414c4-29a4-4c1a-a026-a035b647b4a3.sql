DROP POLICY IF EXISTS "anyone subscribe" ON public.newsletter_subscribers;
CREATE POLICY "public can subscribe with email"
ON public.newsletter_subscribers
FOR INSERT
TO anon, authenticated
WITH CHECK (email IS NOT NULL AND length(trim(email)) BETWEEN 3 AND 255 AND position('@' in email) > 1);

REVOKE EXECUTE ON FUNCTION public.validate_coupon(text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.validate_coupon(text, integer) TO authenticated, service_role;