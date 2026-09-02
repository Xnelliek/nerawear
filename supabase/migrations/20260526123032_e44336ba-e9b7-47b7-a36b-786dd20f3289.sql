-- Roles enum + table
create type public.app_role as enum ('admin', 'customer');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role app_role not null default 'customer',
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create policy "users read own roles" on public.user_roles for select to authenticated using (auth.uid() = user_id);
create policy "admins read all roles" on public.user_roles for select to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy "admins manage roles" on public.user_roles for all to authenticated using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

-- Profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "read own profile" on public.profiles for select to authenticated using (auth.uid() = id);
create policy "update own profile" on public.profiles for update to authenticated using (auth.uid() = id);
create policy "insert own profile" on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "admins read profiles" on public.profiles for select to authenticated using (public.has_role(auth.uid(), 'admin'));

-- Auto-create profile + default customer role on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name) values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''));
  insert into public.user_roles (user_id, role) values (new.id, 'customer');
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- Categories
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  description text,
  image_url text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.categories enable row level security;
create policy "public read categories" on public.categories for select using (true);
create policy "admins write categories" on public.categories for all to authenticated using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

-- Products
create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  price_kes integer not null check (price_kes >= 0),
  category_id uuid references public.categories(id) on delete set null,
  sizes text[] not null default '{}',
  tag text,
  image_url text,
  gallery text[] not null default '{}',
  sold boolean not null default false,
  featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.products (category_id);
create index on public.products (created_at desc);
alter table public.products enable row level security;
create policy "public read products" on public.products for select using (true);
create policy "admins write products" on public.products for all to authenticated using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

-- Orders
create type public.order_status as enum ('pending', 'paid', 'shipped', 'delivered', 'cancelled');
create type public.payment_method as enum ('mpesa', 'card', 'cod');

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  order_number text not null unique default ('NW-' || to_char(now(), 'YYMMDD') || '-' || substr(replace(gen_random_uuid()::text,'-',''),1,6)),
  first_name text not null,
  last_name text not null,
  phone text not null,
  email text,
  county text not null,
  address text not null,
  subtotal_kes integer not null,
  delivery_fee_kes integer not null default 0,
  total_kes integer not null,
  payment_method payment_method not null default 'mpesa',
  payment_ref text,
  status order_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.orders (user_id);
create index on public.orders (created_at desc);
alter table public.orders enable row level security;
create policy "anyone can create order" on public.orders for insert with check (true);
create policy "users read own orders" on public.orders for select to authenticated using (auth.uid() = user_id);
create policy "admins read all orders" on public.orders for select to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy "admins update orders" on public.orders for update to authenticated using (public.has_role(auth.uid(), 'admin'));

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  size text,
  unit_price_kes integer not null,
  quantity integer not null check (quantity > 0),
  image_url text
);
create index on public.order_items (order_id);
alter table public.order_items enable row level security;
create policy "anyone insert order items" on public.order_items for insert with check (true);
create policy "users read own order items" on public.order_items for select to authenticated using (
  exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid())
);
create policy "admins read all order items" on public.order_items for select to authenticated using (public.has_role(auth.uid(), 'admin'));

-- Newsletter
create table public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  created_at timestamptz not null default now()
);
alter table public.newsletter_subscribers enable row level security;
create policy "anyone subscribe" on public.newsletter_subscribers for insert with check (true);
create policy "admins read subscribers" on public.newsletter_subscribers for select to authenticated using (public.has_role(auth.uid(), 'admin'));

-- updated_at trigger helper
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;
create trigger products_touch before update on public.products for each row execute function public.touch_updated_at();
create trigger orders_touch before update on public.orders for each row execute function public.touch_updated_at();
create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();

-- Seed categories
insert into public.categories (name, slug, description, sort_order) values
  ('Dresses', 'dresses', 'Silhouettes that move with you', 1),
  ('Tops', 'tops', 'Effortless layering essentials', 2),
  ('Bottoms', 'bottoms', 'Tailored, drapey, and easy', 3),
  ('Sets', 'sets', 'Coordinated co-ords for the modern woman', 4);

-- Seed products
insert into public.products (name, slug, description, price_kes, category_id, sizes, tag, featured) values
  ('Silhouette Midi Dress', 'silhouette-midi-dress', 'A beautifully draped midi in premium crepe. Flattering A-line silhouette with a subtle side split. Made for evenings out and quiet luxury moments.', 8500, (select id from public.categories where slug='dresses'), array['XS','S','M','L'], 'New In', true),
  ('Linen Wrap Blouse', 'linen-wrap-blouse', 'Our bestselling wrap in breathable linen. Cinches at the waist with a self-tie belt. Pair with trousers or a midi skirt.', 4200, (select id from public.categories where slug='tops'), array['S','M','L','XL'], 'Bestseller', true),
  ('Tailored Wide Trousers', 'tailored-wide-trousers', 'High-waisted wide-leg trousers in structured twill. Pressed crease detail. A staple that lifts everything you own.', 6800, (select id from public.categories where slug='bottoms'), array['XS','S','M','L','XL'], null, true),
  ('Draped Shoulder Top', 'draped-shoulder-top', 'Statement draped shoulder in satin-touch fabric. Tuck into trousers or layer under a tailored blazer.', 3900, (select id from public.categories where slug='tops'), array['S','M','L'], 'New In', false),
  ('Pleated Midi Skirt', 'pleated-midi-skirt', 'Flowy pleated midi with an elasticated waist. Lightweight fabric that moves beautifully.', 5500, (select id from public.categories where slug='bottoms'), array['XS','S','M','L'], 'New In', true),
  ('Co-ord Set — Sand', 'co-ord-set-sand', 'Matching wide-leg trouser and cropped blazer in sand linen. A complete look that needs nothing else.', 12000, (select id from public.categories where slug='sets'), array['S','M','L'], 'Limited', true),
  ('Slip Satin Dress', 'slip-satin-dress', 'Bias-cut slip in heavyweight satin. Adjustable straps, low back, fluid drape.', 7200, (select id from public.categories where slug='dresses'), array['XS','S','M','L'], null, false),
  ('Cropped Knit Cardigan', 'cropped-knit-cardigan', 'Fine-gauge cropped cardigan in merino blend. Mother-of-pearl buttons.', 4900, (select id from public.categories where slug='tops'), array['S','M','L'], 'New In', false);