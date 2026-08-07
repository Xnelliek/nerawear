"""A small, explicit data API that mirrors the row-level rules of the old backend.

The React client talks to four endpoint families:

    /api/db/<table>/            generic filtered CRUD (per-table access rules)
    /api/auth/...               signup / signin / refresh / user / profile
    /api/rpc/validate_coupon/   server-side coupon validation
    /api/storage/upload/        image upload -> Cloudinary / S3 / local
"""
from __future__ import annotations

import json
import uuid
from typing import Any, Callable

from django.conf import settings
from django.core.files.storage import default_storage
from django.db import IntegrityError, transaction
from django.db.models import Avg, Count, Q, QuerySet
from django.utils.text import slugify
from rest_framework import status
from rest_framework.decorators import api_view, parser_classes, permission_classes, throttle_classes
from rest_framework.parsers import MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from . import notifications
from .models import (
    Category,
    Coupon,
    GiftPackage,
    NewsletterSubscriber,
    Order,
    OrderItem,
    Product,
    Profile,
    Review,
    User,
    UserRole,
    Wishlist,
)
from .serializers import (
    CategorySerializer,
    CouponSerializer,
    GiftPackageSerializer,
    NewsletterSubscriberSerializer,
    OrderItemSerializer,
    OrderSerializer,
    ProductSerializer,
    ProfileSerializer,
    PublicReviewSerializer,
    ReviewSerializer,
    SignInSerializer,
    SignUpSerializer,
    UserRoleSerializer,
    UserSerializer,
    ValidateCouponSerializer,
    WishlistSerializer,
)

OPERATORS = {
    "eq": "",
    "neq": "",
    "gt": "__gt",
    "gte": "__gte",
    "lt": "__lt",
    "lte": "__lte",
    "in": "__in",
    "ilike": "__icontains",
    "is": "",
}

ALLOWED_FILTER_FIELDS = {
    "id", "slug", "email", "code", "active", "featured", "sold", "status", "rating",
    "occasion", "category_id", "product_id", "order_id", "user_id", "payment_ref",
    "name", "tag", "created_at", "role",
}



def err(message: str, code: str = "bad_request", http=status.HTTP_400_BAD_REQUEST) -> Response:
    return Response({"error": {"message": message, "code": code}}, status=http)


def parse_json_param(request, name: str, fallback: Any) -> Any:
    raw = request.query_params.get(name)
    if not raw:
        return fallback
    try:
        return json.loads(raw)
    except ValueError:
        return fallback


def apply_filters(qs: QuerySet, filters: list) -> QuerySet:
    for entry in filters:
        if not isinstance(entry, (list, tuple)) or len(entry) != 3:
            continue
        op, field, value = entry
        if op not in OPERATORS or field not in ALLOWED_FILTER_FIELDS:
            continue
        if op == "is" and value is None:
            qs = qs.filter(**{f"{field}__isnull": True})
        elif op == "neq":
            qs = qs.exclude(**{field: value})
        else:
            qs = qs.filter(**{f"{field}{OPERATORS[op]}": value})
    return qs


def apply_order(qs: QuerySet, order: list) -> QuerySet:
    fields: list[str] = []
    for entry in order:
        if isinstance(entry, (list, tuple)) and len(entry) == 2:
            field, ascending = entry
            if field in ALLOWED_FILTER_FIELDS or field in {"sort_order", "price_kes", "item_count"}:
                fields.append(field if ascending else f"-{field}")
    return qs.order_by(*fields) if fields else qs


class Table:
    """Access rules for one table, mirroring the previous row-level policies."""

    def __init__(
        self,
        model,
        serializer,
        *,
        read: Callable[[Any], QuerySet | None],
        insert: Callable[[Any, dict], dict | None] | None = None,
        update_fields: set[str] | None = None,
        allow_admin_write: bool = False,
        allow_delete_own: bool = False,
        conflict_fields: tuple[str, ...] = (),
        throttle_scope: str = "write",
    ):
        self.model = model
        self.serializer = serializer
        self.read = read
        self.insert = insert
        self.update_fields = update_fields or set()
        self.allow_admin_write = allow_admin_write
        self.allow_delete_own = allow_delete_own
        self.conflict_fields = conflict_fields
        self.throttle_scope = throttle_scope


