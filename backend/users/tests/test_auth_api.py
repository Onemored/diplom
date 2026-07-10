import json

from django.contrib.auth import get_user_model
from django.test import Client, TestCase
from django.urls import reverse

User = get_user_model()


class AuthApiTests(TestCase):
    def setUp(self):
        self.client = Client(enforce_csrf_checks=True)

    def test_csrf_endpoint_sets_cookie_and_returns_token(self):
        response = self.client.get(reverse("users:csrf"))

        self.assertEqual(response.status_code, 200)
        self.assertIn("csrfToken", response.json())
        self.assertIn("csrftoken", response.cookies)

    def test_register_requires_csrf_token(self):
        response = self.post_json(
            reverse("users:register"),
            {
                "username": "user123",
                "fullName": "Алексей Петров",
                "email": "user@example.com",
                "password": "Strong#7",
            },
        )

        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json()["error"]["code"], "csrf_failed")

    def test_register_creates_user_without_password_in_response(self):
        response = self.post_json_with_csrf(
            reverse("users:register"),
            {
                "username": "  User123  ",
                "fullName": "  Алексей Петров  ",
                "email": "  USER@example.com  ",
                "password": "Strong#7",
            },
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(
            response.json(),
            {
                "id": User.objects.get().id,
                "username": "user123",
                "fullName": "Алексей Петров",
                "email": "user@example.com",
                "isAdmin": False,
            },
        )
        self.assertNotIn("password", response.json())
        self.assertTrue(User.objects.get(username="user123").check_password("Strong#7"))

    def test_register_rejects_duplicate_username(self):
        User.objects.create_user(
            username="user123",
            email="first@example.com",
            full_name="Первый пользователь",
            password="Strong#7",
        )

        response = self.post_json_with_csrf(
            reverse("users:register"),
            {
                "username": "USER123",
                "fullName": "Второй пользователь",
                "email": "second@example.com",
                "password": "Strong#7",
            },
        )

        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json()["error"]["code"], "username_already_exists")

    def test_register_rejects_duplicate_email(self):
        User.objects.create_user(
            username="first123",
            email="user@example.com",
            full_name="Первый пользователь",
            password="Strong#7",
        )

        response = self.post_json_with_csrf(
            reverse("users:register"),
            {
                "username": "second123",
                "fullName": "Второй пользователь",
                "email": "USER@example.com",
                "password": "Strong#7",
            },
        )

        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json()["error"]["code"], "email_already_exists")

    def test_register_returns_field_errors(self):
        response = self.post_json_with_csrf(
            reverse("users:register"),
            {
                "username": "1bad",
                "fullName": "",
                "email": "bad-email",
                "password": "123",
            },
        )

        payload = response.json()

        self.assertEqual(response.status_code, 400)
        self.assertEqual(payload["error"]["code"], "validation_error")
        self.assertIn("username", payload["error"]["fields"])
        self.assertIn("fullName", payload["error"]["fields"])
        self.assertIn("email", payload["error"]["fields"])
        self.assertIn("password", payload["error"]["fields"])

    def test_login_creates_session_and_me_returns_current_user(self):
        user = User.objects.create_user(
            username="user123",
            email="user@example.com",
            full_name="Алексей Петров",
            password="Strong#7",
        )

        login_response = self.post_json_with_csrf(
            reverse("users:login"),
            {"username": "USER123", "password": "Strong#7"},
        )
        me_response = self.client.get(reverse("users:me"))

        self.assertEqual(login_response.status_code, 200)
        self.assertEqual(login_response.json()["id"], user.id)
        self.assertIn("sessionid", login_response.cookies)
        self.assertEqual(me_response.status_code, 200)
        self.assertEqual(me_response.json()["username"], "user123")

    def test_login_rejects_invalid_credentials(self):
        User.objects.create_user(
            username="user123",
            email="user@example.com",
            full_name="Алексей Петров",
            password="Strong#7",
        )

        response = self.post_json_with_csrf(
            reverse("users:login"),
            {"username": "user123", "password": "Wrong#7"},
        )

        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json()["error"]["code"], "invalid_credentials")

    def test_me_requires_authenticated_session(self):
        response = self.client.get(reverse("users:me"))

        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json()["error"]["code"], "authentication_required")

    def test_logout_ends_session(self):
        User.objects.create_user(
            username="user123",
            email="user@example.com",
            full_name="Алексей Петров",
            password="Strong#7",
        )
        self.post_json_with_csrf(
            reverse("users:login"),
            {"username": "user123", "password": "Strong#7"},
        )

        logout_response = self.post_json_with_csrf(reverse("users:logout"), {})
        me_response = self.client.get(reverse("users:me"))

        self.assertEqual(logout_response.status_code, 204)
        self.assertEqual(me_response.status_code, 401)

    def post_json_with_csrf(self, url, data):
        csrf_response = self.client.get(reverse("users:csrf"))
        return self.post_json(
            url,
            data,
            HTTP_X_CSRFTOKEN=csrf_response.json()["csrfToken"],
        )

    def post_json(self, url, data, **headers):
        return self.client.post(
            url,
            data=json.dumps(data),
            content_type="application/json",
            **headers,
        )
