from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.test import TestCase

from storage.models import StoredFile

User = get_user_model()


class StoredFileModelTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(
            username="user123",
            email="user@example.com",
            full_name="Алексей Петров",
            password="Strong#7",
        )

    def test_creates_file_metadata_with_safe_generated_values(self):
        stored_file = StoredFile.objects.create(
            owner=self.user,
            original_name="  report.pdf  ",
            size=245_760,
            comment="Финальная версия",
        )

        self.assertEqual(stored_file.original_name, "report.pdf")
        self.assertEqual(
            stored_file.relative_path,
            f"{self.user.storage_path}/{stored_file.storage_name}",
        )
        self.assertEqual(len(stored_file.public_token), 43)
        self.assertIsNotNone(stored_file.uploaded_at)
        self.assertIsNone(stored_file.last_downloaded_at)

    def test_allows_same_original_name_for_different_files(self):
        first_file = StoredFile.objects.create(
            owner=self.user,
            original_name="report.pdf",
            size=100,
        )
        second_file = StoredFile.objects.create(
            owner=self.user,
            original_name="report.pdf",
            size=200,
        )

        self.assertNotEqual(first_file.storage_name, second_file.storage_name)
        self.assertNotEqual(first_file.relative_path, second_file.relative_path)
        self.assertNotEqual(first_file.public_token, second_file.public_token)

    def test_rejects_empty_original_name(self):
        stored_file = StoredFile(owner=self.user, original_name="   ", size=0)

        with self.assertRaises(ValidationError) as error:
            stored_file.full_clean()

        self.assertIn("original_name", error.exception.message_dict)

    def test_rejects_negative_size_at_database_level(self):
        with self.assertRaises(IntegrityError), transaction.atomic():
            StoredFile.objects.create(
                owner=self.user,
                original_name="report.pdf",
                size=-1,
            )

    def test_deletes_file_metadata_with_owner(self):
        stored_file = StoredFile.objects.create(
            owner=self.user,
            original_name="report.pdf",
            size=100,
        )

        self.user.delete()

        self.assertFalse(StoredFile.objects.filter(pk=stored_file.pk).exists())

    def test_string_representation_is_original_name(self):
        stored_file = StoredFile(original_name="report.pdf")

        self.assertEqual(str(stored_file), "report.pdf")
