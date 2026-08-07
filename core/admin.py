"""Django admin — full back-office for products, gifts, orders and coupons."""
from django.contrib import admin

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

admin.site.site_header = "Néra Wear"
admin.site.site_title = "Néra Wear admin"
admin.site.index_title = "Store management"


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "sort_order")
    prepopulated_fields = {"slug": ("name",)}
    ordering = ("sort_order",)


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ("name", "price_kes", "category", "featured", "sold", "created_at")
    list_filter = ("category", "featured", "sold")
    list_editable = ("price_kes", "featured", "sold")
    search_fields = ("name", "slug", "tag")
    prepopulated_fields = {"slug": ("name",)}


@admin.register(GiftPackage)
class GiftPackageAdmin(admin.ModelAdmin):
    list_display = ("name", "occasion", "price_kes", "item_count", "active", "featured")
    list_filter = ("occasion", "active", "featured")
    list_editable = ("price_kes", "active", "featured")
    prepopulated_fields = {"slug": ("name",)}


class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0
    readonly_fields = ("unit_price_kes",)


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ("order_number", "first_name", "last_name", "phone", "total_kes", "payment_ref", "status", "created_at")
    list_filter = ("status", "payment_method", "county")
    search_fields = ("order_number", "phone", "payment_ref", "email", "last_name")
    readonly_fields = ("order_number", "subtotal_kes", "discount_kes", "total_kes", "created_at")
    inlines = [OrderItemInline]
    list_editable = ("status",)


@admin.register(Coupon)
class CouponAdmin(admin.ModelAdmin):
    list_display = ("code", "discount_type", "value", "min_subtotal_kes", "uses", "max_uses", "active", "expires_at")
    list_filter = ("active", "discount_type")


@admin.register(Review)
class ReviewAdmin(admin.ModelAdmin):
    list_display = ("product", "rating", "verified_buyer", "created_at")
    list_filter = ("rating", "verified_buyer")


@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ("email", "is_staff", "is_active", "date_joined")
    search_fields = ("email",)
    ordering = ("-date_joined",)


admin.site.register([UserRole, Profile, Wishlist, NewsletterSubscriber])
