from django.urls import path

from storage.views import FileDetailView, FileDownloadPlaceholderView, FileListCreateView

app_name = "storage"

urlpatterns = [
    path("files/", FileListCreateView.as_view(), name="file-list"),
    path("files/<int:file_id>/", FileDetailView.as_view(), name="file-detail"),
    path(
        "files/<int:file_id>/download/",
        FileDownloadPlaceholderView.as_view(),
        name="file-download",
    ),
]
