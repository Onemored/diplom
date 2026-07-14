from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path
from django.views.decorators.http import require_GET
from storage.views import PublicFileDownloadView


@require_GET
def health_check(request):
    return JsonResponse({"status": "ok"})


urlpatterns = [
    path("admin/", admin.site.urls),
    path(
        "public/files/<str:token>/",
        PublicFileDownloadView.as_view(),
        name="public-file-download",
    ),
    path("api/v1/health/", health_check, name="health-check"),
    path("api/v1/", include("storage.urls")),
    path("api/v1/", include("users.urls")),
]