def is_admin(user) -> bool:
    return bool(user and user.is_authenticated and user.is_store_admin)


# ---- read scopes ---------------------------------------------------------
def public(model):
    return lambda user: model.objects.all()


def gift_read(user):
    qs = GiftPackage.objects.all()
    return qs if is_admin(user) else qs.filter(active=True)


def own_rows(model, field="user_id"):
    def scope(user):
        if not user or not user.is_authenticated:
            return None
        if is_admin(user):
            return model.objects.all()
        return model.objects.filter(**{field: user.id})

    return scope


def admin_only(model):
    def scope(user):
        return model.objects.all() if is_admin(user) else None

    return scope


# ---- insert guards ------------------------------------------------------
def insert_own(user, row: dict) -> dict | None:
    if not user or not user.is_authenticated:
        return None
    row["user_id"] = str(user.id)
    return row


def insert_order_item(user, row: dict) -> dict | None:
    if not user or not user.is_authenticated:
        return None
    order = Order.objects.filter(id=row.get("order_id")).first()
    if not order or (order.user_id != user.id and not is_admin(user)):
        return None
    return row


def insert_public(user, row: dict) -> dict | None:
    return row


def insert_admin(user, row: dict) -> dict | None:
    return row if is_admin(user) else None


TABLES: dict[str, Table] = {
    "categories": Table(Category, CategorySerializer, read=public(Category), insert=insert_admin,
                        update_fields={"name", "slug", "description", "image_url", "sort_order"},
                        allow_admin_write=True),
    "products": Table(Product, ProductSerializer, read=public(Product), insert=insert_admin,
                      update_fields={"name", "slug", "description", "price_kes", "category_id", "sizes",
                                     "tag", "image_url", "gallery", "sold", "featured"},
                      allow_admin_write=True),
    "gift_packages": Table(GiftPackage, GiftPackageSerializer, read=gift_read, insert=insert_admin,
                           update_fields={"name", "slug", "description", "occasion", "price_kes", "item_count",
                                          "image_url", "gallery", "contents", "active", "featured"},
                           allow_admin_write=True),
    "coupons": Table(Coupon, CouponSerializer, read=admin_only(Coupon), insert=insert_admin,
                     update_fields={"code", "discount_type", "value", "min_subtotal_kes", "expires_at",
                                    "max_uses", "active"},
                     allow_admin_write=True),
    "orders": Table(Order, OrderSerializer, read=own_rows(Order), insert=insert_own,
                    update_fields={"payment_ref"}, allow_admin_write=True),
    "order_items": Table(OrderItem, OrderItemSerializer, read=own_rows(OrderItem, "order__user_id"),
                         insert=insert_order_item),
    "reviews": Table(Review, ReviewSerializer, read=own_rows(Review), insert=insert_own,
                     update_fields={"rating", "title", "body"}, allow_delete_own=True,
                     conflict_fields=("product_id", "user_id"), allow_admin_write=True),
    "reviews_public": Table(Review, PublicReviewSerializer, read=public(Review)),
    "wishlists": Table(Wishlist, WishlistSerializer, read=own_rows(Wishlist), insert=insert_own,
                       allow_delete_own=True, conflict_fields=("product_id", "user_id")),
    "newsletter_subscribers": Table(NewsletterSubscriber, NewsletterSubscriberSerializer,
                                    read=admin_only(NewsletterSubscriber), insert=insert_public,
                                    throttle_scope="newsletter"),
    "profiles": Table(Profile, ProfileSerializer, read=own_rows(Profile), update_fields={"full_name", "phone"}),
    "user_roles": Table(UserRole, UserRoleSerializer, read=own_rows(UserRole), insert=insert_admin,
                        allow_admin_write=True),
}


class AuthThrottle(ScopedRateThrottle):
    scope = "auth"


class TableThrottle(ScopedRateThrottle):
    scope = "write"

    def allow_request(self, request, view):
        if request.method == "GET":
            return True
        return super().allow_request(request, view)


