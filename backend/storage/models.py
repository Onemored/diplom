import secrets
import uuid

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models


def generate_public_token() -> str:
    return secrets.token_urlsafe(32)


class StoredFile(models.Model):
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="files",
        verbose_name="владелец",
    )
    original_name = models.CharField("оригинальное имя", max_length=255)
    storage_name = models.UUIDField(
        "физическое имя",
        default=uuid.uuid4,
        unique=True,
        editable=False,
    )
    relative_path = models.CharField(
        "относительный путь",
        max_length=255,
        unique=True,
        editable=False,
    )
    size = models.BigIntegerField("размер в байтах")
    comment = models.TextField("комментарий", blank=True)
    uploaded_at = models.DateTimeField("дата загрузки", auto_now_add=True)
    last_downloaded_at = models.DateTimeField(
        "дата последнего скачивания",
        null=True,
        blank=True,
    )
    public_token = models.CharField(
        "публичный токен",
        max_length=43,
        unique=True,
        default=generate_public_token,
        editable=False,
    )

    class Meta:
        ordering = ("-uploaded_at",)
        verbose_name = "файл"
        verbose_name_plural = "файлы"
        indexes = [
            models.Index(fields=("owner", "uploaded_at"), name="storage_owner_uploaded_idx")
        ]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(size__gte=0),
                name="storage_file_size_non_negative",
            )
        ]

    def clean(self):
        super().clean()
        self.original_name = self.original_name.strip()
        if not self.original_name:
            raise ValidationError({"original_name": "Имя файла не может быть пустым."})

    def save(self, *args, **kwargs):
        self.original_name = self.original_name.strip()
        if not self.original_name:
            raise ValidationError({"original_name": "Имя файла не может быть пустым."})
        if not self.relative_path:
            self.relative_path = f"{self.owner.storage_path}/{self.storage_name}"
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return self.original_name
