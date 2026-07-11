import json
from pathlib import Path

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import Client, TestCase, override_settings
from django.urls import reverse

from storage.models import StoredFile

User = get_user_model()


class FilesApiTests(TestCase):
    def setUp(self):
        self.client = Client(enforce_csrf_checks=True)
        self.admin = User.objects.create_user(
            username="admin123",
            email="admin@example.com",
            full_name="Администратор",
            password="Strong#7",
            is_admin=True,
        )
        self.user = User.objects.create_user(
            username="user123",
            email="user@example.com",
            full_name="Алексей Петров",
            password="Strong#7",
        )
        self.other_user = User.objects.create_user(
            username="other123",
            email="other@example.com",
            full_name="Мария Иванова",
            password="Strong#7",
        )

    def test_user_gets_only_own_files(self):
        own_file = StoredFile.objects.create(
            owner=self.user,
            original_name="own.txt",
            size=100,
            comment="Мой файл",
        )
        StoredFile.objects.create(
            owner=self.other_user,
            original_name="other.txt",
            size=200,
        )

        self.login_as(self.user)
        response = self.client.get(reverse("storage:file-list"))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["owner"]["id"], self.user.id)
        self.assertEqual(len(response.json()["items"]), 1)
        self.assertEqual(response.json()["items"][0]["id"], own_file.id)
        self.assertEqual(
            response.json()["items"][0]["downloadUrl"],
            f"/api/v1/files/{own_file.id}/download/",
        )

    def test_admin_can_get_selected_user_files(self):
        stored_file = StoredFile.objects.create(
            owner=self.other_user,
            original_name="report.pdf",
            size=300,
        )

        self.login_as(self.admin)
        response = self.client.get(
            reverse("storage:file-list"),
            {"ownerId": self.other_user.id},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["owner"]["id"], self.other_user.id)
        self.assertEqual(response.json()["items"][0]["id"], stored_file.id)

    def test_regular_user_cannot_select_other_storage(self):
        self.login_as(self.user)

        response = self.client.get(
            reverse("storage:file-list"),
            {"ownerId": self.other_user.id},
        )

        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json()["error"]["code"], "storage_access_denied")

    def test_upload_saves_file_metadata_and_content(self):
        self.login_as(self.user)
        uploaded_file = SimpleUploadedFile(
            "../report.txt",
            b"hello cloud",
            content_type="text/plain",
        )

        response = self.post_file_with_csrf(
            reverse("storage:file-list"),
            {"file": uploaded_file, "comment": "  Текстовый файл  "},
        )

        self.assertEqual(response.status_code, 201)
        stored_file = StoredFile.objects.get()
        target = Path(settings.FILE_STORAGE_ROOT) / stored_file.relative_path

        self.assertEqual(response.json()["originalName"], "report.txt")
        self.assertEqual(response.json()["size"], 11)
        self.assertEqual(response.json()["comment"], "Текстовый файл")
        self.assertEqual(stored_file.owner, self.user)
        self.assertEqual(target.read_bytes(), b"hello cloud")

    def test_admin_can_upload_file_for_selected_owner(self):
        self.login_as(self.admin)
        uploaded_file = SimpleUploadedFile("report.txt", b"content")

        response = self.post_file_with_csrf(
            reverse("storage:file-list"),
            {
                "file": uploaded_file,
                "ownerId": str(self.other_user.id),
            },
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(StoredFile.objects.get().owner, self.other_user)

    def test_upload_requires_file(self):
        self.login_as(self.user)

        response = self.post_file_with_csrf(reverse("storage:file-list"), {})

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["error"]["code"], "file_required")

    @override_settings(FILE_UPLOAD_MAX_BYTES=5)
    def test_upload_rejects_too_large_file(self):
        self.login_as(self.user)
        uploaded_file = SimpleUploadedFile("large.txt", b"too large")

        response = self.post_file_with_csrf(
            reverse("storage:file-list"),
            {"file": uploaded_file},
        )

        self.assertEqual(response.status_code, 413)
        self.assertEqual(response.json()["error"]["code"], "file_too_large")
        self.assertFalse(StoredFile.objects.exists())

    def login_as(self, user):
        self.post_json_with_csrf(
            reverse("users:login"),
            {"username": user.username, "password": "Strong#7"},
        )

    def post_file_with_csrf(self, url, data):
        csrf_response = self.client.get(reverse("users:csrf"))
        return self.client.post(
            url,
            data=data,
            HTTP_X_CSRFTOKEN=csrf_response.json()["csrfToken"],
        )

    def post_json_with_csrf(self, url, data):
        csrf_response = self.client.get(reverse("users:csrf"))
        return self.client.post(
            url,
            data=json.dumps(data),
            content_type="application/json",
            HTTP_X_CSRFTOKEN=csrf_response.json()["csrfToken"],
        )
