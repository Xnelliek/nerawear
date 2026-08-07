from django.urls import path

from . import views

urlpatterns = [
    path("health/", views.health, name="health"),
    path("config/", views.store_config, name="store-config"),

    # Auth
    path("auth/signup/", views.sign_up, name="sign-up"),
    path("auth/signin/", views.sign_in, name="sign-in"),
    path("auth/refresh/", views.refresh_session, name="refresh-session"),
    path("auth/user/", views.current_user, name="current-user"),

    # RPC
    path("rpc/validate_coupon/", views.validate_coupon, name="validate-coupon"),
    path("products/<uuid:product_id>/review-summary/", views.product_review_summary, name="review-summary"),

    # Storage
    path("storage/upload/", views.upload_image, name="upload-image"),

    # Generic data API
    path("db/<str:table>/", views.TableView.as_view(), name="table"),
]
