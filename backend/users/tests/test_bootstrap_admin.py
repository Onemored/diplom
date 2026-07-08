from io import StringIO
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.management import CommandError, call_command
from django.test import TestCase

User = get_user_model()


class BootstrapAdminCommandTests(TestCase):
    environment = {
        "INITIAL_ADMIN_USERNAME": "Admin123",
        "INITIAL_ADMIN_EMAIL": "Admin@Example.COM",
        "INITIAL_ADMIN_FULL_NAME": " Администратор системы ",
        "INITIAL_ADMIN_PASSWORD": "StrongAdminPassword#2026",
    }

    def test_creates_initial_admin_from_environment(self):
        output = StringIO()

        with patch.dict("os.environ", self.environment, clear=True):
            call_command("bootstrap_admin", stdout=output)

        user = User.objects.get(username="admin123")
        self.assertEqual(user.email, "admin@example.com")
        self.assertEqual(user.full_name, "Администратор системы")
        self.assertTrue(user.is_admin)
        self.assertTrue(user.is_staff)
        self.assertTrue(user.is_superuser)
        self.assertTrue(user.check_password(self.environment["INITIAL_ADMIN_PASSWORD"]))
        self.assertNotIn(self.environment["INITIAL_ADMIN_PASSWORD"], output.getvalue())

    def test_is_idempotent_and_does_not_change_password(self):
        user = User.objects.create_user(
            username="admin123",
            email="admin@example.com",
            full_name="Администратор системы",
            password="ExistingPassword#2026",
            is_admin=True,
            is_staff=True,
            is_superuser=True,
        )
        original_password_hash = user.password

        with patch.dict("os.environ", self.environment, clear=True):
            call_command("bootstrap_admin", stdout=StringIO())

        user.refresh_from_db()
        self.assertEqual(user.password, original_password_hash)
        self.assertTrue(user.check_password("ExistingPassword#2026"))

    def test_promotes_existing_user_without_changing_password(self):
        user = User.objects.create_user(
            username="admin123",
            email="admin@example.com",
            full_name="Администратор системы",
            password="ExistingPassword#2026",
        )

        with patch.dict("os.environ", self.environment, clear=True):
            call_command("bootstrap_admin", stdout=StringIO())

        user.refresh_from_db()
        self.assertTrue(user.is_admin)
        self.assertTrue(user.is_staff)
        self.assertTrue(user.is_superuser)
        self.assertTrue(user.check_password("ExistingPassword#2026"))

    def test_requires_environment_for_first_admin(self):
        with (
            patch.dict("os.environ", {}, clear=True),
            self.assertRaises(CommandError) as error,
        ):
            call_command("bootstrap_admin", stdout=StringIO())

        self.assertIn("Не заданы обязательные значения", str(error.exception))
        self.assertEqual(User.objects.count(), 0)

    def test_rejects_weak_password(self):
        environment = self.environment | {
            "INITIAL_ADMIN_PASSWORD": "123",
        }

        with (
            patch.dict("os.environ", environment, clear=True),
            self.assertRaises(CommandError) as error,
        ):
            call_command("bootstrap_admin", stdout=StringIO())

        self.assertIn("Пароль начального администратора", str(error.exception))
        self.assertEqual(User.objects.count(), 0)

    def test_reports_creation_conflict(self):
        User.objects.create_user(
            username="other123",
            email="admin@example.com",
            full_name="Другой пользователь",
            password="ExistingPassword#2026",
        )

        with (
            patch.dict("os.environ", self.environment, clear=True),
            self.assertRaises(CommandError) as error,
        ):
            call_command("bootstrap_admin", stdout=StringIO())

        self.assertIn("Не удалось создать", str(error.exception))
        self.assertEqual(User.objects.count(), 1)
