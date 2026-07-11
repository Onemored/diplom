import json
from pathlib import Path

from django.conf import settings
from django.contrib.auth import get_user_model
from django.test import Client, TestCase
from django.urls import reverse
from storage.models import StoredFile

User = get_user_model()


class AdminUsersApiTests(TestCase):
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

    def test_user_list_returns_storage_statistics_for_admin(self):
        StoredFile.objects.create(owner=self.user, original_name="first.txt", size=100)
        StoredFile.objects.create(owner=self.user, original_name="second.txt", size=250)

        self.login_as(self.admin)
        response = self.client.get(reverse("users:user-list"))

        self.assertEqual(response.status_code, 200)

        items = response.json()["items"]
        user_item = next(item for item in items if item["id"] == self.user.id)
        admin_item = next(item for item in items if item["id"] == self.admin.id)

        self.assertEqual(user_item["fileCount"], 2)
        self.assertEqual(user_item["storageSize"], 350)
        self.assertEqual(admin_item["fileCount"], 0)
        self.assertEqual(admin_item["storageSize"], 0)
        self.assertNotIn("password", user_item)
        self.assertNotIn("storage_path", user_item)

    def test_user_list_requires_authenticated_admin(self):
        response = self.client.get(reverse("users:user-list"))

        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json()["error"]["code"], "authentication_required")

    def test_user_list_rejects_regular_user(self):
        self.login_as(self.user)

        response = self.client.get(reverse("users:user-list"))

        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json()["error"]["code"], "permission_denied")

    def test_admin_can_update_user_role(self):
        self.login_as(self.admin)

        response = self.patch_json_with_csrf(
            reverse("users:user-role", kwargs={"user_id": self.user.id}),
            {"isAdmin": True},
        )

        self.assertEqual(response.status_code, 200)
        self.user.refresh_from_db()
        self.assertTrue(self.user.is_admin)
        self.assertTrue(response.json()["isAdmin"])

    def test_role_update_protects_last_admin(self):
        self.login_as(self.admin)

        response = self.patch_json_with_csrf(
            reverse("users:user-role", kwargs={"user_id": self.admin.id}),
            {"isAdmin": False},
        )

        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json()["error"]["code"], "last_admin_required")
        self.admin.refresh_from_db()
        self.assertTrue(self.admin.is_admin)

    def test_delete_user_removes_metadata_and_storage_directory(self):
        stored_file = StoredFile.objects.create(
            owner=self.user,
            original_name="report.pdf",
            size=100,
        )
        user_storage = Path(settings.FILE_STORAGE_ROOT) / self.user.storage_path
        user_storage.mkdir(parents=True, exist_ok=True)
        (user_storage / str(stored_file.storage_name)).write_text("content", encoding="utf-8")

        self.login_as(self.admin)
        with self.captureOnCommitCallbacks(execute=True):
            response = self.delete_with_csrf(
                reverse("users:user-detail", kwargs={"user_id": self.user.id})
            )

        self.assertEqual(response.status_code, 204)
        self.assertFalse(User.objects.filter(pk=self.user.pk).exists())
        self.assertFalse(StoredFile.objects.filter(pk=stored_file.pk).exists())
        self.assertFalse(user_storage.exists())

    def test_delete_current_user_is_rejected(self):
        self.login_as(self.admin)

        response = self.delete_with_csrf(
            reverse("users:user-detail", kwargs={"user_id": self.admin.id})
        )

        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json()["error"]["code"], "cannot_delete_current_user")
        self.assertTrue(User.objects.filter(pk=self.admin.pk).exists())

    def test_delete_last_admin_is_rejected(self):
        second_admin = User.objects.create_user(
            username="root123",
            email="root@example.com",
            full_name="Второй администратор",
            password="Strong#7",
            is_admin=True,
        )
        self.login_as(second_admin)

        response = self.delete_with_csrf(
            reverse("users:user-detail", kwargs={"user_id": self.admin.id})
        )

        self.assertEqual(response.status_code, 204)

        response = self.delete_with_csrf(
            reverse("users:user-detail", kwargs={"user_id": second_admin.id})
        )

        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json()["error"]["code"], "cannot_delete_current_user")

    def login_as(self, user):
        self.post_json_with_csrf(
            reverse("users:login"),
            {"username": user.username, "password": "Strong#7"},
        )

    def patch_json_with_csrf(self, url, data):
        csrf_response = self.client.get(reverse("users:csrf"))
        return self.client.patch(
            url,
            data=json.dumps(data),
            content_type="application/json",
            HTTP_X_CSRFTOKEN=csrf_response.json()["csrfToken"],
        )

    def delete_with_csrf(self, url):
        csrf_response = self.client.get(reverse("users:csrf"))
        return self.client.delete(
            url,
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
