import tempfile
from pathlib import Path

from django.test import SimpleTestCase, override_settings
from django.urls import reverse


class HealthCheckTests(SimpleTestCase):
    def test_health_check_returns_ok(self):
        response = self.client.get(reverse("health-check"))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "ok"})

    def test_health_check_rejects_non_get_requests(self):
        response = self.client.post(reverse("health-check"))

        self.assertEqual(response.status_code, 405)


class SpaIndexTests(SimpleTestCase):
    def test_spa_index_returns_frontend_build_for_application_routes(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            dist_dir = Path(tmpdir)
            (dist_dir / "index.html").write_text(
                "<!doctype html><div id='root'></div>",
                encoding="utf-8",
            )

            with override_settings(FRONTEND_DIST_DIR=dist_dir):
                response = self.client.get("/storage")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "text/html")
        self.assertIn(b"<div id='root'></div>", b"".join(response.streaming_content))

    def test_spa_index_does_not_hide_missing_frontend_build(self):
        with (
            tempfile.TemporaryDirectory() as tmpdir,
            override_settings(FRONTEND_DIST_DIR=Path(tmpdir)),
        ):
            response = self.client.get("/storage")

        self.assertEqual(response.status_code, 404)
