from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.test import TestCase

User = get_user_model()


class UserModelTests(TestCase):
    def test_creates_user_with_normalized_identity_and_unique_storage(self):
        first_user = User.objects.create_user(
            username="  User123  ",
            email="  USER@Example.COM  ",
            full_name="  Алексей Петров  ",
            password="Strong#7",
        )
        second_user = User.objects.create_user(
            username="other123",
            email="other@example.com",
            full_name="Мария Иванова",
            password="Strong#8",
        )

        self.assertEqual(first_user.username, "user123")
        self.assertEqual(first_user.email, "user@example.com")
        self.assertEqual(first_user.full_name, "Алексей Петров")
        self.assertTrue(first_user.storage_path.startswith("users/"))
        self.assertNotEqual(first_user.storage_path, second_user.storage_path)
        self.assertFalse(first_user.is_admin)

    def test_hashes_password(self):
        user = User.objects.create_user(
            username="user123",
            email="user@example.com",
            full_name="Алексей Петров",
            password="Strong#7",
        )

        self.assertNotEqual(user.password, "Strong#7")
        self.assertTrue(user.check_password("Strong#7"))

    def test_validates_username_format(self):
        invalid_user = User(
            username="1bad",
            email="user@example.com",
            full_name="Алексей Петров",
        )

        with self.assertRaises(ValidationError) as error:
            invalid_user.full_clean()

        self.assertIn("username", error.exception.message_dict)

    def test_rejects_username_duplicate_with_different_case(self):
        User.objects.create_user(
            username="user123",
            email="first@example.com",
            full_name="Первый пользователь",
            password="Strong#7",
        )

        with self.assertRaises(IntegrityError), transaction.atomic():
            User.objects.bulk_create(
                [
                    User(
                        username="USER123",
                        email="second@example.com",
                        full_name="Второй пользователь",
                    )
                ]
            )

    def test_rejects_email_duplicate_with_different_case(self):
        User.objects.create_user(
            username="first123",
            email="user@example.com",
            full_name="Первый пользователь",
            password="Strong#7",
        )

        with self.assertRaises(IntegrityError), transaction.atomic():
            User.objects.bulk_create(
                [
                    User(
                        username="second123",
                        email="USER@EXAMPLE.COM",
                        full_name="Второй пользователь",
                    )
                ]
            )

    def test_string_representation_is_username(self):
        user = User(username="user123")

        self.assertEqual(str(user), "user123")
