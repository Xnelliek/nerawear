"""Data model for the Néra Wear store — a 1:1 port of the original schema."""
from __future__ import annotations

import random
import string
import uuid

from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.utils import timezone


class UUIDModel(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(default=timezone.now, editable=False)

    class Meta:
        abstract = True


# --------------------------------------------------------------------------
# Auth
# --------------------------------------------------------------------------
class UserManager(BaseUserManager):
    use_in_migrations = True

    def _create(self, email: str, password: str | None, **extra):
        if not email:
            raise ValueError("An email address is required.")
        user = self.model(email=self.normalize_email(email).lower(), **extra)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, email: str, password: str | None = None, **extra):
        extra.setdefault("is_staff", False)
        extra.setdefault("is_superuser", False)
        return self._create(email, password, **extra)

    def create_superuser(self, email: str, password: str | None = None, **extra):
        extra.update(is_staff=True, is_superuser=True, is_active=True)
        user = self._create(email, password, **extra)
        UserRole.objects.get_or_create(user=user, role=UserRole.ADMIN)
        return user


class User(AbstractBaseUser, PermissionsMixin):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    date_joined = models.DateTimeField(default=timezone.now)

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS: list[str] = []

    class Meta:
        db_table = "users"

    def __str__(self) -> str:
        return self.email

    @property
    def is_store_admin(self) -> bool:
        return self.is_superuser or self.roles.filter(role=UserRole.ADMIN).exists()


class UserRole(UUIDModel):
    ADMIN = "admin"
    CUSTOMER = "customer"
    ROLE_CHOICES = [(ADMIN, "Admin"), (CUSTOMER, "Customer")]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="roles")
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default=CUSTOMER)

    class Meta:
        db_table = "user_roles"
        unique_together = [("user", "role")]

    def __str__(self) -> str:
        return f"{self.user.email}: {self.role}"


class Profile(models.Model):
    """Customer profile — never stores roles (privilege-escalation safe)."""

    user = models.OneToOneField(User, on_delete=models.CASCADE, primary_key=True, related_name="profile")
    full_name = models.CharField(max_length=200, blank=True, default="")
    phone = models.CharField(max_length=30, blank=True, default="")
    created_at = models.DateTimeField(default=timezone.now, editable=False)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "profiles"

    def __str__(self) -> str:
        return self.full_name or self.user.email


# --------------------------------------------------------------------------
# Catalogue
# --------------------------------------------------------------------------
class Category(UUIDModel):
    name = models.CharField(max_length=120)
    slug = models.SlugField(max_length=140, unique=True)
    description = models.TextField(blank=True, default="")
    image_url = models.URLField(max_length=500, blank=True, default="")
    sort_order = models.IntegerField(default=0)

    class Meta:
        db_table = "categories"
        ordering = ["sort_order", "name"]
        verbose_name_plural = "categories"

    def __str__(self) -> str:
        return self.name


class Product(UUIDModel):
    name = models.CharField(max_length=200)
    slug = models.SlugField(max_length=220, unique=True)
    description = models.TextField(blank=True, default="")
    price_kes = models.PositiveIntegerField()
    category = models.ForeignKey(
        Category, on_delete=models.SET_NULL, null=True, blank=True, related_name="products", db_column="category_id"
    )
    sizes = models.JSONField(default=list, blank=True)
    tag = models.CharField(max_length=60, blank=True, default="")
    image_url = models.URLField(max_length=500, blank=True, default="")
    gallery = models.JSONField(default=list, blank=True)
    sold = models.BooleanField(default=False)
    featured = models.BooleanField(default=False)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "products"
        ordering = ["-featured", "-created_at"]
        indexes = [models.Index(fields=["category", "-created_at"])]

    def __str__(self) -> str:
        return self.name


class GiftPackage(UUIDModel):
    OCCASIONS = [
        ("birthday", "Birthday"),
        ("anniversary", "Anniversary"),
        ("valentines", "Valentine's Day"),
        ("mothers_day", "Mother's Day"),
        ("womens_day", "Women's Day"),
        ("graduation", "Graduation"),
        ("baby_shower", "Baby shower"),
        ("just_because", "Just because"),
        ("other", "Other"),
    ]

    name = models.CharField(max_length=200)
    slug = models.SlugField(max_length=220, unique=True)
    description = models.TextField(blank=True, default="")
    occasion = models.CharField(max_length=30, choices=OCCASIONS, default="just_because")
    price_kes = models.PositiveIntegerField()
    item_count = models.PositiveSmallIntegerField(
        default=1, validators=[MinValueValidator(1), MaxValueValidator(10)]
    )
    image_url = models.URLField(max_length=500, blank=True, default="")
    gallery = models.JSONField(default=list, blank=True)
    contents = models.JSONField(default=list, blank=True)
    active = models.BooleanField(default=True)
    featured = models.BooleanField(default=False)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "gift_packages"
        ordering = ["-featured", "-created_at"]

    def __str__(self) -> str:
        return f"{self.name} ({self.item_count} items)"