class TableView(APIView):
    """Generic, policy-checked CRUD over a whitelisted table."""

    throttle_classes = [TableThrottle]

    def get_table(self, name: str) -> Table | None:
        return TABLES.get(name)

    # -- read ------------------------------------------------------------
    def get(self, request, table: str):
        cfg = self.get_table(table)
        if not cfg:
            return err("Unknown table.", "unknown_table", status.HTTP_404_NOT_FOUND)
        qs = cfg.read(request.user)
        if qs is None:
            return err("Not allowed.", "forbidden", status.HTTP_403_FORBIDDEN)

        qs = apply_filters(qs, parse_json_param(request, "filters", []))
        total = qs.count()
        if request.query_params.get("head") == "1":
            return Response({"data": None, "count": total})

        qs = apply_order(qs, parse_json_param(request, "order", []))
        limit = request.query_params.get("limit")
        if limit and limit.isdigit():
            qs = qs[: min(int(limit), 200)]
        else:
            qs = qs[:500]

        data = cfg.serializer(qs, many=True).data
        if request.query_params.get("single") == "1":
            return Response({"data": data[0] if data else None, "count": total})
        return Response({"data": data, "count": total})

    # -- insert / upsert -------------------------------------------------
    def post(self, request, table: str):
        cfg = self.get_table(table)
        if not cfg or not cfg.insert:
            return err("Insert not allowed on this table.", "forbidden", status.HTTP_403_FORBIDDEN)

        rows = request.data.get("rows") or []
        if not isinstance(rows, list) or not rows:
            return err("No rows supplied.")
        if len(rows) > 50:
            return err("Too many rows in one request.")
        upsert = bool(request.data.get("upsert"))

        created: list[Any] = []
        with transaction.atomic():
            for raw in rows:
                if not isinstance(raw, dict):
                    return err("Invalid row payload.")
                row = cfg.insert(request.user, dict(raw))
                if row is None:
                    return err("Not allowed.", "forbidden", status.HTTP_403_FORBIDDEN)
                if table in {"products", "gift_packages", "categories"} and not row.get("slug"):
                    row["slug"] = f"{slugify(row.get('name', 'item'))}-{uuid.uuid4().hex[:6]}"

                instance = None
                if upsert and cfg.conflict_fields:
                    lookup = {f: row.get(f) for f in cfg.conflict_fields}
                    instance = cfg.model.objects.filter(**lookup).first()

                serializer = cfg.serializer(instance, data=row, partial=instance is not None)
                if not serializer.is_valid():
                    return err(json.dumps(serializer.errors), "validation_error")
                try:
                    created.append(serializer.save())
                except IntegrityError:
                    if table == "newsletter_subscribers":
                        return err("Already subscribed.", "23505", status.HTTP_409_CONFLICT)
                    return err("This record already exists.", "23505", status.HTTP_409_CONFLICT)

        # Server-authoritative money + notifications
        if table == "order_items" and created:
            order = created[0].order
            order.delivery_fee_kes = compute_delivery_fee(order)
            order.recompute_totals()
            notifications.order_placed(order)

        data = cfg.serializer(created, many=True).data
        return Response({"data": data, "count": len(data)}, status=status.HTTP_201_CREATED)

    # -- update ----------------------------------------------------------
    def patch(self, request, table: str):
        cfg = self.get_table(table)
        if not cfg:
            return err("Unknown table.", "unknown_table", status.HTTP_404_NOT_FOUND)
        qs = cfg.read(request.user)
        if qs is None:
            return err("Not allowed.", "forbidden", status.HTTP_403_FORBIDDEN)

        filters = parse_json_param(request, "filters", [])
        if not filters:
            return err("Updates require a filter.")
        qs = apply_filters(qs, filters)

        values = request.data.get("values") or {}
        if not isinstance(values, dict) or not values:
            return err("Nothing to update.")

        admin = is_admin(request.user)
        if admin and cfg.allow_admin_write:
            allowed = values
        else:
            unknown = set(values) - cfg.update_fields
            if unknown:
                return err(f"You may not change: {', '.join(sorted(unknown))}", "forbidden", status.HTTP_403_FORBIDDEN)
            allowed = values
            if table == "orders":
                qs = qs.filter(status=Order.PENDING)

        updated = []
        with transaction.atomic():
            for instance in qs[:200]:
                serializer = cfg.serializer(instance, data=allowed, partial=True)
                if not serializer.is_valid():
                    return err(json.dumps(serializer.errors), "validation_error")
                updated.append(serializer.save())

        for instance in updated:
            if table == "orders":
                if "payment_ref" in allowed and allowed["payment_ref"]:
                    notifications.payment_code_submitted(instance)
                if "status" in allowed:
                    if instance.status == Order.PAID and instance.coupon_code:
                        Coupon.objects.filter(code__iexact=instance.coupon_code).update(uses=models_f_uses())
                    notifications.status_changed(instance)

        data = cfg.serializer(updated, many=True).data
        return Response({"data": data, "count": len(data)})

    # -- delete ----------------------------------------------------------
    def delete(self, request, table: str):
        cfg = self.get_table(table)
        if not cfg:
            return err("Unknown table.", "unknown_table", status.HTTP_404_NOT_FOUND)
        if not (is_admin(request.user) and cfg.allow_admin_write) and not cfg.allow_delete_own:
            return err("Delete not allowed.", "forbidden", status.HTTP_403_FORBIDDEN)
        qs = cfg.read(request.user)
        if qs is None:
            return err("Not allowed.", "forbidden", status.HTTP_403_FORBIDDEN)
        filters = parse_json_param(request, "filters", [])
        if not filters:
            return err("Deletes require a filter.")
        deleted, _ = apply_filters(qs, filters).delete()
        return Response({"data": None, "count": deleted})


