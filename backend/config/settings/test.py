import tempfile

from .base import *  # noqa: F403

SECRET_KEY = "test-only-secret-key"
DEBUG = False
PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]
FILE_STORAGE_ROOT = tempfile.mkdtemp(prefix="mycloud-test-storage-")
LOGGING["root"]["level"] = "WARNING"  # noqa: F405
