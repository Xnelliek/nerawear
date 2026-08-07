"""Load the storefront catalogue exported from the previous hosting into Postgres.

    python manage.py import_catalogue

Reads ``core/fixtures/catalogue.json`` (categories, products, gift packages)
and upserts every row by its original UUID, so running it twice is safe and
existing rows keep their ids, slugs and image URLs.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from core.models import Category, GiftPackage, Product

FIXTURE = Path(__file__).resolve().parents[2] / "fixtures" / "catalogue.json"


def _text(value: Any) -> str:
    return "" if value is None else str(value)


def _list(value: Any) -> list:
    return list(value) if isinstance(value, list) else []


class Command(BaseCommand):
    help = "Import categories, products and gift packages from core/fixtures/catalogue.json"

    def add_arguments(self, parser):
        parser.add_argument(
            "--file",
            default=str(FIXTURE),
            help="Path to the catalogue JSON export (defaults to the bundled fixture).",
        )

    def _upsert(self, model, row_id, slug: str, defaults: dict):
        """Upsert by original id, falling back to slug when the row already
        exists with a different id (e.g. created by bootstrap_store).

        Returns the object actually written, so callers can remap foreign keys.
        """
        obj = model.objects.filter(id=row_id).first()
        if obj is None and slug:
            obj = model.objects.filter(slug=slug).first()
        if obj is None:
            return model.objects.create(id=row_id, slug=slug, **defaults)
        for field, value in {"slug": slug, **defaults}.items():
            setattr(obj, field, value)
        obj.save()
        return obj

    @transaction.atomic
    def handle(self, *args, **options):
        path = Path(options["file"])
        if not path.exists():
            raise CommandError(f"Catalogue file not found: {path}")

        try:
            payload = json.loads(path.read_text())
        except json.JSONDecodeError as exc:
            raise CommandError(f"Catalogue file is not valid JSON: {exc}") from exc

        categories = 0
        category_ids: dict[str, Any] = {}
        for row in payload.get("categories", []):
            obj = self._upsert(
                Category,
                row["id"],
                row["slug"],
                {
                    "name": row["name"],
                    "description": _text(row.get("description")),
                    "image_url": _text(row.get("image_url")),
                    "sort_order": row.get("sort_order") or 0,
                },
            )
            category_ids[str(row["id"])] = obj.id
            categories += 1

        products = 0
        for row in payload.get("products", []):
            raw_category = row.get("category_id")
            self._upsert(
                Product,
                row["id"],
                row["slug"],
                {
                    "name": row["name"],
                    "description": _text(row.get("description")),
                    "price_kes": row.get("price_kes") or 0,
                    "category_id": category_ids.get(str(raw_category), raw_category),
                    "sizes": _list(row.get("sizes")),
                    "tag": _text(row.get("tag")),
                    "image_url": _text(row.get("image_url")),
                    "gallery": _list(row.get("gallery")),
                    "sold": bool(row.get("sold")),
                    "featured": bool(row.get("featured")),
                },
            )
            products += 1

        gifts = 0
        for row in payload.get("gift_packages", []):
            self._upsert(
                GiftPackage,
                row["id"],
                row["slug"],
                {
                    "name": row["name"],
                    "description": _text(row.get("description")),
                    "occasion": row.get("occasion") or "just_because",
                    "price_kes": row.get("price_kes") or 0,
                    "item_count": row.get("item_count") or 1,
                    "image_url": _text(row.get("image_url")),
                    "gallery": _list(row.get("gallery")),
                },
            )
            gifts += 1


        self.stdout.write(
            self.style.SUCCESS(
                f"Imported {categories} categories, {products} products, {gifts} gift packages."
            )
        )
