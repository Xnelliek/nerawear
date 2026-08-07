from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path

from core import views

urlpatterns = [
    path("", views.api_home, name="api-home"),
    path("django-admin/", admin.site.urls),
    path("api/", include("core.urls")),
    path("favicon.ico", views.health, name="favicon-noop"),
]

if settings.DEBUG and settings.MEDIA_BACKEND == "local":
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
