from django.urls import path

from storage.views import FileDetailView, FileDownloadView, FileListCreateView, PublicLinkView

app_name = "storage"

urlpatterns = [
    path("files/", FileListCreateView.as_view(), name="file-list"),
    path("files/<int:file_id>/", FileDetailView.as_view(), name="file-detail"),
    path(
        "files/<int:file_id>/download/",
        FileDownloadView.as_view(),
        name="file-download",
    ),
    path(
        "files/<int:file_id>/public-link/",
        PublicLinkView.as_view(),
        name="file-public-link",
    ),
]
