# Néra Wear — Django REST backend

```
CUSTOMER → React + TypeScript + Tailwind  →  Django REST Framework
                                              ├── PostgreSQL
                                              ├── Cloudinary / AWS S3 (images)
                                              └── M-Pesa (manual code) · Email · SMS
```

The React app in `src/` now talks to this API through `src/lib/api-client.ts`.
Nothing about the storefront's look or flow changed — only where the data comes from.

## Run locally

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # then fill in the values
python manage.py makemigrations core
python manage.py migrate
python manage.py bootstrap_store --email you@nerawear.com --password 'a-strong-password'
python manage.py import_catalogue   # loads your 5 categories + 11 products (with image URLs)
python manage.py runserver 0.0.0.0:8000
```

Then point the frontend at it by setting `VITE_API_URL=http://localhost:8000/api`
(the client falls back to that exact URL when the variable is missing).

Django's own back office is at `/admin/` for products, orders, gifts and coupons.

## API surface

| Endpoint | Purpose |
|---|---|
| `POST /api/auth/signup/` · `signin/` · `refresh/` · `GET user/` | JWT auth (SimpleJWT) |
| `GET/POST/PATCH/DELETE /api/db/<table>/` | Filtered CRUD with per-table access rules |
| `POST /api/rpc/validate_coupon/` | Server-side coupon validation |
| `GET /api/products/<id>/review-summary/` | Average, total and star breakdown |
| `POST /api/storage/upload/` | Admin-only image upload |
| `GET /api/config/` · `GET /api/health/` | Store settings · uptime probe |

Tables exposed to `/api/db/`: `categories`, `products`, `gift_packages`, `coupons`,
`orders`, `order_items`, `reviews`, `reviews_public`, `wishlists`,
`newsletter_subscribers`, `profiles`, `user_roles`.

## Security model (same rules as before, now enforced in `core/views.py`)

- Products, categories, active gift packages and `reviews_public` (no `user_id`) are readable by anyone.
- Orders, order items, wishlists, reviews and profiles are scoped to the signed-in user; admins see all.
- Coupons and newsletter subscribers are admin-read only; anyone may subscribe (throttled 10/min).
- Customers may only change `payment_ref` on their own **pending** orders. Everything else is admin-only.
- Money is server-authoritative: subtotal, discount, delivery fee and total are recomputed from the saved line items and the coupon — never trusted from the browser.
- Uploads are admin-only, max 8 MB, JPEG/PNG/WebP/AVIF, random filenames.
- Rate limits: auth 30/min, writes 120/min per client.

## Deploying

1. **Database** — any managed Postgres (Neon, Supabase, RDS, Railway). Put the URL in `DATABASE_URL`.
2. **API** — deploy `backend/` to Railway, Render, Fly.io or a VPS. The `Dockerfile` and `Procfile` both migrate then start Gunicorn. Host it at `api.nerawear.com`.
3. **Catalogue** — run `python manage.py import_catalogue` once against the production database to load the existing categories and products. It upserts by id, so it is safe to re-run.
4. **Images** — set `MEDIA_BACKEND=cloudinary` (or `s3`) plus the matching keys.
5. **Frontend** — build the React app with `VITE_API_URL=https://api.nerawear.com/api` and serve it at `nerawear.com`.
6. Add both domains to `CORS_ALLOWED_ORIGINS` and `CSRF_TRUSTED_ORIGINS`, keep `DJANGO_DEBUG=false`, and set a long random `DJANGO_SECRET_KEY`.

## M-Pesa

The manual Pochi la Biashara flow is kept: the customer pays to `MPESA_PHONE`
and submits the confirmation code, which lands on the order as `payment_ref`
and notifies `ADMIN_NOTIFY_EMAIL` by email and SMS. The admin then marks the
order paid. No Daraja credentials are required.
