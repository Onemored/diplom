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


class StoredFileUpdateSerializer(serializers.Serializer):
    originalName = serializers.CharField(
        max_length=StoredFile._meta.get_field("original_name").max_length,
        required=False,
        source="original_name",
    )
    comment = serializers.CharField(
        max_length=1000,
        required=False,
        allow_blank=True,
    )

    def validate_originalName(self, value):
        original_name = value.strip()
        if not original_name:
            raise serializers.ValidationError("Имя файла не может быть пустым.")
        return original_name

    def validate_comment(self, value):
        return value.strip()