def models_f_uses():
    from django.db.models import F

    return F("uses") + 1


def compute_delivery_fee(order: Order) -> int:
    subtotal = sum(i.unit_price_kes * i.quantity for i in order.items.all())
    if subtotal >= settings.FREE_DELIVERY_THRESHOLD_KES:
        return 0
    nairobi = (order.county or "").strip().lower() in {"nairobi", "nairobi county"}
    return settings.DELIVERY_FEE_NAIROBI_KES if nairobi else settings.DELIVERY_FEE_UPCOUNTRY_KES


# --------------------------------------------------------------------------
# Auth
# --------------------------------------------------------------------------
def tokens_for(user: User) -> dict:
    refresh = RefreshToken.for_user(user)
    return {
        "access_token": str(refresh.access_token),
        "refresh_token": str(refresh),
        "user": UserSerializer(user).data,
    }


@api_view(["POST"])
@throttle_classes([AuthThrottle])
def sign_up(request):
    serializer = SignUpSerializer(data=request.data)
    if not serializer.is_valid():
        return err(json.dumps(serializer.errors), "validation_error")
    data = serializer.validated_data
    email = data["email"].lower()
    if User.objects.filter(email=email).exists():
        return err("An account with this email already exists. Please sign in.", "user_exists", status.HTTP_409_CONFLICT)
    with transaction.atomic():
        user = User.objects.create_user(email=email, password=data["password"])
        UserRole.objects.create(user=user, role=UserRole.CUSTOMER)
        Profile.objects.create(
            user=user, full_name=data.get("full_name", ""), phone=data.get("phone", "")
        )
    return Response({"data": tokens_for(user)}, status=status.HTTP_201_CREATED)


@api_view(["POST"])
@throttle_classes([AuthThrottle])
def sign_in(request):
    serializer = SignInSerializer(data=request.data)
    if not serializer.is_valid():
        return err(json.dumps(serializer.errors), "validation_error")
    email = serializer.validated_data["email"].lower()
    user = User.objects.filter(email=email).first()
    if not user or not user.check_password(serializer.validated_data["password"]) or not user.is_active:
        return err("Invalid email or password.", "invalid_credentials", status.HTTP_401_UNAUTHORIZED)
    return Response({"data": tokens_for(user)})


