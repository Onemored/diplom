from django.contrib import admin

from .models import StoredFile


@admin.register(StoredFile)
class StoredFileAdmin(admin.ModelAdmin):
    list_display = ("original_name", "owner", "size", "uploaded_at", "last_downloaded_at")
    list_filter = ("uploaded_at", "last_downloaded_at")
    search_fields = ("original_name", "owner__username", "owner__email")
    ordering = ("-uploaded_at",)
    readonly_fields = (
        "storage_name",
        "relative_path",
        "size",
        "uploaded_at",
        "last_downloaded_at",
        "public_token",
    )
