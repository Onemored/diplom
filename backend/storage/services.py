import logging
import shutil
from pathlib import Path

from django.conf import settings
from django.db import transaction

logger = logging.getLogger(__name__)


def schedule_user_storage_cleanup(storage_path: str) -> None:
    target = _safe_storage_path(storage_path)
    transaction.on_commit(lambda: _remove_directory(target))


def _safe_storage_path(storage_path: str) -> Path:
    root = Path(settings.FILE_STORAGE_ROOT).resolve()
    target = (root / storage_path).resolve()

    if target != root and root in target.parents:
        return target

    msg = "Небезопасный путь пользовательского хранилища."
    raise ValueError(msg)


def _remove_directory(target: Path) -> None:
    if not target.exists():
        logger.warning("User storage directory is already absent")
        return

    try:
        shutil.rmtree(target)
    except OSError:
        logger.exception("Failed to remove user storage directory")
