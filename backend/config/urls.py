from django.conf import settings
from django.contrib import admin
from django.http import FileResponse, Http404, HttpResponseNotAllowed, JsonResponse
from django.urls import include, path, re_path
from django.views.decorators.http import require_GET
from storage.views import PublicFileDownloadView


@require_GET
def health_check(request):
    return JsonResponse({"status": "ok"})


def spa_index(request):
    if request.method not in {"GET", "HEAD"}:
        return HttpResponseNotAllowed(["GET", "HEAD"])

    index_path = settings.FRONTEND_DIST_DIR / "index.html"
    if not index_path.exists():
        raise Http404("Frontend build is not available.")

    return FileResponse(index_path.open("rb"), content_type="text/html")


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
    re_path(r"^(?!api/v1/|admin/|public/files/|static/).*$", spa_index, name="spa-index"),
]