# --------------------------------------------------------------------------
# Commerce
# --------------------------------------------------------------------------
class Coupon(UUIDModel):
    PERCENT = "percent"
    FIXED = "fixed"

    code = models.CharField(max_length=40, unique=True)
    discount_type = models.CharField(max_length=10, choices=[(PERCENT, "Percent"), (FIXED, "Fixed")])
    value = models.PositiveIntegerField()
    min_subtotal_kes = models.PositiveIntegerField(default=0)
    expires_at = models.DateTimeField(null=True, blank=True)
    max_uses = models.PositiveIntegerField(null=True, blank=True)
    uses = models.PositiveIntegerField(default=0)
    active = models.BooleanField(default=True)

    class Meta:
        db_table = "coupons"
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return self.code

    def discount_for(self, subtotal_kes: int) -> int:
        if self.discount_type == self.PERCENT:
            return min(subtotal_kes, round(subtotal_kes * self.value / 100))
        return min(subtotal_kes, self.value)

    def validate_for(self, subtotal_kes: int) -> str | None:
        """Returns an error message, or None when the coupon is usable."""
        if not self.active:
            return "This code is no longer active."
        if self.expires_at and self.expires_at <= timezone.now():
            return "This code has expired."
        if self.max_uses is not None and self.uses >= self.max_uses:
            return "This code has reached its usage limit."
        if subtotal_kes < self.min_subtotal_kes:
            return f"Spend at least KES {self.min_subtotal_kes:,} to use this code."
        return None


def make_order_number() -> str:
    stamp = timezone.now().strftime("%y%m%d")
    suffix = "".join(random.choices(string.ascii_lowercase + string.digits, k=6))
    return f"NW-{stamp}-{suffix}"


class Order(UUIDModel):
    PENDING, PAID, SHIPPED, DELIVERED, CANCELLED = "pending", "paid", "shipped", "delivered", "cancelled"
    STATUS_CHOICES = [
        (PENDING, "Pending"),
        (PAID, "Paid"),
        (SHIPPED, "Shipped"),
        (DELIVERED, "Delivered"),
        (CANCELLED, "Cancelled"),
    ]
    PAYMENT_CHOICES = [("mpesa", "M-Pesa"), ("card", "Card"), ("cod", "Cash on delivery")]

    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name="orders")
    order_number = models.CharField(max_length=30, unique=True, default=make_order_number)
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    phone = models.CharField(max_length=30)
    email = models.EmailField(blank=True, null=True)
    county = models.CharField(max_length=100)
    address = models.TextField()
    subtotal_kes = models.PositiveIntegerField(default=0)
    delivery_fee_kes = models.PositiveIntegerField(default=0)
    discount_kes = models.PositiveIntegerField(default=0)
    total_kes = models.PositiveIntegerField(default=0)
    coupon_code = models.CharField(max_length=40, blank=True, null=True)
    payment_method = models.CharField(max_length=10, choices=PAYMENT_CHOICES, default="mpesa")
    payment_ref = models.CharField(max_length=60, blank=True, null=True, help_text="M-Pesa confirmation code")
    status = models.CharField(max_length=15, choices=STATUS_CHOICES, default=PENDING)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "orders"
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.order_number} — {self.first_name} {self.last_name}"

    def recompute_totals(self) -> None:
        """Server-authoritative totals — never trust client-sent money."""
        items = list(self.items.all())
        subtotal = sum(item.unit_price_kes * item.quantity for item in items)
        discount = 0
        if self.coupon_code:
            coupon = Coupon.objects.filter(code__iexact=self.coupon_code).first()
            if coupon and coupon.validate_for(subtotal) is None:
                discount = coupon.discount_for(subtotal)
        self.subtotal_kes = subtotal
        self.discount_kes = discount
        self.total_kes = max(0, subtotal - discount + self.delivery_fee_kes)
        self.save(update_fields=["subtotal_kes", "discount_kes", "total_kes", "updated_at"])


class OrderItem(UUIDModel):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="items", db_column="order_id")
    product = models.ForeignKey(
        Product, on_delete=models.SET_NULL, null=True, blank=True, related_name="order_items", db_column="product_id"
    )
    product_name = models.CharField(max_length=200)
    size = models.CharField(max_length=20, blank=True, null=True)
    unit_price_kes = models.PositiveIntegerField()
    quantity = models.PositiveIntegerField(default=1)
    image_url = models.URLField(max_length=500, blank=True, default="")

    class Meta:
        db_table = "order_items"

    def save(self, *args, **kwargs):
        # Price integrity: always take the price from the catalogue when linked.
        if self.product_id:
            self.unit_price_kes = self.product.price_kes
            self.product_name = self.product.name
            self.image_url = self.product.image_url or self.image_url
        super().save(*args, **kwargs)


class Review(UUIDModel):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="reviews", db_column="product_id")
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="reviews")
    rating = models.PositiveSmallIntegerField(validators=[MinValueValidator(1), MaxValueValidator(5)])
    title = models.CharField(max_length=140, blank=True, null=True)
    body = models.TextField(blank=True, null=True)
    verified_buyer = models.BooleanField(default=False)

    class Meta:
        db_table = "reviews"
        ordering = ["-created_at"]
        unique_together = [("product", "user")]

    def save(self, *args, **kwargs):
        self.verified_buyer = OrderItem.objects.filter(
            product_id=self.product_id, order__user_id=self.user_id, order__status__in=[Order.PAID, Order.SHIPPED, Order.DELIVERED]
        ).exists()
        super().save(*args, **kwargs)


class Wishlist(UUIDModel):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="wishlist")
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="wishlisted_by", db_column="product_id")

    class Meta:
        db_table = "wishlists"
        unique_together = [("user", "product")]


class NewsletterSubscriber(UUIDModel):
    email = models.EmailField(unique=True)

    class Meta:
        db_table = "newsletter_subscribers"
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return self.email
