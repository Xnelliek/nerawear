
-- Gift packages: curated bundles (1-10 items) for special occasions
CREATE TYPE public.gift_occasion AS ENUM ('birthday','anniversary','valentines','mothers_day','womens_day','graduation','baby_shower','just_because','other');

CREATE TABLE public.gift_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  occasion public.gift_occasion NOT NULL DEFAULT 'just_because',
  price_kes integer NOT NULL,
  item_count integer NOT NULL DEFAULT 1 CHECK (item_count BETWEEN 1 AND 10),
  image_url text,
  gallery text[] NOT NULL DEFAULT '{}',
  contents text[] NOT NULL DEFAULT '{}',
  active boolean NOT NULL DEFAULT true,
  featured boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.gift_packages TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.gift_packages TO authenticated;
GRANT ALL ON public.gift_packages TO service_role;

ALTER TABLE public.gift_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read active gift packages"
ON public.gift_packages FOR SELECT TO public
USING (active = true OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins manage gift packages"
ON public.gift_packages FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER touch_gift_packages_updated_at
BEFORE UPDATE ON public.gift_packages
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
