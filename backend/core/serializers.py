"""Serializers — field names mirror the frontend's existing payloads exactly."""
from __future__ import annotations

from rest_framework import serializers

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


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ["id", "name", "slug", "description", "image_url", "sort_order", "created_at"]


class ProductSerializer(serializers.ModelSerializer):
    category_id = serializers.UUIDField(allow_null=True, required=False)

    class Meta:
        model = Product
        fields = [
            "id", "name", "slug", "description", "price_kes", "category_id", "sizes", "tag",
            "image_url", "gallery", "sold", "featured", "created_at", "updated_at",
        ]


class GiftPackageSerializer(serializers.ModelSerializer):
    class Meta:
        model = GiftPackage
        fields = [
            "id", "name", "slug", "description", "occasion", "price_kes", "item_count",
            "image_url", "gallery", "contents", "active", "featured", "created_at", "updated_at",
        ]


class CouponSerializer(serializers.ModelSerializer):
    class Meta:
        model = Coupon
        fields = [
            "id", "code", "discount_type", "value", "min_subtotal_kes", "expires_at",
            "max_uses", "uses", "active", "created_at",
        ]
        read_only_fields = ["uses"]


class OrderItemSerializer(serializers.ModelSerializer):
    order_id = serializers.UUIDField()
    product_id = serializers.UUIDField(allow_null=True, required=False)

    class Meta:
        model = OrderItem
        fields = [
            "id", "order_id", "product_id", "product_name", "size",
            "unit_price_kes", "quantity", "image_url",
        ]


class OrderSerializer(serializers.ModelSerializer):
    user_id = serializers.UUIDField(allow_null=True, required=False)
    order_items = OrderItemSerializer(source="items", many=True, read_only=True)

    class Meta:
        model = Order
        fields = [
            "id", "user_id", "order_number", "first_name", "last_name", "phone", "email",
            "county", "address", "subtotal_kes", "delivery_fee_kes", "discount_kes", "total_kes",
            "coupon_code", "payment_method", "payment_ref", "status", "created_at", "updated_at",
            "order_items",
        ]
        read_only_fields = ["order_number", "subtotal_kes", "discount_kes", "total_kes"]


class ReviewSerializer(serializers.ModelSerializer):
    product_id = serializers.UUIDField()
    user_id = serializers.UUIDField(required=False)

    class Meta:
        model = Review
        fields = ["id", "product_id", "user_id", "rating", "title", "body", "verified_buyer", "created_at"]
        read_only_fields = ["verified_buyer"]


class PublicReviewSerializer(serializers.ModelSerializer):
    """Public projection — deliberately omits user_id so customer ids stay private."""

    product_id = serializers.UUIDField()

    class Meta:
        model = Review
        fields = ["id", "product_id", "rating", "title", "body", "verified_buyer", "created_at"]


class WishlistSerializer(serializers.ModelSerializer):
    product_id = serializers.UUIDField()
    user_id = serializers.UUIDField(required=False)

    class Meta:
        model = Wishlist
        fields = ["id", "user_id", "product_id", "created_at"]


class NewsletterSubscriberSerializer(serializers.ModelSerializer):
    class Meta:
        model = NewsletterSubscriber
        fields = ["id", "email", "created_at"]


class ProfileSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source="user_id", read_only=True)

    class Meta:
        model = Profile
        fields = ["id", "full_name", "phone", "created_at", "updated_at"]


class UserRoleSerializer(serializers.ModelSerializer):
    user_id = serializers.UUIDField()

    class Meta:
        model = UserRole
        fields = ["id", "user_id", "role", "created_at"]


# backend/core/serializers.py (lines 136-147)

class UserSerializer(serializers.ModelSerializer):
    is_store_admin = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "email", "date_joined", "is_store_admin"]

    def get_is_store_admin(self, obj: User) -> bool:
        return bool(obj.is_store_admin)


class SignUpSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(min_length=8, max_length=128, write_only=True)
    full_name = serializers.CharField(max_length=200, required=False, allow_blank=True)
    phone = serializers.CharField(max_length=30, required=False, allow_blank=True)


class SignInSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(max_length=128, write_only=True)


class ValidateCouponSerializer(serializers.Serializer):
    code = serializers.CharField(max_length=40)
    subtotal_kes = serializers.IntegerField(min_value=0)
