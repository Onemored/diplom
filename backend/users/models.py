import uuid

from django.contrib.auth.models import AbstractUser
from django.core.validators import RegexValidator
from django.db import models
from django.db.models.functions import Lower

username_validator = RegexValidator(
    regex=r"^[A-Za-z][A-Za-z0-9]{3,19}$",
    message=(
        "Логин должен начинаться с латинской буквы, содержать только латинские буквы "
        "и цифры и иметь длину от 4 до 20 символов."
    ),
)


def generate_storage_path() -> str:
    return f"users/{uuid.uuid4()}"


class User(AbstractUser):
    first_name = None
    last_name = None
    username = models.CharField(
        "логин",
        max_length=20,
        unique=True,
        validators=[username_validator],
        error_messages={"unique": "Пользователь с таким логином уже существует."},
    )
    full_name = models.CharField("полное имя", max_length=255)
    email = models.EmailField(
        "email",
        unique=True,
        error_messages={"unique": "Пользователь с таким email уже существует."},
    )
    is_admin = models.BooleanField("администратор My Cloud", default=False, db_index=True)
    storage_path = models.CharField(
        "путь к хранилищу",
        max_length=100,
        unique=True,
        default=generate_storage_path,
        editable=False,
    )

    REQUIRED_FIELDS = ["email", "full_name"]

    class Meta(AbstractUser.Meta):
        constraints = [
            models.UniqueConstraint(
                Lower("username"),
                name="users_username_case_insensitive_unique",
            ),
            models.UniqueConstraint(
                Lower("email"),
                name="users_email_case_insensitive_unique",
            ),
        ]

    def save(self, *args, **kwargs):
        self.username = self.username.strip().lower()
        self.email = self.email.strip().lower()
        self.full_name = self.full_name.strip()
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return self.username
