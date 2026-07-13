import logging
import os
import shutil
import tempfile
from pathlib import Path

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import transaction
from rest_framework import status
from rest_framework.exceptions import APIException

from storage.models import StoredFile

logger = logging.getLogger(__name__)


class FileStorageError(APIException):
    status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
    default_detail = "Не удалось сохранить файл."
    default_code = "file_storage_error"


class FileTooLargeError(APIException):
    status_code = status.HTTP_413_REQUEST_ENTITY_TOO_LARGE
    default_detail = "Файл превышает допустимый размер."
    default_code = "file_too_large"


class FileRequiredError(APIException):
    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = "Файл обязателен."
    default_code = "file_required"


def schedule_user_storage_cleanup(storage_path: str) -> None:
    target = _safe_storage_path(storage_path)
    transaction.on_commit(lambda: _remove_directory(target))


def schedule_stored_file_cleanup(relative_path: str) -> None:
    target = _safe_storage_path(relative_path)
    transaction.on_commit(lambda: _remove_file(target))


def save_uploaded_file(owner, uploaded_file, comment: str = "") -> StoredFile:
    original_name = _safe_original_name(getattr(uploaded_file, "name", ""))
    declared_size = int(getattr(uploaded_file, "size", 0) or 0)
    if declared_size > settings.FILE_UPLOAD_MAX_BYTES:
        raise FileTooLargeError()

    stored_file = StoredFile(
        owner=owner,
        original_name=original_name,
        size=declared_size,
        comment=comment.strip()[: settings.FILE_COMMENT_MAX_LENGTH],
    )
    stored_file.relative_path = f"{owner.storage_path}/{stored_file.storage_name}"
    target = _safe_storage_path(stored_file.relative_path)

    try:
        written_size = _write_uploaded_file(uploaded_file, target)
        stored_file.size = written_size
        stored_file.full_clean()
        stored_file.save()
    except FileTooLargeError:
        raise
    except (OSError, ValidationError) as error:
        _remove_file(target)
        logger.exception("Failed to save uploaded file")
        raise FileStorageError() from error

    return stored_file


def delete_stored_file(stored_file: StoredFile) -> None:
    relative_path = stored_file.relative_path
    with transaction.atomic():
        stored_file.delete()
        schedule_stored_file_cleanup(relative_path)


def _safe_storage_path(storage_path: str) -> Path:
    root = Path(settings.FILE_STORAGE_ROOT).resolve()
    target = (root / storage_path).resolve()

    if target != root and root in target.parents:
        return target

    msg = "Небезопасный путь пользовательского хранилища."
    raise ValueError(msg)


def _safe_original_name(name: str) -> str:
    original_name = Path(name).name.strip()
    if not original_name:
        raise FileRequiredError()
    return original_name[: settings.FILE_NAME_MAX_LENGTH]


def _write_uploaded_file(uploaded_file, target: Path) -> int:
    target.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = None
    written_size = 0

    try:
        with tempfile.NamedTemporaryFile(dir=target.parent, delete=False) as tmp:
            tmp_path = Path(tmp.name)
            for chunk in uploaded_file.chunks():
                written_size += len(chunk)
                if written_size > settings.FILE_UPLOAD_MAX_BYTES:
                    raise FileTooLargeError()
                tmp.write(chunk)
        os.replace(tmp_path, target)
    except Exception:
        if tmp_path is not None:
            _remove_file(tmp_path)
        raise

    return written_size


def _remove_file(target: Path) -> None:
    try:
        target.unlink()
    except FileNotFoundError:
        return
    except OSError:
        logger.exception("Failed to remove stored file")


def _remove_directory(target: Path) -> None:
    if not target.exists():
        logger.warning("User storage directory is already absent")
        return

    try:
        shutil.rmtree(target)
    except OSError:
        logger.exception("Failed to remove user storage directory")
