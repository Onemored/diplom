import os

from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.core.management.base import BaseCommand, CommandError
from django.db import IntegrityError, transaction


class Command(BaseCommand):
    help = "Creates the initial application administrator."

    required_environment = {
        "INITIAL_ADMIN_USERNAME": "логин начального администратора",
        "INITIAL_ADMIN_EMAIL": "email начального администратора",
        "INITIAL_ADMIN_FULL_NAME": "полное имя начального администратора",
        "INITIAL_ADMIN_PASSWORD": "пароль начального администратора",
    }

    def handle(self, *args, **options):
        values = {key: os.environ.get(key, "").strip() for key in self.required_environment}
        username = values["INITIAL_ADMIN_USERNAME"].lower()
        email = values["INITIAL_ADMIN_EMAIL"].lower()

        User = get_user_model()
        user = User.objects.filter(username=username).first()

        if user:
            self._promote_existing_user(user)
            self.stdout.write(self.style.SUCCESS("Начальный администратор уже существует."))
            return

        self._validate_required_values(values)

        try:
            self._validate_password(values["INITIAL_ADMIN_PASSWORD"], values)
            with transaction.atomic():
                User.objects.create_user(
                    username=username,
                    email=email,
                    full_name=values["INITIAL_ADMIN_FULL_NAME"],
                    password=values["INITIAL_ADMIN_PASSWORD"],
                    is_admin=True,
                    is_staff=True,
                    is_superuser=True,
                )
        except IntegrityError as error:
            raise CommandError("Не удалось создать начального администратора.") from error

        self.stdout.write(self.style.SUCCESS("Начальный администратор создан."))

    def _promote_existing_user(self, user):
        update_fields = []
        for field in ("is_admin", "is_staff", "is_superuser"):
            if not getattr(user, field):
                setattr(user, field, True)
                update_fields.append(field)

        if update_fields:
            user.save(update_fields=update_fields)

    def _validate_required_values(self, values):
        missing = [self.required_environment[key] for key, value in values.items() if not value]
        if missing:
            missing_values = ", ".join(missing)
            raise CommandError(f"Не заданы обязательные значения: {missing_values}.")

    def _validate_password(self, password, values):
        User = get_user_model()
        candidate = User(
            username=values["INITIAL_ADMIN_USERNAME"],
            email=values["INITIAL_ADMIN_EMAIL"],
            full_name=values["INITIAL_ADMIN_FULL_NAME"],
        )

        try:
            validate_password(password, candidate)
        except ValidationError as error:
            raise CommandError("Пароль начального администратора не прошёл проверку.") from error
