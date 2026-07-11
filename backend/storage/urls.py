from django.urls import path

from storage.views import FileDownloadPlaceholderView, FileListCreateView

app_name = "storage"

urlpatterns = [
    path("files/", FileListCreateView.as_view(), name="file-list"),
    path(
        "files/<int:file_id>/download/",
        FileDownloadPlaceholderView.as_view(),
        name="file-download",
    ),
]