@api_view(["POST"])
def refresh_session(request):
    token = request.data.get("refresh_token")
    if not token:
        return err("Missing refresh token.", "invalid_token", status.HTTP_401_UNAUTHORIZED)
    try:
        refresh = RefreshToken(token)
        user = User.objects.get(id=refresh["user_id"])
    except Exception:  # noqa: BLE001 - any invalid token means signed out
        return err("Session expired.", "invalid_token", status.HTTP_401_UNAUTHORIZED)
    return Response({"data": tokens_for(user)})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def current_user(request):
    profile = Profile.objects.filter(user=request.user).first()
    return Response({
        "data": {
            "user": UserSerializer(request.user).data,
            "profile": ProfileSerializer(profile).data if profile else None,
        }
    })


# --------------------------------------------------------------------------
# RPC + storage
# --------------------------------------------------------------------------
@api_view(["POST"])
def validate_coupon(request):
    serializer = ValidateCouponSerializer(data=request.data)
    if not serializer.is_valid():
        return err(json.dumps(serializer.errors), "validation_error")
    code = serializer.validated_data["code"].strip()
    subtotal = serializer.validated_data["subtotal_kes"]
    coupon = Coupon.objects.filter(code__iexact=code).first()
    if not coupon:
        return Response({"data": [{"message": "We couldn't find that code.", "discount_kes": 0}]})
    problem = coupon.validate_for(subtotal)
    if problem:
        return Response({"data": [{"message": problem, "discount_kes": 0}]})
    return Response({"data": [{
        "code": coupon.code,
        "discount_type": coupon.discount_type,
        "value": coupon.value,
        "discount_kes": coupon.discount_for(subtotal),
        "message": None,
    }]})


@api_view(["GET"])
def product_review_summary(request, product_id: str):
    stats = Review.objects.filter(product_id=product_id).aggregate(
        average=Avg("rating"), total=Count("id"),
        five=Count("id", filter=Q(rating=5)), four=Count("id", filter=Q(rating=4)),
        three=Count("id", filter=Q(rating=3)), two=Count("id", filter=Q(rating=2)),
        one=Count("id", filter=Q(rating=1)),
    )
    return Response({"data": {
        "average": round(stats["average"] or 0, 1),
        "total": stats["total"] or 0,
        "breakdown": {str(k): stats[v] for k, v in
                      {5: "five", 4: "four", 3: "three", 2: "two", 1: "one"}.items()},
    }})


ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/avif"}
MAX_IMAGE_BYTES = 8 * 1024 * 1024


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser])
def upload_image(request):
    if not is_admin(request.user):
        return err("Only store admins can upload images.", "forbidden", status.HTTP_403_FORBIDDEN)
    file = request.FILES.get("file")
    if not file:
        return err("No file supplied.")
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        return err("Only JPEG, PNG, WebP or AVIF images are allowed.")
    if file.size > MAX_IMAGE_BYTES:
        return err("Images must be 8MB or smaller.")
    folder = request.data.get("folder", "product-images")
    if folder not in {"product-images", "gift-images", "category-images"}:
        folder = "product-images"
    name = f"{folder}/{uuid.uuid4().hex}{'.' + file.name.rsplit('.', 1)[-1].lower() if '.' in file.name else ''}"
    saved = default_storage.save(name, file)
    return Response({"data": {"path": saved, "public_url": default_storage.url(saved)}},
                    status=status.HTTP_201_CREATED)


@api_view(["GET"])
def store_config(request):
    return Response({"data": {
        "store_name": settings.STORE_NAME,
        "mpesa_name": settings.MPESA_PAYBILL_NAME,
        "mpesa_phone": settings.MPESA_PHONE,
        "delivery_nairobi_kes": settings.DELIVERY_FEE_NAIROBI_KES,
        "delivery_upcountry_kes": settings.DELIVERY_FEE_UPCOUNTRY_KES,
        "free_delivery_threshold_kes": settings.FREE_DELIVERY_THRESHOLD_KES,
    }})


@api_view(["GET"])
def health(request):
    return Response({"status": "ok"})

@api_view(["GET"])
def api_home(request):
    return Response({
        "service": "Néra Wear API",
        "status": "ok",
        "docs": "See backend/README.md",
        "endpoints": {
            "health": "/api/health/",
            "auth": "/api/auth/",
            "products": "/api/db/products/",
            "orders": "/api/db/orders/",
            "coupons": "/api/rpc/validate_coupon/",
            "upload": "/api/storage/upload/",
            "admin": "/django-admin/",
        },
    })

