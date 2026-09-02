-- Hide reviews.user_id from public via a view; restrict base table SELECT
DROP POLICY IF EXISTS "public read reviews" ON public.reviews;

CREATE POLICY "users read own reviews"
  ON public.reviews FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE OR REPLACE VIEW public.reviews_public
WITH (security_invoker = on) AS
SELECT id, product_id, rating, title, body, verified_buyer, created_at
FROM public.reviews;

GRANT SELECT ON public.reviews_public TO anon, authenticated;
