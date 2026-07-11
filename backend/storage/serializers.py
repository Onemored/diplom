from django.urls import reverse
from rest_framework import serializers

from storage.models import StoredFile


class FileOwnerSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    username = serializers.CharField()


class StoredFileSerializer(serializers.ModelSerializer):
    originalName = serializers.CharField(source="original_name")
    uploadedAt = serializers.DateTimeField(source="uploaded_at")
    lastDownloadedAt = serializers.DateTimeField(source="last_downloaded_at")
    downloadUrl = serializers.SerializerMethodField()

    class Meta:
        model = StoredFile
        fields = (
            "id",
            "originalName",
            "size",
            "comment",
            "uploadedAt",
            "lastDownloadedAt",
            "downloadUrl",
        )

    def get_downloadUrl(self, obj):
        return reverse("storage:file-download", kwargs={"file_id": obj.id})
